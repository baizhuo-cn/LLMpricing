import { shouldShowToolbar, isPricingRoute } from './modules/uiLogic.js';
import { tokenize } from './modules/token-utils.js';
import {
  loadHistory as loadCalcHistory,
  saveHistory as persistCalcHistory,
  buildHistoryEntries,
  mergeHistory,
  clearHistory as resetCalcHistory
} from './modules/calc-history.js';

window.LLMpricing = window.LLMpricing || {};
const App = window.LLMpricing;
App.jsonCache = App.jsonCache || new Map();
const JSON_CACHE = App.jsonCache;

if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
  try {
    const officialUrl = new URL('data/official_pricing.json', window.location.href).href;
    if (!JSON_CACHE.has(officialUrl)) {
      const prefetchPromise = window
        .fetch(officialUrl, { cache: 'force-cache' })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          JSON_CACHE.set(officialUrl, data);
          return data;
        })
        .catch(err => {
          JSON_CACHE.delete(officialUrl);
          console.warn('Prefetch official pricing failed', err);
          throw err;
        });
      JSON_CACHE.set(officialUrl, prefetchPromise);
    }
  } catch (err) {
    console.warn('Unable to prefetch official pricing', err);
  }
}

const STORAGE_KEYS = {
  prefs: 'prefs_v1',
  favorites: 'fav_models_v1',
  guide: 'guide_dismissed_v1',
  scenarios: 'calc_scenarios_v1',
  calcLast: 'calc_last_v1',
  pricingSort: 'pricing_sort_v1',
  compare: 'compare_selections_v1',
  calcHistory: 'calc_history_v1'
};

const SCENARIO_STORAGE_VERSION = 1;
const TOKEN_LIMIT = 200000;
const TOKEN_DEBOUNCE_MS = 300;
const MAX_COMPARE_MODELS = 4;
const MIN_COMPARE_MODELS = 2;
const DEFAULT_CALC_SCENARIO = {
  id: '',
  name: '',
  period: 'day',
  calls: 0,
  avg_prompt_tokens: 0,
  avg_completion_tokens: 0,
  lang: 'zh',
  modelIds: [],
  mode: 'manual',
  textSamples: { prompt: '', completion: '' }
};

const DAYS_PER_MONTH = 30;
const ROUTES = ['#/', '#/calc'];

function cloneScenario(data = {}) {
  return {
    ...DEFAULT_CALC_SCENARIO,
    ...data,
    mode: data.mode === 'text' ? 'text' : DEFAULT_CALC_SCENARIO.mode,
    modelIds: Array.isArray(data.modelIds) ? [...data.modelIds] : [],
    textSamples: {
      ...DEFAULT_CALC_SCENARIO.textSamples,
      ...(typeof data.textSamples === 'object' ? data.textSamples : {})
    }
  };
}

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
  toastTimer: null,
  route: '#/',
  pricingSort: { field: 'input', direction: 'asc' },
  compare: new Set(),
  calc: {
    scenarios: [],
    currentScenario: { ...DEFAULT_CALC_SCENARIO },
    mode: 'manual',
    textSamples: { prompt: '', completion: '' },
    selectedModels: new Set(),
    rows: [],
    errors: [],
    contextWarnings: [],
    filterCommon: false,
    modelSearch: '',
    estimatedTokens: { prompt: 0, completion: 0, source: 'manual' },
    history: []
  }
};

let tokenEstimateTimer = null;
let tokenEstimateRequest = 0;

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
  toolbar: document.querySelector('.toolbar'),
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
  toastContainer: $('#toast'),
  navDashboard: $('#nav-dashboard'),
  navCalc: $('#nav-calc'),
  pages: document.querySelectorAll('.page'),
  pageDashboard: $('#page-dashboard'),
  pageCalc: $('#page-calc'),
  sortFieldLabel: $('#sort-field-label'),
  sortField: $('#sort-field'),
  sortFieldInputOption: $('#sort-field-input'),
  sortFieldOutputOption: $('#sort-field-output'),
  sortDirectionLabel: $('#sort-direction-label'),
  sortDirection: $('#sort-direction'),
  sortDirectionAscOption: $('#sort-direction-asc'),
  sortDirectionDescOption: $('#sort-direction-desc'),
  comparePanel: $('#compare-panel'),
  compareTitle: $('#compare-title'),
  compareHint: $('#compare-hint'),
  comparePlaceholder: $('#compare-placeholder'),
  compareGrid: $('#compare-grid'),
  calcForm: $('#calc-form'),
  calcTitle: $('#calc-title'),
  calcSubtitle: $('#calc-subtitle'),
  calcConfigTitle: $('#calc-config-title'),
  calcPeriodLabel: $('#calc-period-label'),
  calcPeriod: $('#calc-period'),
  calcPeriodDay: $('#calc-period-day'),
  calcPeriodMonth: $('#calc-period-month'),
  calcCallsLabel: $('#calc-calls-label'),
  calcCalls: $('#calc-calls'),
  calcModeLabel: $('#calc-mode-label'),
  calcModeManual: $('#calc-mode-manual'),
  calcModeManualLabel: $('#calc-mode-manual-label'),
  calcModeText: $('#calc-mode-text'),
  calcModeTextLabel: $('#calc-mode-text-label'),
  calcLangLabel: $('#calc-lang-label'),
  calcLang: $('#calc-lang'),
  calcLangZh: $('#calc-lang-zh'),
  calcLangEn: $('#calc-lang-en'),
  calcPromptLabel: $('#calc-prompt-label'),
  calcPrompt: $('#calc-prompt'),
  calcCompletionLabel: $('#calc-completion-label'),
  calcCompletion: $('#calc-completion'),
  calcTextPromptLabel: $('#calc-text-prompt-label'),
  calcTextPrompt: $('#calc-text-prompt'),
  calcTextCompletionLabel: $('#calc-text-completion-label'),
  calcTextCompletion: $('#calc-text-completion'),
  calcTextHint: $('#calc-text-hint'),
  calcManualFields: $('#calc-manual-fields'),
  calcTextFields: $('#calc-text-fields'),
  calcTokenWarning: $('#calc-token-warning'),
  calcPromptHint: $('#calc-prompt-hint'),
  calcCompletionHint: $('#calc-completion-hint'),
  calcTextPromptCount: $('#calc-text-prompt-count'),
  calcTextCompletionCount: $('#calc-text-completion-count'),
  calcModelLegend: $('#calc-model-legend'),
  calcModelSearchLabel: $('#calc-model-search-label'),
  calcModelSearch: $('#calc-model-search'),
  calcModelCommon: $('#calc-model-common'),
  calcModelCommonLabel: $('#calc-model-common-label'),
  calcModelOptions: $('#calc-model-options'),
  calcScenarioLegend: $('#calc-scenario-legend'),
  calcScenarioLabel: $('#calc-scenario-label'),
  calcScenarioSelect: $('#calc-scenario-select'),
  calcScenarioNone: $('#calc-scenario-none'),
  calcSave: $('#calc-save'),
  calcRename: $('#calc-rename'),
  calcDelete: $('#calc-delete'),
  calcErrors: $('#calc-errors'),
  calcCompute: $('#calc-compute'),
  calcExport: $('#calc-export'),
  calcResultsTitle: $('#calc-results-title'),
  calcResultsNote: $('#calc-results-note'),
  calcWarning: $('#calc-warning'),
  calcColModel: $('#calc-col-model'),
  calcColInput: $('#calc-col-input'),
  calcColOutput: $('#calc-col-output'),
  calcColUnit: $('#calc-col-unit'),
  calcColPerCall: $('#calc-col-percall'),
  calcColPeriod: $('#calc-col-period'),
  calcColMonth: $('#calc-col-month'),
  calcColDiff: $('#calc-col-diff'),
  calcResultsBody: $('#calc-results-body'),
  calcResultsEmpty: $('#calc-results-empty'),
  calcDisclaimer: $('#calc-disclaimer'),
  calcHistoryTitle: $('#calc-history-title'),
  calcHistoryEmpty: $('#calc-history-empty'),
  calcHistoryList: $('#calc-history-list'),
  calcHistoryExport: $('#calc-history-export'),
  calcHistoryClear: $('#calc-history-clear')
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
    loadPricingSortPreference();
    loadFavorites();
    loadCompareSelections();
    loadCalcStorage();
    setupUI();
    App.setupCalcUI();
    setupRouting();
    applyPrefsToUI();
    renderVendors();
    applyFilters();
    renderCalcModelOptions();
    renderCalcScenarioOptions();
    renderCalcResults();
    renderCalcHistory();
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
  const cacheKey = url.href;

  if (JSON_CACHE.has(cacheKey)) {
    const cached = JSON_CACHE.get(cacheKey);
    if (cached instanceof Promise) {
      return cached;
    }
    return cached;
  }

  const fetchPromise = fetch(url.href, { cache: 'no-store' })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      JSON_CACHE.set(cacheKey, data);
      return data;
    })
    .catch(async err => {
      JSON_CACHE.delete(cacheKey);
      if (isFileProtocol) {
        try {
          const moduleUrl = new URL(path, import.meta.url).href;
          const module = await import(/* @vite-ignore */ moduleUrl, {
            assert: { type: 'json' }
          });
          const jsonData = module.default || module;
          JSON_CACHE.set(cacheKey, jsonData);
          return jsonData;
        } catch (moduleErr) {
          console.error('JSON module fallback failed', moduleErr);
        }
      }
      console.error(`Failed to load ${path}`, err);
      throw err;
    });

  JSON_CACHE.set(cacheKey, fetchPromise);
  return fetchPromise;
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

function loadPricingSortPreference() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.pricingSort) || 'null');
    if (saved && typeof saved === 'object') {
      state.pricingSort = {
        field: saved.field === 'output' ? 'output' : 'input',
        direction: saved.direction === 'desc' ? 'desc' : 'asc'
      };
    }
  } catch (err) {
    state.pricingSort = { field: 'input', direction: 'asc' };
  }
  if (!state.pricingSort || !state.pricingSort.field) {
    state.pricingSort = { field: 'input', direction: 'asc' };
  }
  state.sortKey = state.pricingSort.field === 'output' ? 'output' : 'input';
  state.sortDir = state.pricingSort.direction === 'desc' ? 'desc' : 'asc';
  state.prefs.sortKey = state.sortKey;
  state.prefs.sortDir = state.sortDir;
}

function savePricingSortPreference() {
  try {
    localStorage.setItem(STORAGE_KEYS.pricingSort, JSON.stringify(state.pricingSort));
  } catch (err) {
    console.warn('Failed to persist pricing sort', err);
  }
}

function loadFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.favorites) || '[]');
    state.favorites = new Set(saved);
  } catch (err) {
    state.favorites = new Set();
  }
}

function loadCompareSelections() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.compare) || '[]');
    if (Array.isArray(saved)) {
      state.compare = new Set(saved.filter(id => typeof id === 'string' && id));
      return;
    }
  } catch (err) {
    // noop
  }
  state.compare = new Set();
}

function saveCompareSelections() {
  try {
    localStorage.setItem(STORAGE_KEYS.compare, JSON.stringify(Array.from(state.compare)));
  } catch (err) {
    console.warn('Failed to persist compare selections', err);
  }
}

function loadCalcStorage() {
  const calcState = state.calc;
  calcState.selectedModels = new Set(calcState.selectedModels || []);
  calcState.scenarios = [];
  calcState.currentScenario = { ...DEFAULT_CALC_SCENARIO };
  calcState.mode = 'manual';
  calcState.textSamples = { prompt: '', completion: '' };
  calcState.errors = [];
  calcState.contextWarnings = [];
  calcState.filterCommon = false;
  calcState.modelSearch = '';
  calcState.history = loadCalcHistory();
  calcState.estimatedTokens = { prompt: 0, completion: 0, source: 'manual' };

  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.scenarios) || 'null');
    if (raw && typeof raw === 'object' && raw.version === SCENARIO_STORAGE_VERSION && Array.isArray(raw.items)) {
      calcState.scenarios = raw.items.map(item => cloneScenario(item));
    }
  } catch (err) {
    calcState.scenarios = [];
  }

  try {
    const rawLast = JSON.parse(localStorage.getItem(STORAGE_KEYS.calcLast) || 'null');
    if (rawLast && typeof rawLast === 'object') {
      const scenario = cloneScenario({ ...rawLast.scenario, mode: rawLast.mode === 'text' ? 'text' : rawLast.scenario?.mode });
      calcState.currentScenario = scenario;
      calcState.mode = scenario.mode === 'text' ? 'text' : rawLast.mode === 'text' ? 'text' : 'manual';
      calcState.textSamples = {
        prompt: rawLast.textSamples?.prompt ?? scenario.textSamples.prompt ?? '',
        completion: rawLast.textSamples?.completion ?? scenario.textSamples.completion ?? ''
      };
      calcState.selectedModels = new Set(calcState.currentScenario.modelIds);
    }
  } catch (err) {
    calcState.currentScenario = cloneScenario();
    calcState.mode = 'manual';
    calcState.textSamples = { prompt: '', completion: '' };
    calcState.selectedModels = new Set();
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

  elements.sortField?.addEventListener('change', handleSortControlChange);
  elements.sortDirection?.addEventListener('change', handleSortControlChange);
}

App.setupCalcUI = function() {
  if (!elements.calcForm) return;
  const calcState = state.calc;

  const updateMode = mode => {
    calcState.mode = mode;
    calcState.currentScenario.mode = mode;
    const isManual = mode !== 'text';
    if (elements.calcManualFields) {
      elements.calcManualFields.hidden = !isManual;
      elements.calcManualFields.setAttribute('aria-hidden', isManual ? 'false' : 'true');
    }
    if (elements.calcTextFields) {
      elements.calcTextFields.hidden = isManual;
      elements.calcTextFields.setAttribute('aria-hidden', isManual ? 'true' : 'false');
    }
    if (isManual) {
      state.calc.estimatedTokens = {
        prompt: Number(calcState.currentScenario.avg_prompt_tokens) || 0,
        completion: Number(calcState.currentScenario.avg_completion_tokens) || 0,
        source: 'manual'
      };
      elements.calcPrompt?.focus();
    } else {
      scheduleTokenEstimation();
      elements.calcTextPrompt?.focus();
    }
    updateCalcTextHint();
    validateCalcForm();
    saveCalcLast();
  };

  elements.calcModeManual?.addEventListener('change', () => {
    if (elements.calcModeManual.checked) {
      updateMode('manual');
    }
  });

  elements.calcModeText?.addEventListener('change', () => {
    if (elements.calcModeText.checked) {
      updateMode('text');
    }
  });

  const numberBindings = [
    { el: elements.calcCalls, key: 'calls' },
    { el: elements.calcPrompt, key: 'avg_prompt_tokens' },
    { el: elements.calcCompletion, key: 'avg_completion_tokens' }
  ];

  numberBindings.forEach(({ el, key }) => {
    if (!el) return;
    el.addEventListener('input', () => {
      const value = parseNumber(el.value);
      calcState.currentScenario[key] = value != null ? value : null;
      if (calcState.mode === 'manual') {
        const targetKey = key === 'avg_prompt_tokens' ? 'prompt' : 'completion';
        state.calc.estimatedTokens[targetKey] = value != null ? Math.max(0, value) : 0;
        updateCalcTextHint();
      }
      validateCalcForm();
      saveCalcLast();
    });
  });

  elements.calcLang?.addEventListener('change', () => {
    calcState.currentScenario.lang = elements.calcLang.value || 'zh';
    if (calcState.mode === 'text') {
      scheduleTokenEstimation();
    }
    validateCalcForm();
    saveCalcLast();
  });

  elements.calcTextPrompt?.addEventListener('input', () => {
    calcState.textSamples.prompt = elements.calcTextPrompt.value;
    scheduleTokenEstimation();
    updateCalcTextHint();
    validateCalcForm();
    saveCalcLast();
  });

  elements.calcTextCompletion?.addEventListener('input', () => {
    calcState.textSamples.completion = elements.calcTextCompletion.value;
    scheduleTokenEstimation();
    updateCalcTextHint();
    validateCalcForm();
    saveCalcLast();
  });

  elements.calcPeriod?.addEventListener('change', () => {
    calcState.currentScenario.period = elements.calcPeriod.value === 'month' ? 'month' : 'day';
    validateCalcForm();
    saveCalcLast();
  });

  elements.calcModelSearch?.addEventListener('input', () => {
    calcState.modelSearch = elements.calcModelSearch.value || '';
    renderCalcModelOptions();
  });

  elements.calcModelCommon?.addEventListener('change', () => {
    calcState.filterCommon = !!elements.calcModelCommon.checked;
    renderCalcModelOptions();
  });

  elements.calcModelOptions?.addEventListener('change', event => {
    const target = event.target;
    if (target && target.matches('input[type="checkbox"][data-model-id]')) {
      const id = target.dataset.modelId;
      if (target.checked) {
        calcState.selectedModels.add(id);
      } else {
        calcState.selectedModels.delete(id);
      }
      calcState.currentScenario.modelIds = Array.from(calcState.selectedModels);
      if (calcState.mode === 'text') {
        scheduleTokenEstimation();
      }
      validateCalcForm();
      saveCalcLast();
    }
  });

  elements.calcScenarioSelect?.addEventListener('change', handleCalcScenarioSelect);
  elements.calcSave?.addEventListener('click', handleCalcScenarioSave);
  elements.calcRename?.addEventListener('click', handleCalcScenarioRename);
  elements.calcDelete?.addEventListener('click', handleCalcScenarioDelete);
  elements.calcCompute?.addEventListener('click', handleCalcCompute);
  elements.calcExport?.addEventListener('click', exportCalcResults);
  elements.calcHistoryExport?.addEventListener('click', exportCalcHistory);
  elements.calcHistoryClear?.addEventListener('click', handleCalcHistoryClear);

  syncCalcFormWithState();
  updateCalcTextHint();
  validateCalcForm();
};

function updateCalcTextHint() {
  const dict = state.i18n[state.lang] || state.i18n.zh;
  const estimates = state.calc.estimatedTokens || { prompt: 0, completion: 0 };
  const unit = dict['calc.text.estimateUnit'] || 'tokens';
  if (elements.calcPromptHint) {
    elements.calcPromptHint.textContent = dict['calc.token.promptUnit'] || '';
  }
  if (elements.calcCompletionHint) {
    elements.calcCompletionHint.textContent = dict['calc.token.completionUnit'] || '';
  }
  const promptLabel = dict['calc.text.promptEstimateLabel'] || '';
  const completionLabel = dict['calc.text.completionEstimateLabel'] || '';
  const promptValue = `${(estimates.prompt || 0).toLocaleString()} ${unit}`;
  const completionValue = `${(estimates.completion || 0).toLocaleString()} ${unit}`;
  if (elements.calcTextPromptCount) {
    elements.calcTextPromptCount.textContent = promptLabel
      ? `${promptLabel}: ${promptValue}`
      : promptValue;
  }
  if (elements.calcTextCompletionCount) {
    elements.calcTextCompletionCount.textContent = completionLabel
      ? `${completionLabel}: ${completionValue}`
      : completionValue;
  }
  if (elements.calcTextHint) {
    elements.calcTextHint.textContent = dict['calc.text.hint'] || '';
  }
}

function syncCalcFormWithState() {
  if (!elements.calcForm) return;
  const calcState = state.calc;
  const scenario = calcState.currentScenario;
  if (elements.calcModeManual) {
    elements.calcModeManual.checked = calcState.mode !== 'text';
  }
  if (elements.calcModeText) {
    elements.calcModeText.checked = calcState.mode === 'text';
  }
  const isManual = calcState.mode !== 'text';
  if (elements.calcManualFields) {
    elements.calcManualFields.hidden = !isManual;
    elements.calcManualFields.setAttribute('aria-hidden', isManual ? 'false' : 'true');
  }
  if (elements.calcTextFields) {
    elements.calcTextFields.hidden = isManual;
    elements.calcTextFields.setAttribute('aria-hidden', isManual ? 'true' : 'false');
  }
  if (elements.calcPeriod) {
    elements.calcPeriod.value = scenario.period === 'month' ? 'month' : 'day';
  }
  if (elements.calcCalls) {
    elements.calcCalls.value = scenario.calls != null ? scenario.calls : '';
  }
  if (elements.calcPrompt) {
    elements.calcPrompt.value = scenario.avg_prompt_tokens != null ? scenario.avg_prompt_tokens : '';
  }
  if (elements.calcCompletion) {
    elements.calcCompletion.value = scenario.avg_completion_tokens != null ? scenario.avg_completion_tokens : '';
  }
  if (elements.calcLang) {
    elements.calcLang.value = scenario.lang || 'zh';
  }
  if (elements.calcTextPrompt) {
    elements.calcTextPrompt.value = calcState.textSamples.prompt || scenario.textSamples?.prompt || '';
  }
  if (elements.calcTextCompletion) {
    elements.calcTextCompletion.value = calcState.textSamples.completion || scenario.textSamples?.completion || '';
  }
  if (elements.calcModelSearch) {
    elements.calcModelSearch.value = calcState.modelSearch || '';
  }
  if (elements.calcModelCommon) {
    elements.calcModelCommon.checked = !!calcState.filterCommon;
  }
  if (elements.calcScenarioSelect) {
    const currentId = scenario.id || '';
    elements.calcScenarioSelect.value = currentId && calcState.scenarios.some(s => s.id === currentId) ? currentId : '';
  }
  if (calcState.mode === 'text') {
    state.calc.estimatedTokens = state.calc.estimatedTokens || { prompt: 0, completion: 0, source: 'heuristic' };
  } else {
    state.calc.estimatedTokens = {
      prompt: Number(scenario.avg_prompt_tokens) || 0,
      completion: Number(scenario.avg_completion_tokens) || 0,
      source: 'manual'
    };
  }
  renderCalcModelOptions();
  renderCalcScenarioOptions();
  updateCalcTextHint();
  if (calcState.mode === 'text') {
    scheduleTokenEstimation();
  }
  validateCalcForm();
}

function validateCalcForm() {
  if (!elements.calcForm) return false;
  const dict = state.i18n[state.lang] || state.i18n.zh;
  const calcState = state.calc;
  const scenario = calcState.currentScenario;
  const errors = [];

  const calls = typeof scenario.calls === 'number' ? scenario.calls : parseNumber(scenario.calls);
  const validCalls = Number.isFinite(calls) && calls > 0;
  if (!validCalls) {
    errors.push(dict['calc.error.calls'] || 'Please provide a positive call volume.');
  }

  let promptTokens = typeof scenario.avg_prompt_tokens === 'number' ? scenario.avg_prompt_tokens : parseNumber(scenario.avg_prompt_tokens);
  let completionTokens = typeof scenario.avg_completion_tokens === 'number' ? scenario.avg_completion_tokens : parseNumber(scenario.avg_completion_tokens);

  if (calcState.mode === 'text') {
    const estimates = state.calc.estimatedTokens || { prompt: 0, completion: 0 };
    promptTokens = Number(estimates.prompt) || 0;
    completionTokens = Number(estimates.completion) || 0;
    scenario.avg_prompt_tokens = promptTokens;
    scenario.avg_completion_tokens = completionTokens;
    scenario.textSamples = { ...scenario.textSamples, ...calcState.textSamples };
    if (elements.calcPrompt) {
      elements.calcPrompt.value = promptTokens;
    }
    if (elements.calcCompletion) {
      elements.calcCompletion.value = completionTokens;
    }
  }

  const tokensValid = Number.isFinite(promptTokens) && promptTokens >= 0 && Number.isFinite(completionTokens) && completionTokens >= 0;
  if (!tokensValid) {
    errors.push(dict['calc.error.tokens'] || 'Token counts must be non-negative.');
  }

  const limitExceeded = updateTokenWarning(promptTokens, completionTokens);
  if (limitExceeded) {
    errors.push(dict['calc.token.limitExceeded'] || 'Token counts exceed supported limit.');
  }

  if (!calcState.selectedModels.size) {
    errors.push(dict['calc.error.noModels'] || 'Select at least one model.');
  }

  calcState.errors = errors;
  if (elements.calcErrors) {
    if (!errors.length) {
      elements.calcErrors.hidden = true;
      elements.calcErrors.textContent = '';
    } else {
      elements.calcErrors.hidden = false;
      elements.calcErrors.textContent = errors.join('\n');
    }
  }

  if (elements.calcCompute) {
    elements.calcCompute.disabled = errors.length > 0;
  }
  if (elements.calcExport) {
    elements.calcExport.disabled = !calcState.rows.length;
  }
  return errors.length === 0;
}

function updateTokenWarning(promptTokens, completionTokens) {
  if (!elements.calcTokenWarning) return false;
  const dict = state.i18n[state.lang] || state.i18n.zh;
  const exceeded = (Number(promptTokens) || 0) > TOKEN_LIMIT || (Number(completionTokens) || 0) > TOKEN_LIMIT;
  if (exceeded) {
    elements.calcTokenWarning.textContent = dict['calc.token.limitExceeded'] || '';
    elements.calcTokenWarning.hidden = false;
  } else {
    elements.calcTokenWarning.hidden = true;
    elements.calcTokenWarning.textContent = '';
  }
  return exceeded;
}

function renderCalcModelOptions() {
  if (!elements.calcModelOptions) return;
  const container = elements.calcModelOptions;
  const dict = state.i18n[state.lang] || state.i18n.zh;
  container.innerHTML = '';
  const models = getCalcModels();
  const search = (state.calc.modelSearch || '').toLowerCase();
  const onlyCommon = state.calc.filterCommon;
  const selected = state.calc.selectedModels;

  const filtered = models
    .filter(model => {
      if (onlyCommon && !model.is_common) return false;
      const id = getModelIdentifier(model);
      if (!id) return false;
      const text = `${model.vendor || ''} ${model.model || ''}`.toLowerCase();
      return !search || text.includes(search);
    })
    .sort((a, b) => {
      const av = `${a.vendor || ''}`.toLowerCase();
      const bv = `${b.vendor || ''}`.toLowerCase();
      if (av === bv) {
        return `${a.model || ''}`.toLowerCase().localeCompare(`${b.model || ''}`.toLowerCase());
      }
      return av.localeCompare(bv);
    });

  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = dict['noData'];
    container.appendChild(empty);
    return;
  }

  filtered.forEach(model => {
    const id = getModelIdentifier(model);
    const label = document.createElement('label');
    label.title = model.desc || '';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.modelId = id;
    checkbox.checked = selected.has(id);
    label.appendChild(checkbox);
    const text = document.createElement('span');
    const vendor = model.vendor || '';
    const name = model.model || model.id || id;
    text.textContent = vendor ? `${vendor} / ${name}` : name;
    label.appendChild(text);
    container.appendChild(label);
  });
}

function renderCalcScenarioOptions() {
  if (!elements.calcScenarioSelect) return;
  const select = elements.calcScenarioSelect;
  const currentValue = select.value;
  while (select.options.length > 1) {
    select.remove(1);
  }
  state.calc.scenarios.forEach(scenario => {
    const option = document.createElement('option');
    option.value = scenario.id;
    option.textContent = scenario.name || scenario.id;
    select.appendChild(option);
  });
  const scenarioId = state.calc.currentScenario.id;
  if (scenarioId && state.calc.scenarios.some(s => s.id === scenarioId)) {
    select.value = scenarioId;
  } else if (currentValue && state.calc.scenarios.some(s => s.id === currentValue)) {
    select.value = currentValue;
  } else {
    select.value = '';
  }
  updateScenarioButtonsState();
}

function updateScenarioButtonsState() {
  const hasSelection = !!(elements.calcScenarioSelect && elements.calcScenarioSelect.value);
  if (elements.calcRename) {
    elements.calcRename.disabled = !hasSelection;
  }
  if (elements.calcDelete) {
    elements.calcDelete.disabled = !hasSelection;
  }
}

function handleCalcScenarioSelect() {
  if (!elements.calcScenarioSelect) return;
  const id = elements.calcScenarioSelect.value;
  const scenario = id ? state.calc.scenarios.find(item => item.id === id) : null;
  if (scenario) {
    state.calc.currentScenario = cloneScenario(scenario);
    state.calc.mode = scenario.mode === 'text' ? 'text' : 'manual';
    state.calc.textSamples = { ...scenario.textSamples };
    state.calc.selectedModels = new Set(state.calc.currentScenario.modelIds);
  } else {
    state.calc.currentScenario = cloneScenario({
      ...state.calc.currentScenario,
      id: '',
      name: '',
      modelIds: Array.from(state.calc.selectedModels),
      mode: state.calc.mode,
      textSamples: { ...state.calc.textSamples }
    });
  }
  updateScenarioButtonsState();
  syncCalcFormWithState();
  saveCalcLast();
}

function handleCalcScenarioSave() {
  const dict = state.i18n[state.lang] || state.i18n.zh;
  if (!validateCalcForm()) {
    return;
  }
  const selectValue = elements.calcScenarioSelect?.value || '';
  let scenario;
  if (selectValue) {
    const idx = state.calc.scenarios.findIndex(item => item.id === selectValue);
    if (idx === -1) return;
    scenario = cloneScenario({
      ...state.calc.currentScenario,
      id: selectValue,
      name: state.calc.scenarios[idx].name,
      modelIds: Array.from(state.calc.selectedModels),
      mode: state.calc.mode,
      textSamples: { ...state.calc.textSamples }
    });
    state.calc.scenarios[idx] = scenario;
  } else {
    let name = prompt(dict['calc.scenario.prompt'] || 'Scenario name');
    if (name === null) return;
    name = name.trim();
    if (!name) {
      showToast(dict['calc.error.name'] || 'Please provide a name.');
      return;
    }
    scenario = cloneScenario({
      ...state.calc.currentScenario,
      id: `scn_${Date.now()}`,
      name,
      mode: state.calc.mode,
      modelIds: Array.from(state.calc.selectedModels),
      textSamples: { ...state.calc.textSamples }
    });
    state.calc.scenarios.push(scenario);
    elements.calcScenarioSelect.value = scenario.id;
  }
  state.calc.currentScenario = scenario;
  state.calc.selectedModels = new Set(scenario.modelIds);
  saveScenarios();
  renderCalcScenarioOptions();
  syncCalcFormWithState();
  saveCalcLast();
  showToast(dict['calc.template.saved'] || 'Scenario saved');
}

function handleCalcScenarioRename() {
  if (!elements.calcScenarioSelect || !elements.calcScenarioSelect.value) return;
  const dict = state.i18n[state.lang] || state.i18n.zh;
  const scenario = state.calc.scenarios.find(item => item.id === elements.calcScenarioSelect.value);
  if (!scenario) return;
  let name = prompt(dict['calc.scenario.renamePrompt'] || 'Rename scenario', scenario.name || '');
  if (name === null) return;
  name = name.trim();
  if (!name) {
    showToast(dict['calc.error.name'] || 'Please provide a name.');
    return;
  }
  scenario.name = name;
  if (state.calc.currentScenario.id === scenario.id) {
    state.calc.currentScenario.name = name;
  }
  saveScenarios();
  renderCalcScenarioOptions();
  saveCalcLast();
  showToast(dict['calc.template.renamed'] || 'Scenario renamed');
}

function handleCalcScenarioDelete() {
  if (!elements.calcScenarioSelect || !elements.calcScenarioSelect.value) return;
  const dict = state.i18n[state.lang] || state.i18n.zh;
  const id = elements.calcScenarioSelect.value;
  const confirmed = window.confirm(dict['calc.scenario.confirmDelete'] || 'Delete this scenario?');
  if (!confirmed) return;
  state.calc.scenarios = state.calc.scenarios.filter(item => item.id !== id);
  if (state.calc.currentScenario.id === id) {
    state.calc.currentScenario = cloneScenario();
    state.calc.selectedModels = new Set();
    state.calc.textSamples = { ...DEFAULT_CALC_SCENARIO.textSamples };
  }
  elements.calcScenarioSelect.value = '';
  saveScenarios();
  renderCalcScenarioOptions();
  syncCalcFormWithState();
  saveCalcLast();
  showToast(dict['calc.template.deleted'] || 'Scenario deleted');
}

function saveScenarios() {
  try {
    const payload = {
      version: SCENARIO_STORAGE_VERSION,
      items: state.calc.scenarios.map(item => ({
        ...item,
        modelIds: Array.from(item.modelIds || []),
        textSamples: { ...item.textSamples }
      }))
    };
    localStorage.setItem(STORAGE_KEYS.scenarios, JSON.stringify(payload));
  } catch (err) {
    console.warn('Failed to save scenarios', err);
  }
}

function saveCalcLast() {
  try {
    const payload = {
      mode: state.calc.mode,
      scenario: {
        ...state.calc.currentScenario,
        modelIds: Array.from(state.calc.selectedModels),
        textSamples: { ...state.calc.currentScenario.textSamples }
      },
      textSamples: { ...state.calc.textSamples }
    };
    localStorage.setItem(STORAGE_KEYS.calcLast, JSON.stringify(payload));
  } catch (err) {
    console.warn('Failed to persist calc state', err);
  }
}

function getPrimaryModelIdForEstimation() {
  if (state.calc.selectedModels && state.calc.selectedModels.size) {
    const [first] = state.calc.selectedModels;
    if (first) return first;
  }
  if (state.calc.currentScenario.modelIds && state.calc.currentScenario.modelIds.length) {
    return state.calc.currentScenario.modelIds[0];
  }
  const source = getCalcModels();
  if (Array.isArray(source) && source.length) {
    return getModelIdentifier(source[0]);
  }
  return '';
}

function scheduleTokenEstimation() {
  if (state.calc.mode !== 'text') return;
  const requestId = ++tokenEstimateRequest;
  clearTimeout(tokenEstimateTimer);
  tokenEstimateTimer = setTimeout(async () => {
    const scenario = state.calc.currentScenario;
    const lang = scenario.lang || 'zh';
    const modelId = getPrimaryModelIdForEstimation();
    try {
      const [promptResult, completionResult] = await Promise.all([
        tokenize(state.calc.textSamples.prompt || '', modelId, { lang }),
        tokenize(state.calc.textSamples.completion || '', modelId, { lang })
      ]);
      if (requestId !== tokenEstimateRequest) return;
      const promptTokens = Math.min(TOKEN_LIMIT, Math.max(0, promptResult.tokens || 0));
      const completionTokens = Math.min(TOKEN_LIMIT, Math.max(0, completionResult.tokens || 0));
      state.calc.estimatedTokens = {
        prompt: promptTokens,
        completion: completionTokens,
        source: completionResult.source || promptResult.source || 'heuristic'
      };
      scenario.avg_prompt_tokens = promptTokens;
      scenario.avg_completion_tokens = completionTokens;
      if (elements.calcPrompt) {
        elements.calcPrompt.value = promptTokens;
      }
      if (elements.calcCompletion) {
        elements.calcCompletion.value = completionTokens;
      }
      updateCalcTextHint();
      validateCalcForm();
    } catch (err) {
      console.warn('Token estimation failed', err);
      if (requestId !== tokenEstimateRequest) return;
      state.calc.estimatedTokens = { prompt: 0, completion: 0, source: 'error' };
      updateCalcTextHint();
      validateCalcForm();
    }
  }, TOKEN_DEBOUNCE_MS);
}

function getCalcModels() {
  const source = state.useImported && Array.isArray(state.importedData) ? state.importedData : state.officialData;
  return Array.isArray(source) ? source : [];
}

function getModelIdentifier(model) {
  if (!model) return null;
  if (model.id) return model.id;
  const vendor = model.vendor || '';
  const name = model.model || '';
  if (!vendor && !name) return null;
  return `${vendor}::${name}`;
}

function handleCalcCompute() {
  const dict = state.i18n[state.lang] || state.i18n.zh;
  if (!validateCalcForm()) {
    return;
  }
  const selectedIds = state.calc.selectedModels;
  const models = getCalcModels().filter(model => selectedIds.has(getModelIdentifier(model)));
  if (!models.length) {
    showToast(dict['calc.error.noModels'] || 'Select at least one model.');
    return;
  }
  const scenario = {
    ...state.calc.currentScenario,
    calls: Number(state.calc.currentScenario.calls) || 0,
    avg_prompt_tokens: Number(state.calc.currentScenario.avg_prompt_tokens) || 0,
    avg_completion_tokens: Number(state.calc.currentScenario.avg_completion_tokens) || 0,
    period: state.calc.currentScenario.period === 'month' ? 'month' : 'day',
    lang: state.calc.currentScenario.lang || 'zh'
  };
  const rate = Number(state.prefs.rate) || defaultPrefs.rate;
  const rows = computeCost(models, scenario, rate);
  state.calc.rows = rows;
  state.calc.contextWarnings = rows.filter(row => row.contextExceeded).map(row => row.displayName);
  renderCalcResults();
  saveCalcLast();
  recordCalcHistory(rows, scenario);
}

function computeCost(models, scenario, rate) {
  const promptTokens = Math.max(0, scenario.avg_prompt_tokens || 0);
  const completionTokens = Math.max(0, scenario.avg_completion_tokens || 0);
  const calls = Math.max(0, scenario.calls || 0);
  const totalTokensPerCall = promptTokens + completionTokens;
  const results = models.map(model => {
    const id = getModelIdentifier(model);
    const displayName = `${model.vendor} / ${model.model}`;
    const inputPricePer1KUSD = getPriceUSDPer1K(model, 'input', rate);
    const outputPricePer1KUSD = getPriceUSDPer1K(model, 'output', rate);
    const perCallUSD = (promptTokens / 1000) * inputPricePer1KUSD + (completionTokens / 1000) * outputPricePer1KUSD;
    const dayUSD = scenario.period === 'month' ? (perCallUSD * calls) / DAYS_PER_MONTH : perCallUSD * calls;
    const monthUSD = scenario.period === 'month' ? perCallUSD * calls : dayUSD * DAYS_PER_MONTH;
    const periodUSD = scenario.period === 'month' ? monthUSD : dayUSD;
    const unitCostUSDPerMillion = totalTokensPerCall > 0 ? (perCallUSD / totalTokensPerCall) * 1_000_000 : 0;
    const contextWindow = getContextWindow(model);
    const contextExceeded = typeof contextWindow === 'number' && contextWindow > 0 ? promptTokens > contextWindow : false;
    return {
      id,
      vendor: model.vendor,
      model: model.model,
      displayName,
      inputPricePer1KUSD,
      outputPricePer1KUSD,
      perCallUSD,
      dayUSD,
      monthUSD,
      periodUSD,
      unitCostUSDPerMillion,
      diffPct: 0,
      contextExceeded,
      contextWindow
    };
  });

  const minCost = results.reduce((min, row) => Math.min(min, row.periodUSD), Infinity);
  results.forEach(row => {
    row.diffPct = minCost > 0 ? ((row.periodUSD - minCost) / minCost) * 100 : 0;
  });
  results.sort((a, b) => {
    if (a.periodUSD === b.periodUSD) {
      return a.displayName.localeCompare(b.displayName);
    }
    return a.periodUSD - b.periodUSD;
  });
  return results;
}

function getPriceUSDPer1K(model, type, rate) {
  const perKKeys = [`${type}_price_per_1k_usd`, `${type}_price_per_1k`];
  for (const key of perKKeys) {
    if (typeof model[key] === 'number') {
      if (key.endsWith('_usd')) {
        return model[key];
      }
      let value = model[key];
      const currency = (model.currency || model.currency_code || 'USD').toString().toUpperCase();
      if (currency === 'CNY') {
        value = rate ? value / rate : value;
      }
      return value;
    }
  }
  const perMillionKeys = [`${type}_per_million_usd`, `${type}_per_million`, `${type}_price_per_million`];
  for (const key of perMillionKeys) {
    if (typeof model[key] === 'number') {
      let value = model[key];
      if (key.endsWith('_usd')) {
        return value / 1000;
      }
      const currency = (model.currency || model.currency_code || 'USD').toString().toUpperCase();
      if (currency === 'CNY') {
        value = rate ? value / rate : value;
      }
      return value / 1000;
    }
  }
  if (type === 'output') {
    return getPriceUSDPer1K(model, 'input', rate);
  }
  return 0;
}

function getContextWindow(model) {
  if (typeof model.context_window === 'number') return model.context_window;
  if (typeof model.context_window_tokens === 'number') return model.context_window_tokens;
  if (typeof model.max_context_tokens === 'number') return model.max_context_tokens;
  if (typeof model.max_context === 'number') return model.max_context;
  return null;
}

function renderCalcResults() {
  if (!elements.calcResultsBody || !elements.calcResultsEmpty) return;
  const dict = state.i18n[state.lang] || state.i18n.zh;
  const rows = state.calc.rows || [];
  elements.calcResultsBody.innerHTML = '';

  const unitLabel = state.prefs.unit === 'perMillion' ? dict['unit.perMillion'] : dict['unit.perThousand'];
  const currencyLabel = state.prefs.currency === 'CNY' ? dict['currency.cny'] : dict['currency.usd'];

  if (elements.calcResultsTitle) {
    elements.calcResultsTitle.textContent = dict['calc.results.title'] || '';
  }
  if (elements.calcResultsNote) {
    const template = dict['calc.results.note'] || '';
    elements.calcResultsNote.textContent = template
      .replace('{currency}', currencyLabel)
      .replace('{unit}', unitLabel);
  }

  if (!rows.length) {
    elements.calcResultsEmpty.hidden = false;
    elements.calcResultsEmpty.textContent = dict['calc.results.empty'] || '';
    if (elements.calcWarning) {
      elements.calcWarning.hidden = true;
    }
    if (elements.calcExport) {
      elements.calcExport.disabled = true;
    }
    return;
  }

  elements.calcResultsEmpty.hidden = true;
  rows.forEach((row, index) => {
    const tr = document.createElement('tr');
    if (index === 0) {
      tr.classList.add('highlight');
    }
    const modelTd = document.createElement('td');
    modelTd.textContent = row.displayName;
    tr.appendChild(modelTd);

    const inputTd = document.createElement('td');
    inputTd.className = 'numeric';
    inputTd.textContent = formatPriceByUnit(row.inputPricePer1KUSD);
    tr.appendChild(inputTd);

    const outputTd = document.createElement('td');
    outputTd.className = 'numeric';
    outputTd.textContent = formatPriceByUnit(row.outputPricePer1KUSD);
    tr.appendChild(outputTd);

    const unitTd = document.createElement('td');
    unitTd.className = 'numeric';
    unitTd.textContent = formatUnitCostDisplay(row.unitCostUSDPerMillion);
    tr.appendChild(unitTd);

    const perCallTd = document.createElement('td');
    perCallTd.className = 'numeric';
    perCallTd.textContent = formatCurrencyAmount(row.perCallUSD);
    tr.appendChild(perCallTd);

    const periodTd = document.createElement('td');
    periodTd.className = 'numeric';
    periodTd.textContent = formatCurrencyAmount(row.periodUSD);
    tr.appendChild(periodTd);

    const monthTd = document.createElement('td');
    monthTd.className = 'numeric';
    monthTd.textContent = formatCurrencyAmount(row.monthUSD);
    tr.appendChild(monthTd);

    const diffTd = document.createElement('td');
    diffTd.className = 'numeric';
    diffTd.textContent = formatPercent(row.diffPct);
    tr.appendChild(diffTd);

    elements.calcResultsBody.appendChild(tr);
  });

  if (elements.calcWarning) {
    if (state.calc.contextWarnings && state.calc.contextWarnings.length) {
      const template = dict['calc.warning.context'] || 'Context window exceeded: {models}';
      elements.calcWarning.textContent = template.replace('{models}', state.calc.contextWarnings.join(', '));
      elements.calcWarning.hidden = false;
    } else {
      elements.calcWarning.hidden = true;
      elements.calcWarning.textContent = '';
    }
  }

  if (elements.calcExport) {
    elements.calcExport.disabled = !rows.length;
  }
}

function exportCalcResults() {
  const rows = state.calc.rows || [];
  if (!rows.length) return;
  const dict = state.i18n[state.lang] || state.i18n.zh;
  const scenario = state.calc.currentScenario;
  const currency = state.prefs.currency;
  const unit = state.prefs.unit;
  const header = [
    'model_id',
    'vendor',
    'model',
    'input_price_display',
    'output_price_display',
    'unit_cost_display',
    'cost_per_call',
    'period_cost',
    'month_cost',
    'diff_pct',
    'period',
    'calls',
    'prompt_tokens',
    'completion_tokens',
    'currency',
    'unit'
  ];
  const lines = [header.join(',')];
  rows.forEach(row => {
    const record = [
      escapeCsv(row.id),
      escapeCsv(row.vendor),
      escapeCsv(row.model),
      escapeCsv(formatPriceByUnit(row.inputPricePer1KUSD)),
      escapeCsv(formatPriceByUnit(row.outputPricePer1KUSD)),
      escapeCsv(formatUnitCostDisplay(row.unitCostUSDPerMillion)),
      formatCurrencyRaw(row.perCallUSD),
      formatCurrencyRaw(row.periodUSD),
      formatCurrencyRaw(row.monthUSD),
      row.diffPct.toFixed(2),
      scenario.period,
      scenario.calls,
      scenario.avg_prompt_tokens,
      scenario.avg_completion_tokens,
      currency,
      unit
    ];
    lines.push(record.join(','));
  });
  const bom = String.fromCharCode(0xFEFF);
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'llm_costs.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast(dict['calc.export.success'] || 'CSV exported');
}

function recordCalcHistory(rows, scenario) {
  if (!Array.isArray(rows) || !rows.length) return;
  const entries = buildHistoryEntries(rows, scenario, state.prefs, Date.now());
  if (!entries.length) return;
  state.calc.history = mergeHistory(state.calc.history || [], entries);
  persistCalcHistory(state.calc.history);
  renderCalcHistory();
}

function renderCalcHistory() {
  if (!elements.calcHistoryList || !elements.calcHistoryEmpty) return;
  const dict = state.i18n[state.lang] || state.i18n.zh;
  const history = state.calc.history || [];
  const hasHistory = history.length > 0;
  elements.calcHistoryEmpty.hidden = hasHistory;
  elements.calcHistoryEmpty.textContent = dict['calc.history.empty'] || '';
  if (elements.calcHistoryExport) {
    elements.calcHistoryExport.disabled = !hasHistory;
    elements.calcHistoryExport.textContent = dict['calc.history.export'] || '';
  }
  if (elements.calcHistoryClear) {
    elements.calcHistoryClear.disabled = !hasHistory;
    elements.calcHistoryClear.textContent = dict['calc.history.clear'] || '';
  }
  if (!hasHistory) {
    elements.calcHistoryList.innerHTML = '';
    return;
  }

  const groups = new Map();
  history.forEach(entry => {
    if (!groups.has(entry.ts)) {
      groups.set(entry.ts, []);
    }
    groups.get(entry.ts).push(entry);
  });

  const sortedTs = Array.from(groups.keys()).sort((a, b) => b - a);
  elements.calcHistoryList.innerHTML = '';
  sortedTs.forEach(ts => {
    const entries = groups.get(ts);
    if (!entries || !entries.length) return;
    const tokensPerCall = (entries[0].inTokens || 0) + (entries[0].outTokens || 0);
    const summaryText = (dict['calc.history.summary'] || '')
      .replace('{time}', new Date(ts).toLocaleString(state.lang === 'en' ? 'en-US' : 'zh-CN'))
      .replace('{count}', entries.length)
      .replace('{tokens}', tokensPerCall);

    const details = document.createElement('details');
    details.className = 'calc-history-entry';

    const summary = document.createElement('summary');
    summary.textContent = summaryText;
    details.appendChild(summary);

    const table = document.createElement('table');
    table.className = 'calc-history-table';
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['calc.history.col.model', 'calc.history.col.input', 'calc.history.col.output', 'calc.history.col.total', 'calc.history.col.unit', 'calc.history.col.currency'].forEach(key => {
      const th = document.createElement('th');
      th.textContent = dict[key] || key;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    entries.forEach(entry => {
      const row = document.createElement('tr');
      const modelCell = document.createElement('td');
      modelCell.textContent = `${entry.vendor} / ${entry.model}`;
      row.appendChild(modelCell);

      const inputCell = document.createElement('td');
      inputCell.textContent = formatHistoryPrice(entry.priceIn, entry.unit, entry.currency);
      row.appendChild(inputCell);

      const outputCell = document.createElement('td');
      outputCell.textContent = formatHistoryPrice(entry.priceOut, entry.unit, entry.currency);
      row.appendChild(outputCell);

      const totalCell = document.createElement('td');
      totalCell.textContent = formatHistoryCurrency(entry.total, entry.currency);
      row.appendChild(totalCell);

      const unitCell = document.createElement('td');
      unitCell.textContent = entry.unit;
      row.appendChild(unitCell);

      const currencyCell = document.createElement('td');
      currencyCell.textContent = entry.currency;
      row.appendChild(currencyCell);

      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    details.appendChild(table);

    if (entries[0].memo) {
      const memo = document.createElement('p');
      memo.className = 'hint';
      memo.textContent = `${dict['calc.history.memo'] || 'Memo'}: ${entries[0].memo}`;
      details.appendChild(memo);
    }

    elements.calcHistoryList.appendChild(details);
  });
}

function exportCalcHistory() {
  const history = state.calc.history || [];
  if (!history.length) return;
  const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'calc_history.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function handleCalcHistoryClear() {
  if (!state.calc.history || !state.calc.history.length) return;
  const confirmMessage = state.i18n[state.lang]?.['calc.history.confirm'] || 'Clear history?';
  const confirmed = window.confirm(confirmMessage);
  if (!confirmed) return;
  state.calc.history = resetCalcHistory();
  renderCalcHistory();
}

function convertAmountForCurrency(amountUSD, currency) {
  const rate = Number(state.prefs.rate) || defaultPrefs.rate;
  if ((currency || 'USD').toUpperCase() === 'CNY') {
    return amountUSD * rate;
  }
  return amountUSD;
}

function convertCurrency(amountUSD) {
  return convertAmountForCurrency(amountUSD, state.prefs.currency);
}

function formatCurrencyAmount(amountUSD) {
  const converted = convertCurrency(amountUSD);
  const safe = Number.isFinite(converted) ? converted : 0;
  return safe.toLocaleString(state.lang === 'en' ? 'en-US' : 'zh-CN', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  });
}

function formatHistoryPrice(pricePer1KUSD, unit, currency) {
  let amountUSD = pricePer1KUSD;
  if (unit === 'perMillion') {
    amountUSD = pricePer1KUSD * 1000;
  }
  const converted = convertAmountForCurrency(amountUSD, currency);
  const safe = Number.isFinite(converted) ? converted : 0;
  return safe.toLocaleString(state.lang === 'en' ? 'en-US' : 'zh-CN', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  });
}

function formatHistoryCurrency(amountUSD, currency) {
  const converted = convertAmountForCurrency(amountUSD, currency);
  const safe = Number.isFinite(converted) ? converted : 0;
  return safe.toLocaleString(state.lang === 'en' ? 'en-US' : 'zh-CN', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  });
}

function formatCurrencyRaw(amountUSD) {
  const converted = convertCurrency(amountUSD);
  const safe = Number.isFinite(converted) ? converted : 0;
  return safe.toFixed(6);
}

function formatPriceByUnit(pricePer1KUSD) {
  const unit = state.prefs.unit === 'perMillion' ? 'perMillion' : 'perThousand';
  let amountUSD = pricePer1KUSD;
  if (unit === 'perMillion') {
    amountUSD = pricePer1KUSD * 1000;
  }
  return formatCurrencyAmount(amountUSD);
}

function formatUnitCostDisplay(unitCostUSDPerMillion) {
  let amountUSD = unitCostUSDPerMillion;
  if (state.prefs.unit === 'perThousand') {
    amountUSD = unitCostUSDPerMillion / 1000;
  }
  return formatCurrencyAmount(amountUSD);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '—';
  const rounded = value === 0 ? 0 : value;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded.toFixed(2)}%`;
}

function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function setupRouting() {
  [elements.navDashboard, elements.navCalc].forEach(link => {
    if (!link) return;
    link.addEventListener('click', () => {
      setTimeout(() => {
        if (!window.location.hash) {
          window.location.hash = '#/';
        }
      }, 0);
    });
  });
  handleHashChange();
  window.addEventListener('hashchange', handleHashChange);
}

function handleHashChange() {
  let hash = window.location.hash || '#/';
  const search = window.location.search || '';
  if (/rating/i.test(hash) || /rating/i.test(search)) {
    hash = '#/';
    if (window.location.hash !== '#/') {
      window.location.replace('#/');
      return;
    }
    if (search) {
      const cleanUrl = `${window.location.pathname}#/`;
      if (typeof history.replaceState === 'function') {
        history.replaceState(null, '', cleanUrl);
      }
    }
  }
  if (!ROUTES.includes(hash)) {
    hash = '#/';
    if (window.location.hash !== hash) {
      window.location.hash = hash;
      return;
    }
  }
  state.route = hash;
  applyRoute();
}

function applyRoute() {
  if (elements.pages) {
    elements.pages.forEach(page => {
      if (!page) return;
      const route = page.dataset.route || '#/';
      page.hidden = route !== state.route;
    });
  }
  if (elements.navDashboard) {
    const active = state.route === '#/';
    elements.navDashboard.classList.toggle('active', active);
    if (active) {
      elements.navDashboard.setAttribute('aria-current', 'page');
    } else {
      elements.navDashboard.removeAttribute('aria-current');
    }
  }
  if (elements.navCalc) {
    const active = state.route === '#/calc';
    elements.navCalc.classList.toggle('active', active);
    if (active) {
      elements.navCalc.setAttribute('aria-current', 'page');
    } else {
      elements.navCalc.removeAttribute('aria-current');
    }
  }
  if (elements.toolbar) {
    const showToolbar = shouldShowToolbar(state.route);
    elements.toolbar.hidden = !showToolbar;
    if (showToolbar) {
      elements.toolbar.removeAttribute('aria-hidden');
    } else {
      elements.toolbar.setAttribute('aria-hidden', 'true');
    }
  }

  if (state.route === '#/calc') {
    syncCalcFormWithState();
    renderCalcResults();
  }

  updateScopedElements(state.route);
}

function updateScopedElements(route) {
  const pricing = isPricingRoute(route);
  document.querySelectorAll('[data-scope="pricing-only"]').forEach(element => {
    if (pricing) {
      element.hidden = false;
      element.removeAttribute('aria-hidden');
    } else {
      element.hidden = true;
      element.setAttribute('aria-hidden', 'true');
    }
  });
}

function applyPrefsToUI() {
  elements.search.value = state.prefs.search || '';
  applyToggleState(elements.favoritesToggle, state.prefs.onlyFavorites);
  applyToggleState(elements.commonToggle, state.prefs.onlyCommon);
  if (elements.sortField) {
    elements.sortField.value = state.pricingSort.field;
  }
  if (elements.sortDirection) {
    elements.sortDirection.value = state.pricingSort.direction;
  }
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

  elements.navDashboard && (elements.navDashboard.textContent = dict['nav.dashboard'] || dict['title']);
  elements.navCalc && (elements.navCalc.textContent = dict['nav.calc'] || 'Calc');

  if (elements.sortFieldLabel) {
    elements.sortFieldLabel.textContent = dict['sort.field'] || '';
  }
  if (elements.sortFieldInputOption) {
    elements.sortFieldInputOption.textContent = dict['sort.field.input'] || '';
  }
  if (elements.sortFieldOutputOption) {
    elements.sortFieldOutputOption.textContent = dict['sort.field.output'] || '';
  }
  if (elements.sortDirectionLabel) {
    elements.sortDirectionLabel.textContent = dict['sort.direction'] || '';
  }
  if (elements.sortDirectionAscOption) {
    elements.sortDirectionAscOption.textContent = dict['sort.direction.asc'] || '';
  }
  if (elements.sortDirectionDescOption) {
    elements.sortDirectionDescOption.textContent = dict['sort.direction.desc'] || '';
  }

  if (elements.calcTitle) {
    elements.calcTitle.textContent = dict['calc.title'] || '';
  }
  if (elements.calcSubtitle) {
    elements.calcSubtitle.textContent = dict['calc.subtitle'] || '';
  }
  if (elements.calcConfigTitle) {
    elements.calcConfigTitle.textContent = dict['calc.config'] || '';
  }
  if (elements.calcPeriodLabel) {
    elements.calcPeriodLabel.textContent = dict['calc.period'] || '';
  }
  if (elements.calcPeriodDay) {
    elements.calcPeriodDay.textContent = dict['calc.period.day'] || '';
  }
  if (elements.calcPeriodMonth) {
    elements.calcPeriodMonth.textContent = dict['calc.period.month'] || '';
  }
  if (elements.calcCallsLabel) {
    elements.calcCallsLabel.textContent = dict['calc.calls'] || '';
  }
  if (elements.calcModeLabel) {
    elements.calcModeLabel.textContent = dict['calc.mode'] || '';
  }
  if (elements.calcModeManualLabel) {
    elements.calcModeManualLabel.textContent = dict['calc.mode.manual'] || '';
  }
  if (elements.calcModeTextLabel) {
    elements.calcModeTextLabel.textContent = dict['calc.mode.text'] || '';
  }
  if (elements.calcLangLabel) {
    elements.calcLangLabel.textContent = dict['calc.lang'] || '';
  }
  if (elements.calcLangZh) {
    elements.calcLangZh.textContent = dict['calc.lang.zh'] || '中文';
  }
  if (elements.calcLangEn) {
    elements.calcLangEn.textContent = dict['calc.lang.en'] || 'English';
  }
  if (elements.calcPromptLabel) {
    elements.calcPromptLabel.textContent = dict['calc.prompt'] || '';
  }
  if (elements.calcCompletionLabel) {
    elements.calcCompletionLabel.textContent = dict['calc.completion'] || '';
  }
  if (elements.calcTextPromptLabel) {
    elements.calcTextPromptLabel.textContent = dict['calc.text.prompt'] || '';
  }
  if (elements.calcTextCompletionLabel) {
    elements.calcTextCompletionLabel.textContent = dict['calc.text.completion'] || '';
  }
  if (elements.calcHistoryTitle) {
    elements.calcHistoryTitle.textContent = dict['calc.history.title'] || '';
  }
  if (elements.calcModelLegend) {
    elements.calcModelLegend.textContent = dict['calc.model.legend'] || '';
  }
  if (elements.calcModelSearchLabel) {
    elements.calcModelSearchLabel.textContent = dict['calc.model.search'] || '';
  }
  if (elements.calcModelSearch) {
    elements.calcModelSearch.placeholder = dict['calc.model.search'] || '';
  }
  if (elements.calcModelCommonLabel) {
    elements.calcModelCommonLabel.textContent = dict['calc.model.common'] || '';
  }
  if (elements.calcScenarioLegend) {
    elements.calcScenarioLegend.textContent = dict['calc.scenario.legend'] || '';
  }
  if (elements.calcScenarioLabel) {
    elements.calcScenarioLabel.textContent = dict['calc.scenario.label'] || '';
  }
  if (elements.calcScenarioNone) {
    elements.calcScenarioNone.textContent = dict['calc.scenario.none'] || '';
  }
  if (elements.calcSave) {
    elements.calcSave.textContent = dict['calc.saveScenario'] || '';
  }
  if (elements.calcRename) {
    elements.calcRename.textContent = dict['calc.renameScenario'] || '';
  }
  if (elements.calcDelete) {
    elements.calcDelete.textContent = dict['calc.deleteScenario'] || '';
  }
  if (elements.calcCompute) {
    elements.calcCompute.textContent = dict['calc.compute'] || '';
  }
  if (elements.calcExport) {
    elements.calcExport.textContent = dict['calc.export'] || '';
  }
  if (elements.calcResultsTitle) {
    elements.calcResultsTitle.textContent = dict['calc.results.title'] || '';
  }
  if (elements.calcResultsEmpty) {
    elements.calcResultsEmpty.textContent = dict['calc.results.empty'] || '';
  }
  if (elements.calcDisclaimer) {
    elements.calcDisclaimer.textContent = dict['calc.disclaimer'] || '';
  }
  if (elements.compareTitle) {
    elements.compareTitle.textContent = dict['compare.title'] || '';
  }
  if (elements.compareHint) {
    elements.compareHint.textContent = dict['compare.hint'] || '';
  }
  if (elements.comparePlaceholder) {
    elements.comparePlaceholder.textContent = dict['compare.placeholder'] || '';
  }
  if (elements.calcColModel) {
    elements.calcColModel.textContent = dict['calc.results.model'] || '';
  }
  if (elements.calcColInput) {
    elements.calcColInput.textContent = dict['calc.results.input'] || '';
  }
  if (elements.calcColOutput) {
    elements.calcColOutput.textContent = dict['calc.results.output'] || '';
  }
  if (elements.calcColUnit) {
    elements.calcColUnit.textContent = dict['calc.results.unitCost'] || '';
  }
  if (elements.calcColPerCall) {
    elements.calcColPerCall.textContent = dict['calc.results.perCall'] || '';
  }
  if (elements.calcColPeriod) {
    elements.calcColPeriod.textContent = dict['calc.results.periodCost'] || '';
  }
  if (elements.calcColMonth) {
    elements.calcColMonth.textContent = dict['calc.results.monthCost'] || '';
  }
  if (elements.calcColDiff) {
    elements.calcColDiff.textContent = dict['calc.results.diff'] || '';
  }

  updateCalcTextHint();
  renderCalcResults();
  renderComparePanel();
  renderCalcHistory();

  const headers = document.querySelectorAll('#pricing-table thead th');
  const headerKeys = [
    null,
    'table.compare',
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
  renderCalcResults();
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
  pruneCompareSelections(state.data);
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
  renderCalcModelOptions();
  renderComparePanel();
}

function dictFormat(template, vars) {
  if (!template) return '';
  return template.replace(/\{(.*?)\}/g, (_, key) => vars[key] ?? '');
}

function pruneCompareSelections(data) {
  if (!state.compare || !state.compare.size) return;
  const available = new Set(data.map(item => item.id));
  let changed = false;
  state.compare.forEach(id => {
    if (!available.has(id)) {
      state.compare.delete(id);
      changed = true;
    }
  });
  if (changed) {
    saveCompareSelections();
  }
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

function handleSortControlChange() {
  const field = elements.sortField?.value === 'output' ? 'output' : 'input';
  const direction = elements.sortDirection?.value === 'desc' ? 'desc' : 'asc';
  state.pricingSort = { field, direction };
  state.sortKey = field;
  state.sortDir = direction;
  state.prefs.sortKey = field;
  state.prefs.sortDir = direction;
  savePrefs();
  savePricingSortPreference();
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

    const compareTd = document.createElement('td');
    const compareInput = document.createElement('input');
    compareInput.type = 'checkbox';
    compareInput.className = 'compare-toggle';
    compareInput.checked = state.compare.has(item.id);
    compareInput.setAttribute('aria-label', `${dict['table.compare'] || 'Compare'} ${item.model}`);
    compareInput.addEventListener('change', event => handleCompareToggle(item, event.target));
    compareTd.appendChild(compareInput);
    tr.appendChild(compareTd);

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
    descTd.classList.add('desc-cell');
    const desc = document.createElement('div');
    desc.className = 'desc';
    const full = (item.desc || '').trim();
    const span = document.createElement('span');
    span.className = 'desc-content';
    span.textContent = full || '—';
    desc.appendChild(span);

    const needsToggle = full.length > 120 || full.includes('\n');
    if (needsToggle) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'desc-toggle';
      toggle.textContent = dict['table.desc.more'] || 'More';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        desc.classList.toggle('is-expanded', !expanded);
        toggle.textContent = expanded ? (dict['table.desc.more'] || 'More') : (dict['table.desc.less'] || 'Less');
      });
      desc.appendChild(toggle);
    } else {
      desc.classList.add('is-expanded');
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

function renderComparePanel() {
  if (!elements.comparePanel) return;
  const dict = state.i18n[state.lang] || state.i18n.zh;
  if (elements.compareTitle) {
    elements.compareTitle.textContent = dict['compare.title'] || '';
  }
  if (elements.compareHint) {
    elements.compareHint.textContent = dict['compare.hint'] || '';
  }
  const compareIds = Array.from(state.compare);
  const hasMinimum = compareIds.length >= MIN_COMPARE_MODELS;
  if (elements.comparePlaceholder) {
    elements.comparePlaceholder.textContent = hasMinimum
      ? ''
      : dict['compare.placeholder'] || '';
    elements.comparePlaceholder.hidden = hasMinimum;
  }
  if (!elements.compareGrid) return;
  elements.compareGrid.innerHTML = '';
  elements.compareGrid.hidden = !hasMinimum;
  if (!hasMinimum) {
    return;
  }
  const dataMap = new Map(state.data.map(item => [item.id, item]));
  compareIds.slice(0, MAX_COMPARE_MODELS).forEach(id => {
    const model = dataMap.get(id);
    if (!model) return;
    const card = document.createElement('article');
    card.className = 'compare-card';
    card.setAttribute('role', 'listitem');
    const title = document.createElement('h3');
    title.textContent = `${model.vendor} / ${model.model}`;
    card.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'compare-meta';

    const inputSpan = document.createElement('span');
    inputSpan.innerHTML = `<strong>${dict['compare.card.input'] || 'Input'}:</strong> ${formatPrice(model.input_per_million)}`;
    meta.appendChild(inputSpan);

    const outputSpan = document.createElement('span');
    outputSpan.innerHTML = `<strong>${dict['compare.card.output'] || 'Output'}:</strong> ${formatPrice(model.output_per_million)}`;
    meta.appendChild(outputSpan);

    const contextSpan = document.createElement('span');
    const contextWindow = getContextWindow(model);
    const contextValue = contextWindow ? contextWindow.toLocaleString() : '—';
    contextSpan.innerHTML = `<strong>${dict['compare.card.context'] || 'Context'}:</strong> ${contextValue}`;
    meta.appendChild(contextSpan);

    card.appendChild(meta);

    if (model.desc) {
      const notes = document.createElement('p');
      notes.textContent = `${dict['compare.card.notes'] || 'Notes'}: ${model.desc}`;
      notes.className = 'hint';
      card.appendChild(notes);
    }

    elements.compareGrid.appendChild(card);
  });
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

function handleCompareToggle(item, target) {
  if (!item || !item.id) return;
  const dict = state.i18n[state.lang] || state.i18n.zh;
  const checkbox = target;
  if (checkbox && checkbox.checked) {
    if (!state.compare.has(item.id)) {
      if (state.compare.size >= MAX_COMPARE_MODELS) {
        checkbox.checked = false;
        showToast(dict['compare.limit'] || 'Maximum of 4 models.');
        return;
      }
      state.compare.add(item.id);
      saveCompareSelections();
    }
  } else {
    state.compare.delete(item.id);
    saveCompareSelections();
  }
  renderComparePanel();
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
