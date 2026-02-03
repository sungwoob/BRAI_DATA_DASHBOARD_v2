const datasetList = document.getElementById('dataset-list');
const datasetCardTemplate = document.getElementById('dataset-card-template');
const totalCount = document.getElementById('total-count');
const summaryContainer = document.getElementById('summary');
const searchInput = document.getElementById('search');
const treeContainer = document.getElementById('tree-view');
const filterBoxes = Array.from(document.querySelectorAll('.filter-group:not(.crops) input[type="checkbox"]'));
const cropBoxes = Array.from(document.querySelectorAll('.filter-group.crops input[type="checkbox"]'));
const expandedKeys = new Set();

function cropIcon(crop) {
  const name = (crop || '').toLowerCase();
  if (name.indexOf('tomato') !== -1 || name.indexOf('토마토') !== -1) return '🍅';
  if (name.indexOf('cabbage') !== -1 || name.indexOf('양배추') !== -1) return '🥬';
  return '🗂️';
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function createSummaryPills(datasets) {
  const total = datasets.length;
  const genotype = datasets.filter((d) => d.type.toLowerCase() === 'genotype').length;
  const phenotype = datasets.filter((d) => d.type.toLowerCase() === 'phenotype').length;

  summaryContainer.innerHTML = '';

  const items = [
    { label: '전체', value: total },
    { label: 'Genotype', value: genotype },
    { label: 'Phenotype', value: phenotype }
  ];

  items.forEach((item) => {
    const pill = document.createElement('div');
    pill.className = 'pill';
    pill.innerHTML = `<span>${item.label}</span><strong>${item.value}</strong>`;
    summaryContainer.appendChild(pill);
  });

  totalCount.textContent = `${total} datasets`;
}

function renderDatasets(datasets) {
  datasetList.innerHTML = '';

  if (!datasets.length) {
    datasetList.innerHTML = '<p class="meta">조건에 맞는 데이터셋이 없습니다.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();

  datasets.forEach((dataset) => {
    const clone = datasetCardTemplate.content.cloneNode(true);
    const card = clone.querySelector('.dataset-card');

    const nameEl = clone.querySelector('.dataset-title');
    const subtitleEl = clone.querySelector('.dataset-subtitle');
    const typeChip = clone.querySelector('.type-chip');
    const meta = clone.querySelector('.meta');
    const count = clone.querySelector('.count');
    const datatype = clone.querySelector('.datatype');
    const storage = clone.querySelector('.storage');
    const generated = clone.querySelector('.generated');
    const filePath = clone.querySelector('.filepath');
    const relatedContainer = clone.querySelector('.related');
    const relatedGenotype = clone.querySelector('.related-genotype');
    const toggleBtn = clone.querySelector('.toggle-btn');

    const icon = cropIcon(dataset.crop);
    nameEl.innerHTML = `<span class="crop-icon" aria-hidden="true">${icon}</span>${dataset.name}`;
    subtitleEl.textContent = dataset.subtitle || '';
    subtitleEl.hidden = !dataset.subtitle;
    typeChip.textContent = dataset.type;
    const typeClass = dataset.type.toLowerCase();
    typeChip.classList.add(typeClass);

    meta.textContent = `${dataset.crop} (${dataset.cropCode || 'code 없음'}) • 버전 ${dataset.version}`;
    count.textContent = typeof dataset.numberOfData === 'number'
      ? dataset.numberOfData.toLocaleString()
      : '-';
    datatype.textContent = dataset.dataType || '-';
    storage.textContent = dataset.storagePath;
    generated.textContent = formatDate(dataset.generatedAt);
    filePath.textContent = dataset.filePath;

    if (dataset.relatedGenotype) {
      relatedContainer.hidden = false;
      relatedGenotype.textContent = `${dataset.relatedGenotype.name} (${dataset.relatedGenotype.type})`;
    }

    card.setAttribute('data-type', dataset.type.toLowerCase());
    card.setAttribute('data-name', dataset.name.toLowerCase());
    card.setAttribute('data-crop', dataset.crop.toLowerCase());

    const cardKey = dataset.filePath || dataset.name;
    const applyState = (collapsed) => {
      card.classList.toggle('collapsed', collapsed);
      const expanded = !collapsed;
      toggleBtn.setAttribute('aria-expanded', expanded.toString());
      toggleBtn.textContent = expanded ? '접기' : '펼치기';
      toggleBtn.setAttribute('aria-label', expanded ? '세부 정보 접기' : '세부 정보 펼치기');
    };

    applyState(!expandedKeys.has(cardKey));

    const handleToggle = () => {
      const nextCollapsed = !card.classList.contains('collapsed');
      applyState(nextCollapsed);
      if (nextCollapsed) {
        expandedKeys.delete(cardKey);
      } else {
        expandedKeys.add(cardKey);
      }
    };

    toggleBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      handleToggle();
    });

    card.addEventListener('click', (event) => {
      if (event.target.closest('.toggle-btn')) return;
      handleToggle();
    });

    fragment.appendChild(clone);
  });

  datasetList.appendChild(fragment);
}

function filterDatasets(allDatasets) {
  const activeTypes = filterBoxes
    .filter((box) => box.checked)
    .map((box) => box.value.toLowerCase());
  const activeCrops = cropBoxes
    .filter((box) => box.checked)
    .map((box) => box.value.toLowerCase());
  const keyword = searchInput.value.trim().toLowerCase();

  return allDatasets.filter((dataset) => {
    const matchesType = activeTypes.includes(dataset.type.toLowerCase());
    const matchesCrop = activeCrops.includes(dataset.crop.toLowerCase());
    const matchesKeyword =
      !keyword ||
      dataset.name.toLowerCase().includes(keyword) ||
      dataset.crop.toLowerCase().includes(keyword);
    return matchesType && matchesCrop && matchesKeyword;
  });
}

function renderTreeNode(node) {
  const item = document.createElement('div');
  item.className = 'tree-item ' + node.type;
  item.setAttribute('role', 'treeitem');
  item.setAttribute('aria-label', node.name);

  const label = document.createElement('div');
  label.className = 'tree-label';
  label.innerHTML = (node.type === 'directory' ? '📁' : '📄') + ' <span>' + node.name + '</span>';
  item.appendChild(label);

  if (node.children && node.children.length) {
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'tree-children';
    childrenContainer.setAttribute('role', 'group');

    node.children.forEach((child) => {
      childrenContainer.appendChild(renderTreeNode(child));
    });

    item.appendChild(childrenContainer);
  }

  return item;
}

function renderTree(treeData) {
  treeContainer.innerHTML = '';
  if (!treeData || !treeData.length) {
    treeContainer.innerHTML = '<p class="muted">구성을 불러오지 못했습니다.</p>';
    return;
  }

  treeData.forEach((node) => {
    treeContainer.appendChild(renderTreeNode(node));
  });
}

async function bootstrap() {
  const response = await fetch('/api/datasets');
  const payload = await response.json();
  const datasets = payload.datasets || [];
  const tree = payload.tree || [];

  createSummaryPills(datasets);
  renderDatasets(datasets);
  renderTree(tree);

  const updateView = () => {
    const filtered = filterDatasets(datasets);
    renderDatasets(filtered);
  };

  searchInput.addEventListener('input', updateView);
  filterBoxes.forEach((box) => box.addEventListener('change', updateView));
  cropBoxes.forEach((box) => box.addEventListener('change', updateView));
}

bootstrap().catch((err) => {
  datasetList.innerHTML = `<p class="meta">데이터를 불러오지 못했습니다: ${err.message}</p>`;
});
