import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HISTORY_STORAGE_KEY,
  normalizeHistory,
  loadHistory,
  saveHistory,
  buildHistoryEntries,
  mergeHistory,
  clearHistory
} from '../modules/calc-history.js';

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    }
  };
}

test('normalizeHistory filters invalid entries and limits size', () => {
  const payload = [
    { ts: 1000, modelId: 'a', vendor: 'v', model: 'm', priceIn: 1, priceOut: 2, total: 3 },
    { ts: 'bad', modelId: '', total: 5 },
    { ts: 900, id: 'b', vendor: 'x', model: 'y', total: 4 }
  ];
  const normalized = normalizeHistory(payload);
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].modelId, 'a');
  assert.equal(normalized[1].modelId, 'b');
  assert(normalized[0].ts >= normalized[1].ts);
});

test('buildHistoryEntries maps rows into persisted structure', () => {
  const rows = [
    {
      id: 'model-1',
      vendor: 'Vendor',
      model: 'Model 1',
      inputPricePer1KUSD: 0.1,
      outputPricePer1KUSD: 0.2,
      periodUSD: 10
    }
  ];
  const scenario = {
    mode: 'text',
    avg_prompt_tokens: 123,
    avg_completion_tokens: 456,
    name: 'Scenario A'
  };
  const prefs = { unit: 'perMillion', currency: 'CNY', rate: 7 };
  const [entry] = buildHistoryEntries(rows, scenario, prefs, 1_000_123);
  assert.equal(entry.ts, 1_000_000);
  assert.equal(entry.modelId, 'model-1');
  assert.equal(entry.mode, 'text');
  assert.equal(entry.unit, 'perMillion');
  assert.equal(entry.currency, 'CNY');
  assert.equal(entry.priceIn, 0.1);
  assert.equal(entry.total, 10);
  assert.equal(entry.memo, 'Scenario A');
});

test('mergeHistory replaces entries with matching timestamp/model pairs', () => {
  const existing = [
    { ts: 1000, modelId: 'a', total: 1 },
    { ts: 900, modelId: 'b', total: 2 }
  ];
  const incoming = [
    { ts: 1000, modelId: 'a', total: 5 },
    { ts: 1000, modelId: 'c', total: 6 }
  ];
  const merged = mergeHistory(existing, incoming);
  assert.equal(merged.length, 3);
  const totalsById = Object.fromEntries(merged.map(entry => [entry.modelId, entry.total]));
  assert.equal(totalsById.a, 5);
  assert.equal(totalsById.c, 6);
  assert.equal(totalsById.b, 2);
});

test('loadHistory and saveHistory round-trip through provided storage', () => {
  const storage = createMemoryStorage();
  const sample = [
    { ts: 1000, modelId: 'a', vendor: 'v', model: 'm', priceIn: 1, priceOut: 2, total: 3 }
  ];
  saveHistory(sample, storage);
  const loaded = loadHistory(storage);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].modelId, 'a');
  clearHistory(storage);
  assert.equal(storage.getItem(HISTORY_STORAGE_KEY), '[]');
});
