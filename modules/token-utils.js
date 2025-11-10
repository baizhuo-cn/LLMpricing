const CJK_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/g;
const LATIN_WORD_REGEX = /[A-Za-z][A-Za-z0-9'’_-]*/g;
const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}]/gu;
const PUNCT_REGEX = /[!-/:-@[-`{-~]/g;
const NUMBER_REGEX = /\d+/g;

const KNOWN_TOKENIZERS = [
  { family: 'o200k', pattern: /(gpt-4o|gpt-4o-mini|o1|o3|o200k|gpt-4.1|gpt-4\.1)/ },
  { family: 'cl100k', pattern: /(gpt-4|gpt-3\.5|text-davinci|text-embedding|gpt-35|text-curie|text-babbage|text-ada)/ },
  { family: 'anthropic', pattern: /(claude|anthropic)/ },
  { family: 'gemini', pattern: /(gemini|text-bison|chat-bison)/ }
];

const tokenizerCache = new Map();

function segmentLatinWords(text) {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('en', { granularity: 'word' });
    const segments = [];
    for (const segment of segmenter.segment(text)) {
      if (segment.isWordLike && /\p{Script=Latin}/u.test(segment.segment)) {
        segments.push(segment.segment);
      }
    }
    if (segments.length) {
      return segments;
    }
  }
  const matches = text.match(LATIN_WORD_REGEX);
  return matches ? Array.from(matches) : [];
}

function countEmoji(text) {
  const matches = text.match(EMOJI_REGEX);
  return matches ? matches.length : 0;
}

async function loadPreciseTokenizer(family) {
  if (tokenizerCache.has(family)) {
    return tokenizerCache.get(family);
  }

  if (typeof window === 'undefined') {
    tokenizerCache.set(family, null);
    return null;
  }

  try {
    if (family === 'cl100k' && globalThis.__tiktoken_cl100k) {
      tokenizerCache.set(family, globalThis.__tiktoken_cl100k);
      return globalThis.__tiktoken_cl100k;
    }
    if (family === 'o200k' && globalThis.__tiktoken_o200k) {
      tokenizerCache.set(family, globalThis.__tiktoken_o200k);
      return globalThis.__tiktoken_o200k;
    }
    if (family === 'anthropic' && globalThis.__claude_tokenizer) {
      tokenizerCache.set(family, globalThis.__claude_tokenizer);
      return globalThis.__claude_tokenizer;
    }
    if (family === 'gemini' && globalThis.__gemini_tokenizer) {
      tokenizerCache.set(family, globalThis.__gemini_tokenizer);
      return globalThis.__gemini_tokenizer;
    }
  } catch (err) {
    console.warn('Tokenizer global lookup failed', err);
  }

  tokenizerCache.set(family, null);
  return null;
}

function heuristicTokenCount(text, langHint) {
  if (!text) return 0;
  const normalized = text.normalize('NFKC');
  const latinSegments = segmentLatinWords(normalized);
  const latinChars = latinSegments.reduce((sum, seg) => sum + seg.length, 0);
  let latinTokens = 0;
  latinSegments.forEach(seg => {
    const base = Math.max(1, Math.round(seg.length / 3.2));
    latinTokens += base;
  });

  const numberMatches = normalized.match(NUMBER_REGEX) || [];
  let numberTokens = 0;
  numberMatches.forEach(match => {
    numberTokens += Math.max(1, Math.round(match.length / 3.5));
  });

  const cjkMatches = normalized.match(CJK_REGEX) || [];
  const cjkTokens = cjkMatches.length;

  const emojiTokens = countEmoji(normalized);

  const stripped = normalized
    .replace(LATIN_WORD_REGEX, ' ')
    .replace(CJK_REGEX, ' ')
    .replace(EMOJI_REGEX, ' ')
    .replace(NUMBER_REGEX, ' ');

  const punctuationTokens = Math.ceil(((stripped.match(PUNCT_REGEX) || []).length) * 0.75);
  const whitespaceTokens = Math.ceil(((stripped.match(/\s+/g) || []).reduce((acc, seg) => acc + Math.max(0, seg.length - 1), 0)) / 6);

  let total = latinTokens + numberTokens + cjkTokens + emojiTokens + punctuationTokens + whitespaceTokens;

  if (!total) {
    total = Math.ceil(normalized.length / 4);
  }

  if (langHint === 'en' && latinTokens) {
    total = Math.round(total * 0.95);
  } else if (langHint === 'zh' && cjkTokens) {
    total = Math.round(total * 1.02);
  }

  return Math.max(0, total);
}

export function detectTokenizer(modelId = '') {
  const id = (modelId || '').toLowerCase();
  for (const rule of KNOWN_TOKENIZERS) {
    if (rule.pattern.test(id)) {
      return rule.family;
    }
  }
  return 'heuristic';
}

export async function tokenize(text, modelId, options = {}) {
  const content = typeof text === 'string' ? text : '';
  if (!content.trim()) {
    return { tokens: 0, source: 'empty' };
  }
  const family = detectTokenizer(modelId);
  try {
    const tokenizer = await loadPreciseTokenizer(family);
    if (tokenizer && typeof tokenizer.count === 'function') {
      const precise = tokenizer.count(content);
      if (Number.isFinite(precise)) {
        return { tokens: precise, source: family };
      }
    }
  } catch (err) {
    console.warn('Precise tokenizer failed, falling back', err);
  }
  const lang = options.lang || (family === 'cl100k' || family === 'o200k' ? 'en' : undefined);
  return { tokens: heuristicTokenCount(content, lang), source: 'heuristic' };
}

export function heuristicTokens(text, langHint) {
  return heuristicTokenCount(text, langHint);
}

export function clearTokenizerCache() {
  tokenizerCache.clear();
}

export function setTokenizerForFamily(family, tokenizer) {
  tokenizerCache.set(family, tokenizer);
}

