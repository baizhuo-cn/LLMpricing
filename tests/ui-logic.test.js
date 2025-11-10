import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowToolbar, shouldShowTokenEstimate } from '../modules/uiLogic.js';

describe('shouldShowToolbar', () => {
  test('returns true for price board route', () => {
    assert.equal(shouldShowToolbar('#/'), true);
  });

  test('returns false for calculator route', () => {
    assert.equal(shouldShowToolbar('#/calc'), false);
  });

  test('defaults to true for falsy input', () => {
    assert.equal(shouldShowToolbar(''), true);
    assert.equal(shouldShowToolbar(undefined), true);
  });
});

describe('shouldShowTokenEstimate', () => {
  test('is true only for text mode', () => {
    assert.equal(shouldShowTokenEstimate('text'), true);
    assert.equal(shouldShowTokenEstimate('manual'), false);
    assert.equal(shouldShowTokenEstimate('other'), false);
  });
});
