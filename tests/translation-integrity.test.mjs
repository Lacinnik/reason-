import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_GLOSSARY, splitTextIntoSegments, maskInvariants, maskGlossary, restoreProtectedTranslation, hasProtectedToken, joinDocumentCandidate, generateSegmentCandidates, validateLiteralTranslation } from '../engine-core.js';

test('each recorded regression sentence receives its own model request', () => {
  for (const [source, locale] of [
    ['The train arrives at 10:30. Please bring two tickets.', 'en'],
    ['Сегодня хорошая погода. Мы идём в парк.', 'ru'],
  ]) {
    const segments = splitTextIntoSegments(source, { locale });
    assert.equal(segments.length, 2);
    assert.equal(segments.map(s => `${s.prefix}${s.text}${s.suffix || ''}`).join(''), source);
  }
});

test('sentence splitting preserves line breaks, leading and trailing whitespace', () => {
  const source = '  One sentence.\nSecond sentence.\n\n\tThird sentence.  ';
  const segments = splitTextIntoSegments(source, { locale: 'en', maxChars: 12 });
  assert.equal(segments.map(s => `${s.prefix}${s.text}${s.suffix || ''}`).join(''), source);
});

test('long indivisible URL is never sliced or changed', () => {
  const source = 'See https://example.com/' + 'a'.repeat(450) + '?x=1.';
  const segments = splitTextIntoSegments(source, { locale: 'en', maxChars: 100 });
  assert.equal(segments.map(s => `${s.prefix}${s.text}${s.suffix || ''}`).join(''), source);
  assert.ok(segments.some(s => s.text.includes('https://example.com/')));
});

test('clock time is one invariant and its observed Cyrillic marker is restored', () => {
  const masked = maskInvariants('The train arrives at 10:30.');
  assert.deepEqual(masked.placeholders.map(p => p.value), ['10:30']);
  assert.equal(restoreProtectedTranslation('Поезд прибывает в РТЕЙНВ0ТОКЕН.', [], masked.placeholders), 'Поезд прибывает в 10:30.');
});

test('missing, repeated and unknown IDs fail closed instead of manufacturing a value', () => {
  const { placeholders } = maskInvariants('Bring 42 copies.');
  for (const value of ['Принесите копии.', 'RTEINV0TOKEN RTEINV0TOKEN', 'RTEINV10TOKEN', 'RTEINV0TOKEN RTEINV99TOKEN']) {
    assert.throws(() => restoreProtectedTranslation(value, [], placeholders));
  }
});

test('glossary and invariant IDs are independent and replacement dollars stay literal', () => {
  const protectedSource = maskInvariants('Coherence costs 42.');
  const glossary = maskGlossary(protectedSource.text, [{ en: 'Coherence', ru: '$& coherence' }], 'en-ru');
  assert.equal(restoreProtectedTranslation('RTE0TOKEN стоит RTE INV 0 TOKEN.', glossary.placeholders, protectedSource.placeholders), '$& coherence стоит 42.');
});

test('both orders preserve distinct clock times without renumbering', () => {
  const { placeholders } = maskInvariants('At 10:30 and 12:45.');
  assert.equal(restoreProtectedTranslation('РТЕИНВ1ТОКЕН / RTEINV0TOKEN', [], placeholders), '12:45 / 10:30');
});

test('document assembly rejects missing or empty segment and untranslated markers', () => {
  const segments = splitTextIntoSegments('First. Second.', { locale: 'en' });
  for (const outputs of [[{ candidates: ['Первое.'] }], [{ candidates: ['Первое.'] }, { candidates: [''] }], [{ candidates: ['Первое.'] }, { candidates: ['РТЕЙНВ0ТОКЕН'] }]]) {
    assert.throws(() => joinDocumentCandidate(segments, outputs, 0));
  }
  assert.equal(joinDocumentCandidate(segments, [{ candidates: ['Первое.'] }, { candidates: ['Второе.'] }], 0), 'Первое. Второе.');
});

test('reserved markers are detected in user input or imported memory', () => {
  for (const value of ['RTE0TOKEN', 'РТЕЙНВ0ТОКЕН', 'rte inv 2 token', 'RTEINV0*KEN', 'RTEIN V1TOkEN', 'РТИ0ТОКЕН', 'РТИ1*КИН']) assert.equal(hasProtectedToken(value), true);
  assert.equal(hasProtectedToken('Встреча в 10:30.'), false);
});

test('observed Cyrillic spellings restore only the exact glossary IDs', () => {
  const glossary = maskGlossary('Coherence and resonance.', DEFAULT_GLOSSARY).placeholders;
  assert.equal(restoreProtectedTranslation('РТИ0ТОКЕН и РТЕ1ТОКИН.', glossary), 'Когерентность и резонанс.');
  for (const target of ['РТИ0ТОКЕН и РТЕТОКЕНА.', 'РТИ0ТОКЕН и РТЕ10ТОКИН.', 'РТИ0ТОКЕН РТИ0ТОКЕН РТЕ1ТОКИН.', 'РТИ0ТОКЕН и РТЕ1ТОКИН РТИ99*КИН']) {
    assert.throws(() => restoreProtectedTranslation(target, glossary), undefined, target);
  }
});

test('literal retry requires exact time, count and no new numeric values', () => {
  const source = 'Встреча в 09:15. Код 42.';
  assert.equal(validateLiteralTranslation(source, 'Meeting at 09:15. Code 42.'), true);
  for (const target of ['Meeting at 15:09. Code 42.', 'Meeting at 09:15.', 'Meeting at 09:15. Code 42. Room 7.']) assert.equal(validateLiteralTranslation(source, target), false);
});

test('model orchestration drops an invalid beam while retaining a valid candidate', async () => {
  const engine = async () => [{ translation_text: 'Нет значения.' }, { translation_text: 'Код RTEINV0TOKEN.' }];
  assert.deepEqual(await generateSegmentCandidates('Code 42.', engine, { candidateCount: 3 }), ['Код 42.', 'Код 42.', 'Код 42.']);
});

test('one literal retry recovers mangled markers only when exact values survive', async () => {
  const calls = [];
  const engine = async text => { calls.push(text); return [{ translation_text: calls.length === 1 ? 'RTEINV0*KEN' : 'Meeting at 09:15.' }]; };
  assert.deepEqual(await generateSegmentCandidates('Встреча в 09:15.', engine), ['Meeting at 09:15.']);
  assert.equal(calls.length, 2);
  assert.equal(calls[1], 'Встреча в 09:15.');
});

test('literal retry cannot accept missing numbers and stops after two calls', async () => {
  let calls = 0;
  const engine = async () => { calls++; return [{ translation_text: 'The meeting.' }]; };
  await assert.rejects(generateSegmentCandidates('Встреча в 09:15.', engine));
  assert.equal(calls, 2);
});

test('glossary retry rejects a synonym outside the approved dictionary', async () => {
  let calls = 0;
  const engine = async () => { calls++; return [{ translation_text: 'Иной термин.' }]; };
  await assert.rejects(generateSegmentCandidates('Coherence.', engine, { glossary: [{ en: 'coherence', ru: 'когерентность' }] }));
  assert.equal(calls, 2);
});

test('damaged glossary marker recovers through a checked literal translation', async () => {
  const inputs = [];
  const engine = async text => {
    inputs.push(text);
    return [{ translation_text: inputs.length === 1 ? 'RTE0*KEN field.' : 'Coherence of the field.' }];
  };
  assert.deepEqual(await generateSegmentCandidates('Когерентность поля.', engine, {
    direction: 'ru-en', glossary: [{ en: 'coherence', ru: 'когерентность' }], candidateCount: 3,
  }), Array(3).fill('Coherence of the field.'));
  assert.deepEqual(inputs, ['RTE0TOKEN поля.', 'Когерентность поля.']);
});

test('literal glossary requires whole terms with exact occurrence counts', () => {
  const protectedTerms = [{ target: 'Coherence' }, { target: 'resonance' }];
  assert.equal(validateLiteralTranslation('Когерентность и резонанс.', 'Coherence and resonance.', protectedTerms), true);
  for (const target of ['Coherence.', 'Coherence, coherence and resonance.', 'Incoherence and resonance.', 'Coherences and resonance.', 'Consistency and resonance.', 'Coherence and RTE0TOKEN resonance.']) {
    assert.equal(validateLiteralTranslation('Когерентность и резонанс.', target, protectedTerms), false, target);
  }
  assert.equal(validateLiteralTranslation('Когерентность, когерентность.', 'Coherence, coherence.', [{ target: 'Coherence' }, { target: 'coherence' }]), true);
});

test('glossary retry cannot lose or change time even with the correct term', async () => {
  let calls = 0;
  await assert.rejects(generateSegmentCandidates('Когерентность в 09:15.', async () => {
    calls++;
    return [{ translation_text: calls === 1 ? 'RTE0*KEN RTEINV0*KEN' : 'Coherence at 0915.' }];
  }, { direction: 'ru-en', glossary: [{ ru: 'когерентность', en: 'coherence' }] }));
  assert.equal(calls, 2);
});

test('overlapping target phrases cannot reuse one span to satisfy two entries', () => {
  const terms = [{ target: 'field coherence' }, { target: 'coherence' }];
  assert.equal(validateLiteralTranslation('Термины.', 'Field coherence.', terms), false);
  assert.equal(validateLiteralTranslation('Термины.', 'Field coherence and coherence.', terms), true);
});

test('literal Cyrillic terms respect Unicode boundaries and literal regex characters', () => {
  const terms = [{ target: 'когерентность' }];
  assert.equal(validateLiteralTranslation('Coherence.', 'Когерентность.', terms), true);
  assert.equal(validateLiteralTranslation('Coherence.', 'Некогерентность.', terms), false);
  assert.equal(validateLiteralTranslation('Term.', 'a+b.', [{ target: 'a+b' }]), true);
  assert.equal(validateLiteralTranslation('Term.', 'aaab.', [{ target: 'a+b' }]), false);
});

const observed = JSON.parse(await readFile(new URL('./fixtures/neural-20260922.json', import.meta.url), 'utf8'));
for (const record of observed.filter(item => item.version === 'after')) {
  test(`replay actual q8 model responses through current orchestration: ${record.source}`, async () => {
    let index = 0;
    const segments = splitTextIntoSegments(record.source, { locale: record.dir === 'en-ru' ? 'en' : 'ru' });
    const run = async () => {
      const outputs = [];
      for (const segment of segments) {
        const candidates = await generateSegmentCandidates(segment.text, async (input, options) => {
          const call = record.raw[index++];
          assert.equal(input, call.input);
          assert.deepEqual(options, call.options);
          return call.result;
        }, { candidateCount: 3, direction: record.dir });
        outputs.push({ candidates });
      }
      return joinDocumentCandidate(segments, outputs, 0);
    };
    if (record.error) await assert.rejects(run, /Ни один вариант/u);
    else assert.equal(await run(), record.output);
    assert.equal(index, record.raw.length);
  });
}

const glossaryObserved = JSON.parse(await readFile(new URL('./fixtures/glossary-20260922.json', import.meta.url), 'utf8'));
for (const record of glossaryObserved.filter(item => item.version === 'after')) {
  test(`replay observed glossary model responses: ${record.source}`, async () => {
    let index = 0;
    const run = () => generateSegmentCandidates(record.source, async (input, options) => {
      const call = record.raw[index++];
      assert.equal(input, call.input);
      assert.deepEqual(options, call.options);
      return call.result;
    }, { direction: record.direction, glossary: DEFAULT_GLOSSARY, candidateCount: 1 });
    const recovered = record.direction === 'en-ru' && record.source === 'Coherence and resonance.';
    if (recovered) assert.deepEqual(await run(), ['Когерентность и резонанс.']);
    else if (record.error) await assert.rejects(run, /Ни один вариант/u);
    else assert.deepEqual(await run(), record.output);
    assert.equal(index, recovered ? 1 : record.raw.length);
  });
}

const spellingsObserved = JSON.parse(await readFile(new URL('./fixtures/marker-spellings-20260922.json', import.meta.url), 'utf8'));
for (const record of spellingsObserved.filter(item => item.version === 'after')) {
  test(`replay observed EN→RU marker spellings: ${record.source}`, async () => {
    let index = 0;
    const run = () => generateSegmentCandidates(record.source, async (input, options) => {
      const call = record.raw[index++];
      assert.equal(input, call.input);
      assert.deepEqual(options, call.options);
      return call.result;
    }, { direction: 'en-ru', glossary: DEFAULT_GLOSSARY });
    if (record.error) await assert.rejects(run, /Ни один вариант/u);
    else assert.deepEqual(await run(), record.output);
    assert.equal(index, record.raw.length);
  });
}
