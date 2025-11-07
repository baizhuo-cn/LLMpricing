import test from 'node:test';
import assert from 'node:assert/strict';

import {
  tokenize,
  detectTokenizer,
  heuristicTokens,
  clearTokenizerCache,
  setTokenizerForFamily
} from '../modules/token-utils.js';

test('detectTokenizer maps known model ids to tokenizer families', () => {
  assert.equal(detectTokenizer('gpt-4o-mini'), 'o200k');
  assert.equal(detectTokenizer('claude-3-opus'), 'anthropic');
  assert.equal(detectTokenizer('gemini-pro'), 'gemini');
  assert.equal(detectTokenizer('unknown-model'), 'heuristic');
});

test('tokenize uses injected precise tokenizer when available', async () => {
  clearTokenizerCache();
  const stub = {
    count: text => text.length + 1
  };
  setTokenizerForFamily('o200k', stub);
  const result = await tokenize('hello', 'gpt-4o');
  assert.equal(result.tokens, 6);
  assert.equal(result.source, 'o200k');
  clearTokenizerCache();
});

test('tokenize falls back to heuristic counts when tokenizer missing', async () => {
  clearTokenizerCache();
  const text = '这是一个混合文本 mixed content，用于测试 token 估算。';
  const result = await tokenize(text, 'mystery-model');
  assert.equal(result.source, 'heuristic');
  assert(result.tokens > 0);
});

test('heuristicTokens returns reasonable positive counts', () => {
  const english = heuristicTokens('This is a simple english sentence for estimation.', 'en');
  const chinese = heuristicTokens('这是一段中文，用于估算 tokens 数量。', 'zh');
  assert(english > 0);
  assert(chinese > 0);
  // ensure the heuristic distinguishes language characteristics
  assert.notEqual(english, chinese);
});
