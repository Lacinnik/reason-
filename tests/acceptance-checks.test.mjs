import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { checkOutput } from '../tools/acceptance-cpu.mjs';

const corpus = JSON.parse(await readFile(new URL('./fixtures/acceptance-corpus.json', import.meta.url), 'utf8'));

test('acceptance checks flag the outputs observed in the 20 September protocol', () => {
  const lostSentence = checkOutput('The train arrives at 10:30. Please bring two tickets.', 'Поезд прибывает в РТЕЙНВ0ТОКЕН.', 'en-ru');
  assert.equal(lostSentence.automated, 'fail');
  assert.equal(lostSentence.checks.sentence_count.ok, false);
  assert.equal(lostSentence.checks.protected_values.ok, false);

  const droppedFirst = checkOutput('Сегодня хорошая погода. Мы идём в парк.', "We're going to the park.", 'ru-en');
  assert.equal(droppedFirst.checks.sentence_count.ok, false);
});

test('acceptance checks pass a complete translation with protected values', () => {
  const repaired = checkOutput('The train arrives at 10:30. Please bring two tickets.', 'Поезд прибывает в 10:30. Пожалуйста, принесите два билета.', 'en-ru');
  assert.equal(repaired.automated, 'pass');
});

test('acceptance checks require approved glossary terms', () => {
  const result = checkOutput('The field keeps its coherence.', 'Площадь сохраняет свою согласованность.', 'en-ru');
  assert.deepEqual(result.checks.glossary_terms.missing, ['field → поле', 'coherence → когерентность']);
});

test('acceptance corpus covers both protocol phrases and both directions', () => {
  const ids = new Set(corpus.cases.map((item) => item.id));
  assert.equal(ids.size, corpus.cases.length);
  assert.ok(ids.has('protocol-0920-en') && ids.has('protocol-0920-ru'));
  for (const dir of ['en-ru', 'ru-en']) assert.ok(corpus.cases.filter((item) => item.dir === dir).length >= 5);
});
