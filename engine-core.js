export const APP_VERSION = '2.0.0';
export const LIBRARY_VERSION = '3.7.2';

export const DEFAULT_GLOSSARY = Object.freeze([
  { id: 'g-field', en: 'field', ru: 'поле' },
  { id: 'g-coherence', en: 'coherence', ru: 'когерентность' },
  { id: 'g-measure', en: 'measure', ru: 'мера' },
  { id: 'g-source', en: 'source', ru: 'источник' },
  { id: 'g-subject', en: 'subject', ru: 'субъект' },
  { id: 'g-form', en: 'form', ru: 'форма' },
  { id: 'g-resonance', en: 'resonance', ru: 'резонанс' },
  { id: 'g-architectonics', en: 'architectonics', ru: 'архитектоника' },
]);

const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export function normalizeText(value = '') {
  return String(value)
    .normalize('NFKC')
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
    .toLocaleLowerCase();
}

export function hashString(value = '') {
  let hash = 2166136261;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function sentenceParts(text, locale) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    try {
      const segmenter = new Intl.Segmenter(locale, { granularity: 'sentence' });
      return [...segmenter.segment(text)].map((part) => part.segment).filter(Boolean);
    } catch {
      // Fall through to a conservative regex for older browsers.
    }
  }
  return text.match(/[^.!?…]+(?:[.!?…]+[”»"')\]]*)?\s*/gu) || [text];
}

function hardWrap(text, maxChars) {
  const words = text.trim().split(/\s+/u).filter(Boolean);
  if (!words.length) return [];
  const chunks = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if ((current.length + 1 + word.length) <= maxChars) {
      current += ` ${word}`;
    } else {
      chunks.push(current);
      current = word;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function splitOversizedSentence(sentence, maxChars) {
  if (sentence.length <= maxChars) return [sentence.trim()];
  const clauses = (sentence.match(/[^,;:—–-]+(?:[,;:—–-]+|$)\s*/gu) || [sentence])
    .map((part) => part.trim())
    .filter(Boolean);
  if (clauses.length <= 1) return hardWrap(sentence, maxChars);

  const chunks = [];
  let current = '';
  for (const clause of clauses) {
    if (!current) {
      current = clause;
    } else if ((current.length + 1 + clause.length) <= maxChars) {
      current += ` ${clause}`;
    } else {
      chunks.push(...hardWrap(current, maxChars));
      current = clause;
    }
  }
  if (current) chunks.push(...hardWrap(current, maxChars));
  return chunks;
}

/**
 * Splits text into translation-safe chunks while preserving paragraph joins.
 * Each returned item has a `prefix` that must be inserted before its translated text.
 */
export function splitTextIntoSegments(text, { maxChars = 420, locale = 'ru' } = {}) {
  const source = String(text || '').replace(/\r\n?/g, '\n');
  if (!source.trim()) return [];

  const blocks = source.split(/(\n{2,})/u);
  const segments = [];
  let pendingPrefix = '';

  for (const block of blocks) {
    if (!block) continue;
    if (/^\n{2,}$/u.test(block)) {
      pendingPrefix += block;
      continue;
    }

    const leading = block.match(/^\s*/u)?.[0] || '';
    const trailing = block.match(/\s*$/u)?.[0] || '';
    const body = block.trim();
    if (!body) {
      pendingPrefix += block;
      continue;
    }

    const sentences = sentenceParts(body, locale)
      .flatMap((sentence) => splitOversizedSentence(sentence, maxChars))
      .filter(Boolean);

    let current = '';
    let first = true;
    for (const sentence of sentences) {
      const clean = sentence.trim();
      if (!clean) continue;
      if (!current) {
        current = clean;
      } else if ((current.length + 1 + clean.length) <= maxChars) {
        current += ` ${clean}`;
      } else {
        segments.push({
          text: current,
          prefix: first ? `${pendingPrefix}${leading}` : ' ',
        });
        pendingPrefix = '';
        first = false;
        current = clean;
      }
    }

    if (current) {
      segments.push({
        text: current,
        prefix: first ? `${pendingPrefix}${leading}` : ' ',
      });
      pendingPrefix = trailing;
    } else {
      pendingPrefix += `${leading}${trailing}`;
    }
  }

  if (pendingPrefix && segments.length) {
    segments[segments.length - 1].suffix = pendingPrefix;
  }
  return segments;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function caseAwareTarget(source, target) {
  if (!source) return target;
  if (source === source.toLocaleUpperCase()) return target.toLocaleUpperCase();
  if (source[0] === source[0].toLocaleUpperCase()) {
    return target.charAt(0).toLocaleUpperCase() + target.slice(1);
  }
  return target;
}

export function directionTerms(entry, direction) {
  return direction === 'en-ru'
    ? { source: entry.en, target: entry.ru }
    : { source: entry.ru, target: entry.en };
}

/** Protects approved glossary terms from model drift. */
export function maskGlossary(text, entries = [], direction = 'en-ru') {
  let masked = String(text || '');
  const placeholders = [];
  const sorted = [...entries]
    .filter((entry) => entry?.en?.trim() && entry?.ru?.trim())
    .sort((a, b) => directionTerms(b, direction).source.length - directionTerms(a, direction).source.length);

  for (const entry of sorted) {
    const { source, target } = directionTerms(entry, direction);
    const term = source.trim();
    const boundary = `(^|[^\\p{L}\\p{N}_])(${escapeRegExp(term)})(?=$|[^\\p{L}\\p{N}_])`;
    let index = 0;
    const regex = new RegExp(boundary, 'giu');
    masked = masked.replace(regex, (match, prefix, found) => {
      const placeholder = `RTE${placeholders.length}TOKEN`;
      placeholders.push({
        placeholder,
        source: found,
        target: caseAwareTarget(found, target.trim()),
        entryId: entry.id,
        occurrence: index,
      });
      index += 1;
      return `${prefix}${placeholder}`;
    });
  }
  return { text: masked, placeholders };
}

export function restoreGlossary(text, placeholders = []) {
  let restored = String(text || '');
  for (const item of placeholders) {
    const numeric = item.placeholder.match(/\d+/u)?.[0] || '';
    const variants = [
      escapeRegExp(item.placeholder),
      `RTE\\s*${numeric}\\s*TOKEN`,
      `RTE[-_ ]*${numeric}[-_ ]*TOKEN`,
    ];
    const regex = new RegExp(`(?:${variants.join('|')})`, 'giu');
    restored = restored.replace(regex, item.target);
  }
  return restored;
}

function multiset(values) {
  const map = new Map();
  for (const value of values) map.set(value, (map.get(value) || 0) + 1);
  return map;
}


const INVARIANT_REGEX = /(?:[Hh][Tt][Tt][Pp][Ss]?:\/\/[^\s]+|\b[\w.+-]+@[\w.-]+\.[\p{L}]{2,}\b|\b(?:\d+(?:[.,]\d+)*|[A-ZА-ЯЁ]{2,}\d*)\b)/gu;

/**
 * Protects values that should survive translation verbatim: URLs, email addresses,
 * numbers/version strings, and uppercase abbreviations.
 */
export function maskInvariants(text = '') {
  const placeholders = [];
  const masked = String(text).replace(INVARIANT_REGEX, (found) => {
    const trailing = found.match(/[),.;!?]+$/u)?.[0] || '';
    const value = trailing ? found.slice(0, -trailing.length) : found;
    if (!value) return found;
    const placeholder = `RTEINV${placeholders.length}TOKEN`;
    placeholders.push({ placeholder, value });
    return `${placeholder}${trailing}`;
  });
  return { text: masked, placeholders };
}

export function restoreInvariants(text = '', placeholders = []) {
  let restored = String(text);
  for (const item of placeholders) {
    const numeric = item.placeholder.match(/\d+/u)?.[0] || '';
    const variants = [
      escapeRegExp(item.placeholder),
      `RTE\\s*INV\\s*${numeric}\\s*TOKEN`,
      `RTE[-_ ]*INV[-_ ]*${numeric}[-_ ]*TOKEN`,
    ];
    restored = restored.replace(new RegExp(`(?:${variants.join('|')})`, 'giu'), item.value);
  }
  return restored;
}

export function extractInvariants(text = '') {
  const source = String(text);
  const patterns = [
    /https?:\/\/[^\s]+/giu,
    /\b[\w.+-]+@[\w.-]+\.[\p{L}]{2,}\b/giu,
    /\b(?:\d+[.,]?\d*|[A-ZА-ЯЁ]{2,}\d*)\b/gu,
  ];
  const values = [];
  for (const pattern of patterns) values.push(...(source.match(pattern) || []));
  return values.map((value) => value.replace(/[),.;!?]+$/u, ''));
}

export function invariantPreservationScore(source, target) {
  const expected = multiset(extractInvariants(source));
  if (!expected.size) return 1;
  const actual = multiset(extractInvariants(target));
  let total = 0;
  let matched = 0;
  for (const [token, count] of expected.entries()) {
    total += count;
    matched += Math.min(count, actual.get(token) || 0);
  }
  return total ? matched / total : 1;
}

function bigrams(value) {
  const text = normalizeText(value).replace(/\s+/gu, ' ');
  const result = [];
  for (let i = 0; i < text.length - 1; i += 1) result.push(text.slice(i, i + 2));
  return result;
}

function diceCoefficient(a, b) {
  if (a === b) return 1;
  const left = bigrams(a);
  const right = bigrams(b);
  if (!left.length || !right.length) return 0;
  const counts = multiset(left);
  let overlap = 0;
  for (const token of right) {
    const count = counts.get(token) || 0;
    if (count > 0) {
      overlap += 1;
      counts.set(token, count - 1);
    }
  }
  return (2 * overlap) / (left.length + right.length);
}

function tokenJaccard(a, b) {
  const left = new Set(normalizeText(a).split(/[^\p{L}\p{N}_]+/u).filter(Boolean));
  const right = new Set(normalizeText(b).split(/[^\p{L}\p{N}_]+/u).filter(Boolean));
  if (!left.size && !right.size) return 1;
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

export function textSimilarity(a, b) {
  if (normalizeText(a) === normalizeText(b)) return 1;
  return clamp01((diceCoefficient(a, b) * 0.62) + (tokenJaccard(a, b) * 0.38));
}

export function findBestMemoryMatch(entries = [], source, direction, threshold = 0.86) {
  let best = null;
  for (const entry of entries) {
    if (entry.direction !== direction) continue;
    const score = textSimilarity(source, entry.source);
    if (!best || score > best.score) best = { entry, score };
  }
  return best && best.score >= threshold ? best : null;
}

export function glossaryCoverageScore(source, target, entries = [], direction = 'en-ru') {
  const relevant = entries.filter((entry) => {
    const terms = directionTerms(entry, direction);
    return terms.source && normalizeText(source).includes(normalizeText(terms.source));
  });
  if (!relevant.length) return 1;
  const normalizedTarget = normalizeText(target);
  const hits = relevant.filter((entry) => {
    const terms = directionTerms(entry, direction);
    return normalizedTarget.includes(normalizeText(terms.target));
  }).length;
  return hits / relevant.length;
}

function lengthBalance(source, target) {
  const a = Math.max(1, normalizeText(source).length);
  const b = Math.max(1, normalizeText(target).length);
  return Math.min(a, b) / Math.max(a, b);
}

function punctuationContinuity(source, target) {
  const ending = (value) => value.trim().match(/[.!?…]+$/u)?.[0] || '';
  const sourceEnding = ending(source);
  const targetEnding = ending(target);
  if (!sourceEnding) return target.trim().length ? 0.9 : 0;
  return targetEnding ? 1 : 0.65;
}

function repetitionHealth(target) {
  const words = normalizeText(target).split(/[^\p{L}\p{N}_]+/u).filter((word) => word.length > 2);
  if (words.length < 6) return 1;
  const counts = multiset(words);
  const max = Math.max(...counts.values());
  const ratio = max / words.length;
  return clamp01(1 - Math.max(0, ratio - 0.18) * 2.5);
}

export function computeMetrics({
  source,
  translation,
  backTranslation = '',
  glossaryEntries = [],
  direction = 'en-ru',
  memoryTarget = '',
} = {}) {
  const balance = lengthBalance(source, translation);
  const alpha = backTranslation
    ? clamp01(0.08 + (0.92 * textSimilarity(source, backTranslation)))
    : clamp01(0.48 + (0.42 * balance));
  const invariant = invariantPreservationScore(source, translation);
  const glossary = glossaryCoverageScore(source, translation, glossaryEntries, direction);
  const container = clamp01((invariant * 0.58) + (glossary * 0.42));
  const flow = clamp01(
    (lengthBalance(source, translation) * 0.35)
    + (punctuationContinuity(source, translation) * 0.35)
    + (repetitionHealth(translation) * 0.30),
  );
  const memory = memoryTarget ? textSimilarity(translation, memoryTarget) : 0;
  const quality = clamp01((alpha * 0.42) + (container * 0.30) + (flow * 0.23) + (memory * 0.05));
  const resonance = clamp01((alpha * 0.34) + (quality * 0.30) + (container * 0.22) + (flow * 0.14));
  return { alpha, quality, container, flow, resonance, invariant, glossary, memory };
}

export function rankCandidates(candidates = [], context = {}) {
  return candidates
    .map((candidate, index) => {
      const metrics = computeMetrics({
        ...context,
        translation: candidate.text,
        backTranslation: candidate.backTranslation || '',
      });
      return { ...candidate, originalIndex: index, metrics, score: metrics.resonance };
    })
    .sort((a, b) => b.score - a.score);
}

export function formatBytes(bytes = 0) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} Б`;
  const units = ['КБ', 'МБ', 'ГБ', 'ТБ'];
  let size = value / 1024;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 100 ? 0 : size >= 10 ? 1 : 2)} ${units[index]}`;
}

export function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
