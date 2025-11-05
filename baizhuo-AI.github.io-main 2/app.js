const STORAGE_KEYS = {
  prefs: 'prefs_v1',
  favorites: 'fav_models_v1',
  guide: 'guide_dismissed_v1'
};

const COMMENT_PREFIX = 'comments_v1::';

const defaultPrefs = {
  currency: 'CNY',
  unit: 'perMillion',
  lang: 'zh',
  onlyFavorites: false,
  onlyCommon: false,
  vendorSelections: null,
  search: '',
  rate: 7,
  sortKey: 'vendor',
  sortDir: 'asc',
  page: 1
};

const state = {
  i18n: {},
  lang: 'zh',
  data: [],
  officialData: [],
  importedData: null,
  useImported: false,
  favorites: new Set(),
  prefs: { ...defaultPrefs },
  sortKey: 'vendor',
  sortDir: 'asc',
  perPage: 10,
  currentPage: 1,
  vendorFilterOpen: false,
  vendorSearch: '',
  vendorSelections: null,
  drawerTarget: null,
  toastTimer: null
};

const $ = selector => document.querySelector(selector);

const elements = {
  title: $('#app-title'),
  search: $('#search-input'),
  favoritesToggle: $('#favorites-toggle'),
  commonToggle: $('#common-toggle'),
  currencyToggle: $('#currency-toggle'),
  unitToggle: $('#unit-toggle'),
  langToggle: $('#lang-toggle'),
  vendorFilterBtn: $('#vendor-filter-btn'),
  vendorFilter: $('#vendor-filter'),
  vendorPanel: $('#vendor-filter .dropdown-panel'),
  vendorOptions: $('#vendor-options'),
  vendorSearch: $('#vendor-search'),
  importBtn: $('#import-btn'),
  resetBtn: $('#reset-btn'),
  settingsBtn: $('#settings-btn'),
  guide: $('#guide'),
  guideDismiss: $('#guide-dismiss'),
  guideText: $('#guide-text'),
  tableHead: document.querySelectorAll('#pricing-table thead th'),
  tableBody: $('#table-body'),
  emptyState: $('#empty-state'),
  prevPage: $('#prev-page'),
  nextPage: $('#next-page'),
  paginationInfo: $('#pagination-info'),
  commentDrawer: $('#comment-drawer'),
  drawerTitle: $('#drawer-title'),
  drawerClose: $('#drawer-close'),
  commentList: $('#comment-list'),
  commentForm: $('#comment-form'),
  commentNickname: $('#comment-nickname'),
  commentContent: $('#comment-content'),
  commentSubmit: $('#comment-submit'),
  commentExport: $('#comment-export'),
  commentFormTitle: $('#comment-form-title'),
  commentNicknameLabel: $('#comment-nickname-label'),
  commentContentLabel: $('#comment-content-label'),
  toast: $('#toast'),
  settingsModal: $('#settings-modal'),
  settingsTitle: $('#settings-title'),
  settingsForm: $('#settings-form'),
  settingsClose: $('#settings-close'),
  settingsSave: $('#settings-save'),
  settingsCancel: $('#settings-cancel'),
  settingsReset: $('#settings-reset'),
  rateInput: $('#rate-input'),
  settingsRateLabel: $('#settings-rate-label'),
  importModal: $('#import-modal'),
  importTitle: $('#import-title'),
  importDesc: $('#import-desc'),
  importClose: $('#import-close'),
  importSelect: $('#import-select'),
  importCancel: $('#import-cancel'),
  importFile: $('#import-file'),
  toastContainer: $('#toast')
};

const columnMap = {
  '厂商': 'vendor',
  '模型名称': 'model',
  '官方输入价格/M token': 'input_per_million',
  '官方输出价格/M token': 'output_per_million',
  '模型说明': 'desc',
  '温度范围': 'temp_range',
  '默认温度': 'temp_default',
  '模型地区': 'region',
  '是否常用模型': 'is_common',
  '是否收藏': 'is_favorite',
  'vendor': 'vendor',
  'model': 'model',
  'input_per_million': 'input_per_million',
  'output_per_million': 'output_per_million',
  'desc': 'desc',
  'temp_range': 'temp_range',
  'temp_default': 'temp_default',
  'region': 'region',
  'is_common': 'is_common',
  'is_favorite': 'is_favorite'
};

init();

async function init() {
  try {
    await loadI18n();
    await loadData();
    loadPrefs();
    loadFavorites();
    setupUI();
    applyPrefsToUI();
    renderVendors();
    applyFilters();
    maybeShowGuide();
  } catch (err) {
    console.error('Initialization failed', err);
    showToast('Failed to initialize app');
  }
}

async function loadI18n() {
  const [zh, en] = await Promise.all([
    loadJson('i18n/zh.json'),
    loadJson('i18n/en.json')
  ]);
  state.i18n.zh = zh;
  state.i18n.en = en;
}

async function loadData() {
  const data = await loadJson('data/official_pricing.json');
  state.officialData = data;
  state.data = data;
}

async function loadJson(path) {
  const isFileProtocol = window.location.protocol === 'file:';
  const url = new URL(path, window.location.href);

  try {
    const response = await fetch(url.href, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    if (isFileProtocol) {
      try {
        const moduleUrl = new URL(path, import.meta.url).href;
        const module = await import(/* @vite-ignore */ moduleUrl, {
          assert: { type: 'json' }
        });
        return module.default || module;
      } catch (moduleErr) {
        console.error('JSON module fallback failed', moduleErr);
      }
    }
    console.error(`Failed to load ${path}`, err);
    throw err;
  }
}


function loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.prefs) || 'null');
    if (saved && typeof saved === 'object') {
      state.prefs = { ...defaultPrefs, ...saved };
    } else {
      state.prefs = { ...defaultPrefs };
    }
  } catch (err) {
    state.prefs = { ...defaultPrefs };
  }
  state.lang = state.prefs.lang;
  state.sortKey = state.prefs.sortKey;
  state.sortDir = state.prefs.sortDir;
  state.currentPage = state.prefs.page || 1;
  state.vendorSelections = state.prefs.vendorSelections;
}

function loadFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.favorites) || '[]');
    state.favorites = new Set(saved);
  } catch (err) {
    state.favorites = new Set();
  }
}

function setupUI() {
  elements.search.addEventListener('input', () => {
    state.prefs.search = elements.search.value;
    state.currentPage = 1;
    savePrefs();
    applyFilters();
  });

  elements.favoritesToggle.addEventListener('click', () => {
    state.prefs.onlyFavorites = !state.prefs.onlyFavorites;
    savePrefs();
    applyToggleState(elements.favoritesToggle, state.prefs.onlyFavorites);
    applyFilters();
  });

  elements.commonToggle.addEventListener('click', () => {
    state.prefs.onlyCommon = !state.prefs.onlyCommon;
    savePrefs();
    applyToggleState(elements.commonToggle, state.prefs.onlyCommon);
    applyFilters();
  });

  elements.currencyToggle.addEventListener('click', () => {
    state.prefs.currency = state.prefs.currency === 'CNY' ? 'USD' : 'CNY';
    savePrefs();
    applyCurrencyUnitLabels();
    applyFilters();
  });

  elements.unitToggle.addEventListener('click', () => {
    state.prefs.unit = state.prefs.unit === 'perMillion' ? 'perThousand' : 'perMillion';
    savePrefs();
    applyCurrencyUnitLabels();
    applyFilters();
  });

  elements.langToggle.addEventListener('click', () => {
    state.lang = state.lang === 'zh' ? 'en' : 'zh';
    state.prefs.lang = state.lang;
    savePrefs();
    applyTranslations();
    applyCurrencyUnitLabels();
    renderVendors();
    applyFilters();
  });

  document.addEventListener('click', handleGlobalClick);
  elements.vendorFilterBtn.addEventListener('click', toggleVendorDropdown);
  elements.vendorSearch.addEventListener('input', () => {
    state.vendorSearch = elements.vendorSearch.value;
    renderVendorOptions();
  });
  elements.vendorOptions.addEventListener('change', handleVendorSelection);
  elements.vendorPanel.querySelectorAll('.dropdown-actions button').forEach(btn => {
    btn.addEventListener('click', handleVendorAction);
  });

  elements.tableHead.forEach(th => {
    const sortKey = th.dataset.sort;
    if (!sortKey || sortKey === 'favorite') return;
    th.addEventListener('click', () => handleSort(sortKey));
  });

  elements.prevPage.addEventListener('click', () => changePage(-1));
  elements.nextPage.addEventListener('click', () => changePage(1));

  elements.drawerClose.addEventListener('click', closeDrawer);
  elements.commentForm.addEventListener('submit', submitComment);
  elements.commentExport.addEventListener('click', exportComments);

  elements.settingsBtn.addEventListener('click', openSettings);
  elements.settingsClose.addEventListener('click', closeSettings);
  elements.settingsCancel.addEventListener('click', closeSettings);
  elements.settingsForm.addEventListener('submit', saveSettings);
  elements.settingsReset.addEventListener('click', resetSettings);

  elements.importBtn.addEventListener('click', openImportModal);
  elements.importClose.addEventListener('click', closeImportModal);
  elements.importCancel.addEventListener('click', closeImportModal);
  elements.importSelect.addEventListener('click', () => elements.importFile.click());
  elements.importFile.addEventListener('change', handleFileImport);

  elements.resetBtn.addEventListener('click', resetPreferences);
  elements.guideDismiss.addEventListener('click', () => {
    localStorage.setItem(STORAGE_KEYS.guide, '1');
    elements.guide.hidden = true;
  });
}

function applyPrefsToUI() {
  elements.search.value = state.prefs.search || '';
  applyToggleState(elements.favoritesToggle, state.prefs.onlyFavorites);
  applyToggleState(elements.commonToggle, state.prefs.onlyCommon);
  applyCurrencyUnitLabels();
  applyTranslations();
}

function applyTranslations() {
  const dict = state.i18n[state.lang] || state.i18n.zh;
  document.documentElement.lang = state.lang;
  elements.title.textContent = dict['title'];
  document.title = dict['title'];
  elements.search.placeholder = dict['search.placeholder'];
  elements.vendorFilterBtn.textContent = dict['filter.vendor'];
  elements.vendorSearch.placeholder = dict['filter.vendor.search'];
  elements.vendorSearch.setAttribute('aria-label', dict['filter.vendor.search']);
  elements.vendorPanel.querySelector('[data-action="select-all"]').textContent = dict['filter.vendor.selectAll'];
  elements.vendorPanel.querySelector('[data-action="clear-all"]').textContent = dict['filter.vendor.clear'];
  elements.vendorPanel.querySelector('[data-action="invert"]').textContent = dict['filter.vendor.invert'];
  elements.favoritesToggle.textContent = dict['toggle.favorites'];
  elements.commonToggle.textContent = dict['toggle.commons'];
  elements.currencyToggle.textContent = dict['toggle.currency'];
  elements.unitToggle.textContent = dict['toggle.unit'];
  elements.langToggle.textContent = dict['toggle.lang'];
  elements.importBtn.textContent = dict['action.import'];
  elements.resetBtn.textContent = dict['action.reset'];
  elements.settingsBtn.textContent = dict['settings.title'];
  elements.guideText.textContent = dict['guide.welcome'];
  elements.guideDismiss.textContent = dict['guide.dismiss'];
  elements.prevPage.textContent = dict['pagination.prev'];
  elements.nextPage.textContent = dict['pagination.next'];
  elements.emptyState.textContent = dict['noData'];
  elements.commentSubmit.textContent = dict['comment.submit'];
  elements.commentExport.textContent = dict['comment.export'];
  elements.commentFormTitle.textContent = dict['comment.add'];
  elements.commentNicknameLabel.textContent = dict['comment.nickname'];
  elements.commentContentLabel.textContent = dict['comment.content'];
  elements.settingsTitle.textContent = dict['settings.title'];
  elements.settingsSave.textContent = dict['settings.save'];
  elements.settingsCancel.textContent = dict['settings.close'];
  elements.settingsReset.textContent = dict['settings.reset'];
  elements.settingsRateLabel.textContent = dict['settings.rate'];
  elements.rateInput.placeholder = dict['settings.rate.placeholder'];
  elements.importTitle.textContent = dict['import.title'];
  elements.importDesc.textContent = dict['import.desc'];
  elements.importSelect.textContent = dict['import.select'];
  elements.importCancel.textContent = dict['import.cancel'];

  const headers = document.querySelectorAll('#pricing-table thead th');
  const headerKeys = [
    null,
    'table.vendor',
    'table.model',
    'table.input',
    'table.output',
    'table.currency',
    'table.unit',
    'table.tempRange',
    'table.tempDefault',
    'table.region',
    'table.desc',
    'table.actions'
  ];
  headers.forEach((th, idx) => {
    if (headerKeys[idx]) {
      th.textContent = dict[headerKeys[idx]];
    }
  });
}

function applyCurrencyUnitLabels() {
  const dict = state.i18n[state.lang] || state.i18n.zh;
  const currencyLabel = state.prefs.currency === 'CNY' ? dict['currency.cny'] : dict['currency.usd'];
  const unitLabel = state.prefs.unit === 'perMillion' ? dict['unit.perMillion'] : dict['unit.perThousand'];
  elements.currencyToggle.textContent = currencyLabel;
  elements.unitToggle.textContent = unitLabel;
}

function applyToggleState(button, active) {
  button.setAttribute('aria-pressed', active);
  if (active) {
    button.classList.add('active');
  } else {
    button.classList.remove('active');
  }
}

function renderVendors() {
  const source = state.useImported && Array.isArray(state.importedData) ? state.importedData : state.officialData;
  const vendors = Array.from(new Set(source.map(item => item.vendor))).sort();
  state.allVendors = vendors;
  renderVendorOptions();
  updateVendorButtonLabel();
}

function renderVendorOptions() {
  const dict = state.i18n[state.lang] || state.i18n.zh;
  const container = elements.vendorOptions;
  container.innerHTML = '';
  const filterText = (state.vendorSearch || '').toLowerCase();
  const selections = new Set(state.vendorSelections || []);
  state.allVendors
    .filter(v => v.toLowerCase().includes(filterText))
    .forEach(vendor => {
      const id = `vendor-${vendor.replace(/[^a-zA-Z0-9]/g, '')}`;
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = vendor;
      input.checked = !state.vendorSelections || selections.has(vendor);
      input.id = id;
      label.appendChild(input);
      const span = document.createElement('span');
      span.textContent = vendor;
      label.appendChild(span);
      container.appendChild(label);
    });
  if (!container.children.length) {
    const empty = document.createElement('div');
    empty.textContent = dict['noData'];
    empty.className = 'empty-state';
    container.appendChild(empty);
  }
}

function updateVendorButtonLabel() {
  const dict = state.i18n[state.lang] || state.i18n.zh;
  if (!state.vendorSelections || !state.vendorSelections.length) {
    elements.vendorFilterBtn.textContent = dict['filter.vendor'];
    return;
  }
  const total = state.allVendors.length;
  const selected = state.vendorSelections.length;
  elements.vendorFilterBtn.textContent = `${dict['filter.vendor']} (${selected}/${total})`;
}

function handleVendorSelection() {
  const checked = Array.from(elements.vendorOptions.querySelectorAll('input:checked')).map(i => i.value);
  state.vendorSelections = checked.length === state.allVendors.length ? null : checked;
  state.prefs.vendorSelections = state.vendorSelections;
  state.currentPage = 1;
  savePrefs();
  updateVendorButtonLabel();
  applyFilters();
}

function handleVendorAction(event) {
  const action = event.target.dataset.action;
  const inputs = elements.vendorOptions.querySelectorAll('input');
  if (!inputs.length) return;
  if (action === 'select-all') {
    inputs.forEach(input => (input.checked = true));
    state.vendorSelections = null;
  } else if (action === 'clear-all') {
    inputs.forEach(input => (input.checked = false));
    state.vendorSelections = [];
  } else if (action === 'invert') {
    const selections = [];
    inputs.forEach(input => {
      input.checked = !input.checked;
      if (input.checked) selections.push(input.value);
    });
    state.vendorSelections = selections.length === inputs.length ? null : selections;
  }
  state.prefs.vendorSelections = state.vendorSelections;
  state.currentPage = 1;
  savePrefs();
  updateVendorButtonLabel();
  applyFilters();
}

function toggleVendorDropdown(event) {
  event.stopPropagation();
  state.vendorFilterOpen = !state.vendorFilterOpen;
  elements.vendorPanel.setAttribute('aria-hidden', !state.vendorFilterOpen);
  elements.vendorFilterBtn.setAttribute('aria-expanded', state.vendorFilterOpen);
}

function handleGlobalClick(event) {
  if (!elements.vendorFilter.contains(event.target)) {
    state.vendorFilterOpen = false;
    elements.vendorPanel.setAttribute('aria-hidden', 'true');
    elements.vendorFilterBtn.setAttribute('aria-expanded', 'false');
  }
}

function applyFilters() {
  const prefs = state.prefs;
  const langDict = state.i18n[state.lang] || state.i18n.zh;
  const vendorSet = prefs.vendorSelections ? new Set(prefs.vendorSelections) : null;
  const searchTerm = (prefs.search || '').toLowerCase();
  const source = state.useImported && Array.isArray(state.importedData) ? state.importedData : state.officialData;
  state.data = source.filter(item => {
    if (vendorSet && !vendorSet.has(item.vendor)) return false;
    if (prefs.onlyFavorites && !state.favorites.has(item.id)) return false;
    if (prefs.onlyCommon && !item.is_common) return false;
    if (searchTerm) {
      const haystack = `${item.vendor} ${item.model}`.toLowerCase();
      if (!haystack.includes(searchTerm)) return false;
    }
    return true;
  });

  applySort();
  const totalPages = Math.max(1, Math.ceil(state.data.length / state.perPage));
  if (state.currentPage > totalPages) {
    state.currentPage = totalPages;
  }
  if (state.currentPage < 1) {
    state.currentPage = 1;
  }
  state.prefs.page = state.currentPage;
  savePrefs();
  const start = (state.currentPage - 1) * state.perPage;
  const end = start + state.perPage;
  const pageItems = state.data.slice(start, end);
  renderTable(pageItems);
  elements.emptyState.hidden = state.data.length > 0;
  const infoTemplate = dictFormat(langDict['pagination.page'], {
    page: state.currentPage,
    total: Math.max(1, Math.ceil(state.data.length / state.perPage))
  });
  elements.paginationInfo.textContent = infoTemplate;
  elements.prevPage.disabled = state.currentPage <= 1;
  elements.nextPage.disabled = state.currentPage >= Math.ceil(state.data.length / state.perPage);
  updateVendorButtonLabel();
}

function dictFormat(template, vars) {
  if (!template) return '';
  return template.replace(/\{(.*?)\}/g, (_, key) => vars[key] ?? '');
}

function applySort() {
  const key = state.sortKey;
  const dir = state.sortDir === 'asc' ? 1 : -1;
  state.data.sort((a, b) => {
    let av;
    let bv;
    switch (key) {
      case 'vendor':
        av = a.vendor.toLowerCase();
        bv = b.vendor.toLowerCase();
        break;
      case 'model':
        av = a.model.toLowerCase();
        bv = b.model.toLowerCase();
        break;
      case 'input':
        av = a.input_per_million ?? Infinity;
        bv = b.input_per_million ?? Infinity;
        break;
      case 'output':
        av = a.output_per_million ?? Infinity;
        bv = b.output_per_million ?? Infinity;
        break;
      case 'tempDefault':
        av = a.temp_default ?? Infinity;
        bv = b.temp_default ?? Infinity;
        break;
      case 'region':
        av = a.region || '';
        bv = b.region || '';
        break;
      default:
        av = a.vendor.toLowerCase();
        bv = b.vendor.toLowerCase();
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

function handleSort(key) {
  if (state.sortKey === key) {
    state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    state.sortKey = key;
    state.sortDir = 'asc';
  }
  state.prefs.sortKey = state.sortKey;
  state.prefs.sortDir = state.sortDir;
  savePrefs();
  updateSortIndicators();
  applyFilters();
}

function updateSortIndicators() {
  document.querySelectorAll('#pricing-table thead th').forEach(th => {
    const sortKey = th.dataset.sort;
    if (!sortKey || sortKey === 'favorite') {
      th.setAttribute('aria-sort', 'none');
      return;
    }
    if (sortKey === state.sortKey) {
      th.setAttribute('aria-sort', state.sortDir === 'asc' ? 'ascending' : 'descending');
    } else {
      th.setAttribute('aria-sort', 'none');
    }
  });
}

function renderTable(items) {
  const dict = state.i18n[state.lang] || state.i18n.zh;
  elements.tableBody.innerHTML = '';
  items.forEach(item => {
    const tr = document.createElement('tr');

    const favTd = document.createElement('td');
    const star = document.createElement('button');
    star.type = 'button';
    star.className = 'favorite-toggle';
    const isFav = state.favorites.has(item.id);
    star.textContent = isFav ? '★' : '☆';
    star.setAttribute('aria-label', `${dict['table.favorite']} ${item.model}`);
    star.addEventListener('click', () => toggleFavorite(item));
    favTd.appendChild(star);
    tr.appendChild(favTd);

    const vendorTd = document.createElement('td');
    vendorTd.textContent = item.vendor;
    if (item.is_common) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = dict['toggle.commons'];
      vendorTd.appendChild(document.createElement('br'));
      vendorTd.appendChild(badge);
    }
    tr.appendChild(vendorTd);

    const modelTd = document.createElement('td');
    modelTd.textContent = item.model;
    tr.appendChild(modelTd);

    const inputTd = document.createElement('td');
    inputTd.textContent = formatPrice(item.input_per_million);
    tr.appendChild(inputTd);

    const outputTd = document.createElement('td');
    outputTd.textContent = formatPrice(item.output_per_million);
    tr.appendChild(outputTd);

    const currencyTd = document.createElement('td');
    currencyTd.textContent = state.prefs.currency;
    tr.appendChild(currencyTd);

    const unitTd = document.createElement('td');
    unitTd.textContent = state.prefs.unit === 'perMillion' ? dict['unit.perMillion'] : dict['unit.perThousand'];
    tr.appendChild(unitTd);

    const rangeTd = document.createElement('td');
    rangeTd.textContent = formatRange(item.temp_range);
    tr.appendChild(rangeTd);

    const defaultTd = document.createElement('td');
    defaultTd.textContent = item.temp_default ?? '—';
    tr.appendChild(defaultTd);

    const regionTd = document.createElement('td');
    regionTd.textContent = item.region || '—';
    tr.appendChild(regionTd);

    const descTd = document.createElement('td');
    const desc = document.createElement('div');
    desc.className = 'desc';
    const full = item.desc || '';
    if (full.length > 140) {
      const short = full.slice(0, 140) + '…';
      const span = document.createElement('span');
      span.textContent = short;
      const toggle = document.createElement('button');
      toggle.textContent = dict['table.desc.more'];
      toggle.addEventListener('click', () => {
        const expanded = toggle.dataset.expanded === '1';
        toggle.dataset.expanded = expanded ? '0' : '1';
        span.textContent = expanded ? short : full;
        toggle.textContent = expanded ? dict['table.desc.more'] : dict['table.desc.less'];
      });
      desc.appendChild(span);
      desc.appendChild(document.createElement('br'));
      desc.appendChild(toggle);
    } else {
      desc.textContent = full || '—';
    }
    descTd.appendChild(desc);
    tr.appendChild(descTd);

    const actionsTd = document.createElement('td');
    const commentBtn = document.createElement('button');
    commentBtn.className = 'btn secondary';
    commentBtn.textContent = dict['action.comment'];
    commentBtn.addEventListener('click', () => openDrawer(item));
    actionsTd.appendChild(commentBtn);
    tr.appendChild(actionsTd);

    elements.tableBody.appendChild(tr);
  });
  updateSortIndicators();
}

function formatPrice(value) {
  if (typeof value !== 'number') return '—';
  const rate = Number(state.prefs.rate) || defaultPrefs.rate;
  const currency = state.prefs.currency;
  const unit = state.prefs.unit;
  let amount = value;
  if (currency === 'USD') {
    amount = rate ? amount / rate : amount;
  }
  if (unit === 'perThousand') {
    amount = amount / 1000;
  }
  return amount.toFixed(4);
}

function formatRange(range) {
  if (!Array.isArray(range) || range.length < 2) return '—';
  return `${range[0]} - ${range[1]}`;
}

function toggleFavorite(item) {
  if (state.favorites.has(item.id)) {
    state.favorites.delete(item.id);
  } else {
    state.favorites.add(item.id);
  }
  localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(Array.from(state.favorites)));
  applyFilters();
}

function changePage(delta) {
  const totalPages = Math.max(1, Math.ceil(state.data.length / state.perPage));
  state.currentPage = Math.min(totalPages, Math.max(1, state.currentPage + delta));
  state.prefs.page = state.currentPage;
  savePrefs();
  applyFilters();
}

function openDrawer(item) {
  state.drawerTarget = item;
  const dict = state.i18n[state.lang] || state.i18n.zh;
  elements.drawerTitle.textContent = `${item.vendor} / ${item.model}`;
  elements.commentNickname.value = '';
  elements.commentContent.value = '';
  renderComments();
  elements.commentDrawer.setAttribute('aria-hidden', 'false');
}

function closeDrawer() {
  elements.commentDrawer.setAttribute('aria-hidden', 'true');
  state.drawerTarget = null;
}

function getCommentKey(item) {
  return `${COMMENT_PREFIX}${item.vendor}::${item.model}`;
}

function getComments(item) {
  try {
    const raw = localStorage.getItem(getCommentKey(item));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function saveComments(item, comments) {
  localStorage.setItem(getCommentKey(item), JSON.stringify(comments));
}

function renderComments() {
  const dict = state.i18n[state.lang] || state.i18n.zh;
  const target = state.drawerTarget;
  if (!target) return;
  const comments = getComments(target);
  elements.commentList.innerHTML = '';
  if (!comments.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = dict['comment.empty'];
    elements.commentList.appendChild(empty);
  } else {
    comments.forEach((comment, idx) => {
      const item = document.createElement('article');
      item.className = 'comment-item';
      const header = document.createElement('header');
      const name = document.createElement('strong');
      name.textContent = comment.nickname || dict['comment.anonymous'];
      const time = document.createElement('span');
      const date = new Date(comment.createdAt);
      time.textContent = date.toLocaleString();
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-small secondary';
      deleteBtn.textContent = dict['comment.delete'];
      deleteBtn.addEventListener('click', () => deleteComment(idx));
      header.appendChild(name);
      header.appendChild(time);
      header.appendChild(deleteBtn);
      const body = document.createElement('p');
      body.textContent = comment.content;
      item.appendChild(header);
      item.appendChild(body);
      elements.commentList.appendChild(item);
    });
  }
}

function submitComment(event) {
  event.preventDefault();
  const dict = state.i18n[state.lang] || state.i18n.zh;
  const target = state.drawerTarget;
  if (!target) return;
  const content = elements.commentContent.value.trim();
  if (!content) {
    showToast(dict['toast.commentRequired']);
    return;
  }
  const nickname = elements.commentNickname.value.trim();
  const comments = getComments(target);
  comments.unshift({
    nickname,
    content,
    createdAt: Date.now()
  });
  saveComments(target, comments);
  elements.commentContent.value = '';
  elements.commentNickname.value = '';
  renderComments();
  showToast(dict['toast.commentAdded']);
}

function deleteComment(index) {
  const dict = state.i18n[state.lang] || state.i18n.zh;
  const target = state.drawerTarget;
  if (!target) return;
  const comments = getComments(target);
  comments.splice(index, 1);
  saveComments(target, comments);
  renderComments();
  showToast(dict['toast.commentDeleted']);
}

function exportComments() {
  const target = state.drawerTarget;
  if (!target) return;
  const dict = state.i18n[state.lang] || state.i18n.zh;
  const comments = getComments(target);
  const safeBase = `${target.vendor}-${target.model}`.replace(/[\\\s/:*?"<>|]/g, '_');
  const fileName = `${safeBase}-${dict['comment.export.filename']}.json`;
  const blob = new Blob([JSON.stringify(comments, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function showToast(message) {
  const toast = elements.toast;
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    toast.hidden = true;
  }, 3200);
}

function openSettings() {
  elements.rateInput.value = state.prefs.rate ?? defaultPrefs.rate;
  elements.settingsModal.setAttribute('aria-hidden', 'false');
}

function closeSettings() {
  elements.settingsModal.setAttribute('aria-hidden', 'true');
}

function saveSettings(event) {
  event.preventDefault();
  const dict = state.i18n[state.lang] || state.i18n.zh;
  const value = Number(elements.rateInput.value);
  if (!value || value <= 0) {
    showToast(dict['toast.rateInvalid']);
    return;
  }
  state.prefs.rate = value;
  savePrefs();
  closeSettings();
  showToast(dict['toast.saved']);
  applyFilters();
}

function resetSettings() {
  state.prefs.rate = defaultPrefs.rate;
  elements.rateInput.value = state.prefs.rate;
}

function openImportModal() {
  elements.importModal.setAttribute('aria-hidden', 'false');
}

function closeImportModal() {
  elements.importModal.setAttribute('aria-hidden', 'true');
  elements.importFile.value = '';
}

async function handleFileImport(event) {
  const dict = state.i18n[state.lang] || state.i18n.zh;
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
    const mapped = rows
      .map(row => normalizeRow(row))
      .filter(Boolean);
    if (!mapped.length) throw new Error('No valid rows');
    state.importedData = mapped;
    state.useImported = true;
    state.currentPage = 1;
    closeImportModal();
    renderVendors();
    applyFilters();
    showToast(dict['toast.imported']);
  } catch (err) {
    console.error(err);
    showToast(dict['toast.parseError']);
  }
}

function normalizeRow(row) {
  const normalized = {};
  for (const key in row) {
    const trimmedKey = key.trim();
    const mappedKey = columnMap[trimmedKey];
    if (mappedKey) {
      normalized[mappedKey] = row[key];
    }
  }
  if (!normalized.vendor || !normalized.model) return null;
  const vendor = String(normalized.vendor).trim();
  const model = String(normalized.model).trim();
  const input = parsePrice(normalized.input_per_million);
  const output = parsePrice(normalized.output_per_million);
  const tempRange = parseTempRange(normalized.temp_range);
  const tempDefault = parseNumber(normalized.temp_default);
  const region = normalized.region ? String(normalized.region).trim() : '';
  const isCommon = parseBoolean(normalized.is_common);
  const isFavorite = parseBoolean(normalized.is_favorite);
  const desc = (normalized.desc || '').toString().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return {
    id: `${vendor}::${model}`,
    vendor,
    model,
    currency: 'CNY',
    input_per_million: input,
    output_per_million: output,
    desc,
    temp_range: tempRange,
    temp_default: tempDefault,
    region,
    is_common: isCommon,
    is_favorite: isFavorite
  };
}

function parsePrice(value) {
  if (value === undefined || value === null) return null;
  const cleaned = String(value).replace(/[^0-9.\-]/g, '').trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function parseTempRange(value) {
  if (!value) return [];
  const text = String(value).replace(/[\[\]()（）]/g, '');
  const parts = text.split(/[-–~]/).map(p => Number(p.trim())).filter(n => !Number.isNaN(n));
  if (!parts.length) return [];
  if (parts.length === 1) return [parts[0], parts[0]];
  return parts.slice(0, 2);
}

function parseNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(String(value).trim());
  return Number.isFinite(num) ? num : null;
}

function parseBoolean(value) {
  if (value === undefined || value === null) return false;
  const text = String(value).trim().toLowerCase();
  return ['是', 'yes', 'true', 'y', '1'].includes(text);
}

function resetPreferences() {
  const dict = state.i18n[state.lang] || state.i18n.zh;
  state.prefs = { ...defaultPrefs, lang: state.lang };
  state.currentPage = 1;
  state.sortKey = defaultPrefs.sortKey;
  state.sortDir = defaultPrefs.sortDir;
  state.vendorSelections = null;
  state.useImported = false;
  state.importedData = null;
  elements.importFile.value = '';
  savePrefs();
  applyPrefsToUI();
  renderVendors();
  applyFilters();
  showToast(dict['toast.cleared']);
}

function savePrefs() {
  localStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify({
    ...state.prefs,
    lang: state.lang,
    vendorSelections: state.vendorSelections
  }));
}

function maybeShowGuide() {
  const dismissed = localStorage.getItem(STORAGE_KEYS.guide);
  elements.guide.hidden = !!dismissed;
}
