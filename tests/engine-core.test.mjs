import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMetrics,
  findBestMemoryMatch,
  formatBytes,
  glossaryCoverageScore,
  normalizeText,
  safeJsonParse,
  extractInvariants,
  invariantPreservationScore,
  maskGlossary,
  maskInvariants,
  rankCandidates,
  restoreGlossary,
  restoreInvariants,
  splitTextIntoSegments,
  textSimilarity,
} from '../engine-core.js';

test('segmentation preserves paragraph order and keeps chunks bounded', () => {
  const input = 'First sentence. Second sentence is longer but still clear.\n\nТретий абзац. Четвёртое предложение.';
  const segments = splitTextIntoSegments(input, { maxChars: 42, locale: 'en' });
  assert.ok(segments.length >= 3);
  assert.ok(segments.every((segment) => segment.text.length <= 42));
  const rebuilt = segments.map((segment) => `${segment.prefix || ''}${segment.text}${segment.suffix || ''}`).join('');
  assert.match(rebuilt, /First sentence/u);
  assert.match(rebuilt, /Третий абзац/u);
  assert.ok(rebuilt.indexOf('First') < rebuilt.indexOf('Третий'));
});

test('glossary masking restores approved target term', () => {
  const glossary = [{ id: '1', en: 'coherence', ru: 'когерентность' }];
  const masked = maskGlossary('The coherence of the field.', glossary, 'en-ru');
  assert.match(masked.text, /RTE\d+TOKEN/u);
  const restored = restoreGlossary(`The ${masked.placeholders[0].placeholder} of the field.`, masked.placeholders);
  assert.equal(restored, 'The когерентность of the field.');
});

test('similarity is exact for identical text and lower for unrelated text', () => {
  assert.equal(textSimilarity('Same text', 'same text'), 1);
  assert.ok(textSimilarity('The field holds coherence', 'Bananas are yellow') < 0.4);
});

test('invariants detect numbers and preserve exact values', () => {
  assert.deepEqual(extractInvariants('Order 42 at https://example.com'), ['https://example.com', '42']);
  assert.equal(invariantPreservationScore('Version 2.1 costs 300 USD', 'Версия 2.1 стоит 300 USD'), 1);
  assert.ok(invariantPreservationScore('Version 2.1 costs 300 USD', 'Версия стоит 250') < 1);
});

test('back translation raises alpha when it returns close to source', () => {
  const good = computeMetrics({ source: 'The field preserves coherence.', translation: 'Поле сохраняет когерентность.', backTranslation: 'The field preserves coherence.' });
  const weak = computeMetrics({ source: 'The field preserves coherence.', translation: 'Поле сохраняет когерентность.', backTranslation: 'A different unrelated statement.' });
  assert.ok(good.alpha > weak.alpha);
  assert.ok(good.resonance > weak.resonance);
});

test('candidate ranking prefers preserved invariants', () => {
  const ranked = rankCandidates([
    { text: 'Стоимость 250.' },
    { text: 'Стоимость 300.' },
  ], { source: 'The cost is 300.' });
  assert.equal(ranked[0].text, 'Стоимость 300.');
});


test('invariant masking protects URLs, email, versions, and abbreviations', () => {
  const source = 'Send v2.1 to DEV at mail@example.com and https://example.com/a?x=1.';
  const masked = maskInvariants(source);
  assert.ok(masked.placeholders.length >= 4);
  assert.doesNotMatch(masked.text, /mail@example\.com/u);
  const distorted = masked.text.replace(/RTEINV/gu, 'RTE INV ');
  assert.equal(restoreInvariants(distorted, masked.placeholders), source);
});

test('glossary protection works in RU to EN direction', () => {
  const glossary = [{ id: '1', en: 'coherence', ru: 'когерентность' }];
  const masked = maskGlossary('Когерентность поля.', glossary, 'ru-en');
  const restored = restoreGlossary(masked.text, masked.placeholders);
  assert.equal(restored, 'Coherence поля.');
});

test('segmentation preserves single newlines inside a paragraph', () => {
  const input = 'Line one.\nLine two continues.\n\nNext paragraph.';
  const segments = splitTextIntoSegments(input, { maxChars: 30, locale: 'en' });
  const rebuilt = segments.map((segment) => `${segment.prefix || ''}${segment.text}${segment.suffix || ''}`).join('');
  assert.match(rebuilt, /Line one/u);
  assert.match(rebuilt, /Next paragraph/u);
  assert.ok(rebuilt.indexOf('Line one') < rebuilt.indexOf('Next paragraph'));
});


test('normalization makes whitespace and Unicode forms stable', () => {
  assert.equal(normalizeText('  Ｆｉｅｌｄ\u00a0  VALUE \n  Next  '), 'field value\nnext');
});

test('memory matching respects direction and threshold', () => {
  const entries = [
    { id: 'a', direction: 'en-ru', source: 'The field preserves coherence.', target: 'Поле сохраняет когерентность.' },
    { id: 'b', direction: 'ru-en', source: 'Поле сохраняет когерентность.', target: 'The field preserves coherence.' },
  ];
  const match = findBestMemoryMatch(entries, 'The field preserves coherence!', 'en-ru', 0.8);
  assert.equal(match.entry.id, 'a');
  assert.equal(findBestMemoryMatch(entries, 'Unrelated sentence', 'en-ru', 0.95), null);
});

test('glossary coverage measures approved terminology in both directions', () => {
  const glossary = [{ id: '1', en: 'coherence', ru: 'когерентность' }];
  assert.equal(glossaryCoverageScore('Coherence matters.', 'Когерентность важна.', glossary, 'en-ru'), 1);
  assert.equal(glossaryCoverageScore('Когерентность важна.', 'Coherence matters.', glossary, 'ru-en'), 1);
  assert.equal(glossaryCoverageScore('Coherence matters.', 'Связность важна.', glossary, 'en-ru'), 0);
});

test('utility formatting and safe JSON parsing are deterministic', () => {
  assert.equal(formatBytes(0), '0 Б');
  assert.equal(formatBytes(1024), '1.00 КБ');
  assert.deepEqual(safeJsonParse('{"ok":true}'), { ok: true });
  assert.deepEqual(safeJsonParse('{broken', { ok: false }), { ok: false });
});
