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
  return text.match(/[\s\S]+?(?:[.!?…]+[”»"')\]]*(?=\s|$)|$)\s*/gu) || [text];
}

/** One sentence per model call; preserve all source whitespace for reconstruction.
 * Oversized sentences split at whitespace; an indivisible token is never cut.
 */
export function splitTextIntoSegments(text, { maxChars = 420, locale = 'ru' } = {}) {
  if (!Number.isInteger(maxChars) || maxChars < 1) throw new Error('Invalid segment size');
  const source = String(text || '').replace(/\r\n?/g, '\n');
  const segments = [];
  let pending = '';
  for (const line of source.split(/(\n+)/u)) {
    if (!line.trim()) { pending += line; continue; }
    for (const sentence of sentenceParts(line, locale)) {
      let current = '';
      for (const piece of sentence.match(/\s+|\S+/gu) || []) {
        if (/^\s+$/u.test(piece)) { pending += piece; continue; }
        if (current && current.length + pending.length + piece.length > maxChars) {
          segments.at(-1).text = current;
          current = '';
        }
        if (!current) {
          segments.push({ text: piece, prefix: pending });
          current = piece;
        } else {
          current += pending + piece;
          segments.at(-1).text = current;
        }
        pending = '';
      }
    }
  }
  if (pending && segments.length) segments.at(-1).suffix = pending;
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


const INVARIANT_REGEX = /(?:[Hh][Tt][Tt][Pp][Ss]?:\/\/[^\s]+|\b[\w.+-]+@[\w.-]+\.[\p{L}]{2,}\b|\b(?:\d{1,2}:\d{2}(?::\d{2})?|\d+(?:[.,]\d+)*|[A-ZА-ЯЁ]{2,}\d*)\b)/gu;

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

// Recognise only known spellings and the exact numeric ID. Never guess a value.
function protectedTokenPattern(placeholder) {
  const id = escapeRegExp(placeholder.match(/\d+/u)?.[0] || '');
  const gap = '[-_\\s]*';
  const prefix = '(?:RTE|РТЕ|РТЭ|РТИ)';
  const invariant = placeholder.startsWith('RTEINV') ? `${gap}(?:INV|ИНВ|ЙНВ)` : '';
  return new RegExp(`${prefix}${invariant}${gap}${id}${gap}(?:TOKEN|ТОКЕН|ТОКИН)(?![\\p{L}\\p{N}_])`, 'giu');
}

export function hasProtectedToken(text = '') {
  return /(?:RTE|РТЕ|РТЭ|РТИ)[-_\s]*(?:(?:I[-_\s]*N[-_\s]*V|[ИЙ][-_\s]*Н[-_\s]*В)[-_\s]*)?\d/iu.test(String(text));
}

// Check whole terms, longest first: one output span cannot satisfy two terms.
function literalGlossaryPreserved(target, placeholders) {
  const expected = multiset(placeholders.map(item => item.target.trim().toLowerCase()));
  if (!expected.size) return true;
  if (expected.has('')) return false;
  const terms = [...expected.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp);
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])(${terms.join('|')})(?=$|[^\\p{L}\\p{N}_])`, 'giu');
  const actual = multiset([...String(target).matchAll(pattern)].map(match => match[2].toLowerCase()));
  return expected.size === actual.size && [...expected].every(([term, count]) => actual.get(term) === count);
}

// An unmasked retry is accepted only with exact values and approved whole terms.
// Term case may change with sentence position; inflections/synonyms are not guessed.
export function validateLiteralTranslation(source, target, glossaryPlaceholders = []) {
  if (!String(target || '').trim() || hasProtectedToken(target)) return false;
  const expected = multiset(maskInvariants(source).placeholders.map(item => item.value));
  const actual = multiset(maskInvariants(target).placeholders.map(item => item.value));
  return expected.size === actual.size && [...expected].every(([value, count]) => actual.get(value) === count)
    && literalGlossaryPreserved(target, glossaryPlaceholders);
}

/** A missing, repeated or unknown marker invalidates this entire candidate. */
export function restoreProtectedTranslation(text, glossary = [], invariants = []) {
  let restored = String(text || '').trim();
  if (!restored) throw new Error('Модель не вернула текст перевода.');
  const replacements = [...glossary.map(item => ({ ...item, value: item.target })), ...invariants];
  // Validate before replacing so values cannot be interpreted as new markers.
  for (const item of replacements) {
    if ([...restored.matchAll(protectedTokenPattern(item.placeholder))].length !== 1) {
      throw new Error('Защищённое значение потеряно или повторено. Перевод не принят.');
    }
  }
  for (const item of replacements) {
    restored = restored.replace(protectedTokenPattern(item.placeholder), () => item.value);
  }
  if (hasProtectedToken(restored)) throw new Error('В переводе осталась служебная маска. Перевод не принят.');
  return restored;
}

export function joinDocumentCandidate(segments, translatedSegments, candidateIndex) {
  if (segments.length !== translatedSegments.length) throw new Error('Не все сегменты переведены.');
  return segments.map((segment, index) => {
    const text = translatedSegments[index]?.candidates?.[candidateIndex];
    if (!String(text || '').trim() || hasProtectedToken(text)) {
      throw new Error(`Сегмент ${index + 1} не прошёл проверку. Перевод не принят.`);
    }
    return `${segment.prefix || ''}${text}${segment.suffix || ''}`;
  }).join('').trim();
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

function normalizePipelineOutput(result) {
  const list = Array.isArray(result) ? result : [result];
  return list
    .map((item) => item?.translation_text ?? item?.generated_text ?? '')
    .map((text) => String(text).trim())
    .filter(Boolean);
}

function looksDegenerateTranslation(source, translation) {
  const output = String(translation || '').trim();
  if (!output) return true;
  if ((output.match(/\.1%/gu) || []).length >= 3) return true;
  const tokens = normalizeText(output).split(/[^\p{L}\p{N}%]+/u).filter(Boolean);
  if (tokens.length >= 24 && (new Set(tokens).size / tokens.length) < 0.32) return true;
  const sourceLength = Math.max(1, String(source || '').trim().length);
  return output.length > Math.max(480, sourceLength * 10);
}

export async function generateSegmentCandidates(segmentText, engine, { candidateCount = 1, glossary = [], direction = 'en-ru' } = {}) {
  if (![1, 3].includes(candidateCount) || hasProtectedToken(segmentText)) throw new Error('Недопустимый запрос перевода.');
  const invariantProtected = maskInvariants(segmentText);
  const glossaryProtected = maskGlossary(invariantProtected.text, glossary, direction);
  const beams = candidateCount > 1 ? Math.max(4, candidateCount) : 2;
  const maxNewTokens = Math.min(512, Math.max(64, Math.ceil(segmentText.length * 1.8)));

  let result;
  try {
    result = await engine(glossaryProtected.text, {
      max_new_tokens: maxNewTokens,
      num_beams: beams,
      num_return_sequences: candidateCount,
      early_stopping: true,
      no_repeat_ngram_size: 3,
      length_penalty: 1,
      do_sample: false,
    });
  } catch (error) {
    if (candidateCount > 1) {
      console.warn('Multi-candidate generation failed; falling back to one sequence.', error);
      result = await engine(glossaryProtected.text, {
        max_new_tokens: maxNewTokens,
        num_beams: 2,
        num_return_sequences: 1,
        early_stopping: true,
      });
    } else {
      throw error;
    }
  }

  const restored = [];
  for (const text of normalizePipelineOutput(result)) {
    try {
      const candidate = restoreProtectedTranslation(text, glossaryProtected.placeholders, invariantProtected.placeholders);
      if (!looksDegenerateTranslation(segmentText, candidate)) restored.push(candidate);
    } catch (error) {
      console.warn('Candidate rejected by protected-value gate:', error.message);
    }
  }
  if (!restored.length) {
    // One bounded retry without markers; both values and glossary must survive.
    const literal = await engine(segmentText, {
      max_new_tokens: maxNewTokens, num_beams: 2, num_return_sequences: 1,
      early_stopping: true, do_sample: false,
    });
    for (const text of normalizePipelineOutput(literal)) {
      if (validateLiteralTranslation(segmentText, text, glossaryProtected.placeholders) && !looksDegenerateTranslation(segmentText, text)) restored.push(text);
    }
  }
  if (!restored.length) {
    throw new Error('Ни один вариант не прошёл проверку защищённых значений и непустого результата. Перевод не принят.');
  }
  while (restored.length < candidateCount) restored.push(restored[0]);
  return restored.slice(0, candidateCount);
}
