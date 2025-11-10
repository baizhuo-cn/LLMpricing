export const HISTORY_STORAGE_KEY = 'calc_history_v1';
const HISTORY_LIMIT = 20;

export function normalizeHistory(payload) {
  if (!payload) return [];
  try {
    const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(item => ({
        ts: typeof item.ts === 'number' ? item.ts : Date.now(),
        modelId: item.modelId || item.id || '',
        vendor: item.vendor || '',
        model: item.model || '',
        mode: item.mode === 'text' ? 'text' : 'manual',
        inTokens: Number.isFinite(item.inTokens) ? item.inTokens : 0,
        outTokens: Number.isFinite(item.outTokens) ? item.outTokens : 0,
        unit: item.unit || 'perMillion',
        currency: item.currency || 'CNY',
        priceIn: Number.isFinite(item.priceIn) ? item.priceIn : 0,
        priceOut: Number.isFinite(item.priceOut) ? item.priceOut : 0,
        total: Number.isFinite(item.total) ? item.total : 0,
        memo: typeof item.memo === 'string' ? item.memo : ''
      }))
      .filter(entry => entry.modelId)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, HISTORY_LIMIT);
  } catch (err) {
    console.warn('Failed to parse calc history', err);
    return [];
  }
}

export function loadHistory(storage = globalThis.localStorage) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(HISTORY_STORAGE_KEY);
    return normalizeHistory(raw);
  } catch (err) {
    console.warn('Unable to read history', err);
    return [];
  }
}

export function saveHistory(entries, storage = globalThis.localStorage) {
  if (!storage) return;
  try {
    storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries.slice(0, HISTORY_LIMIT)));
  } catch (err) {
    console.warn('Unable to persist history', err);
  }
}

export function buildHistoryEntries(rows, scenario, prefs, timestamp = Date.now()) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const ts = Math.floor(timestamp / 1000) * 1000;
  return rows.map(row => ({
    ts,
    modelId: row.id,
    vendor: row.vendor,
    model: row.model,
    mode: scenario.mode,
    inTokens: scenario.avg_prompt_tokens,
    outTokens: scenario.avg_completion_tokens,
    unit: prefs.unit,
    currency: prefs.currency,
    priceIn: row.inputPricePer1KUSD,
    priceOut: row.outputPricePer1KUSD,
    total: row.periodUSD,
    memo: scenario.name || ''
  }));
}

export function mergeHistory(existing, newEntries) {
  if (!newEntries.length) return existing.slice(0, HISTORY_LIMIT);
  const targetTs = newEntries[0].ts;
  const seen = new Map(newEntries.map(entry => [entry.modelId, entry]));
  const filtered = existing.filter(entry => entry.ts !== targetTs || !seen.has(entry.modelId));
  const merged = [...newEntries, ...filtered];
  return merged.sort((a, b) => b.ts - a.ts).slice(0, HISTORY_LIMIT);
}

export function clearHistory(storage = globalThis.localStorage) {
  saveHistory([], storage);
  return [];
}

