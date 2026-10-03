#!/usr/bin/env node
// Runs the re-acceptance corpus through the real RTE pipeline on ONNX CPU and records evidence.
// It never accepts the release: every report leaves reviewer_decision empty for a person to fill.
//
//   npm install --no-save @huggingface/transformers@3.7.2
//   node tools/acceptance-cpu.mjs [report.json]
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import {
  DEFAULT_GLOSSARY, LIBRARY_VERSION, directionTerms, extractInvariants, generateSegmentCandidates,
  hasProtectedToken, joinDocumentCandidate, splitTextIntoSegments,
} from '../engine-core.js';

const MODELS = { 'en-ru': 'Xenova/opus-mt-en-ru', 'ru-en': 'Xenova/opus-mt-ru-en' };
const LOCALE = { 'en-ru': ['en', 'ru'], 'ru-en': ['ru', 'en'] };
const reverse = (dir) => (dir === 'en-ru' ? 'ru-en' : 'en-ru');
const multiset = (values) => values.map((value) => value.toLowerCase()).sort().join('\u0000');
const paragraphs = (text) => String(text).split(/\n\s*\n/u).filter((part) => part.trim()).length;

const engines = {};
async function engine(dir) {
  const { pipeline } = await import('@huggingface/transformers');
  try {
    engines[dir] ??= await pipeline('translation', MODELS[dir], { dtype: 'q8' });
  } catch (error) {
    // Infrastructure failure, not a translation result: stop instead of recording a rejection.
    throw Object.assign(new Error(`Cannot load ${MODELS[dir]}: ${error.message}`), { fatal: true });
  }
  return engines[dir];
}

async function translate(text, dir, candidateCount) {
  const [sourceLocale] = LOCALE[dir];
  const segments = splitTextIntoSegments(text, { maxChars: 420, locale: sourceLocale });
  const translated = [];
  for (const segment of segments) {
    translated.push({ candidates: await generateSegmentCandidates(segment.text, await engine(dir), { candidateCount, glossary: DEFAULT_GLOSSARY, direction: dir }) });
  }
  return Array.from({ length: candidateCount }, (_, index) => joinDocumentCandidate(segments, translated, index));
}

export function checkOutput(source, output, dir) {
  const [sourceLocale, targetLocale] = LOCALE[dir];
  const sourceSentences = splitTextIntoSegments(source, { maxChars: 10_000, locale: sourceLocale }).length;
  const outputSentences = splitTextIntoSegments(output, { maxChars: 10_000, locale: targetLocale }).length;
  const glossaryMissing = DEFAULT_GLOSSARY
    .map((entry) => directionTerms(entry, dir))
    .filter(({ source: term }) => new RegExp(`(^|[^\\p{L}])${term}([^\\p{L}]|$)`, 'iu').test(source))
    .filter(({ target }) => !output.toLowerCase().includes(target.toLowerCase()))
    .map(({ source: term, target }) => `${term} → ${target}`);
  const checks = {
    sentence_count: { source: sourceSentences, output: outputSentences, ok: sourceSentences === outputSentences },
    paragraph_count: { source: paragraphs(source), output: paragraphs(output), ok: paragraphs(source) === paragraphs(output) },
    protected_values: { expected: extractInvariants(source), found: extractInvariants(output), ok: multiset(extractInvariants(source)) === multiset(extractInvariants(output)) },
    no_service_mask: { ok: !hasProtectedToken(output) },
    glossary_terms: { missing: glossaryMissing, ok: glossaryMissing.length === 0 },
  };
  return { checks, automated: Object.values(checks).every((check) => check.ok) ? 'pass' : 'fail' };
}

async function run(caseItem, mode) {
  const record = { case: caseItem.id, dir: caseItem.dir, mode, input: caseItem.text };
  try {
    const outputs = await translate(caseItem.text, caseItem.dir, mode === 'three-forms' ? 3 : 1);
    record.outputs = outputs.map((output) => ({ output, ...checkOutput(caseItem.text, output, caseItem.dir) }));
    if (mode === 'back-check') record.back_translation = (await translate(outputs[0], reverse(caseItem.dir), 1))[0];
    record.automated = record.outputs.every((item) => item.automated === 'pass') ? 'pass' : 'fail';
  } catch (error) {
    if (error.fatal) throw error;
    // A rejection by the protected-value gate is recorded, never silently turned into output.
    record.rejected = error.message;
    record.automated = 'rejected';
  }
  record.reviewer_decision = null;
  return record;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const corpus = JSON.parse(await readFile(new URL('../tests/fixtures/acceptance-corpus.json', import.meta.url), 'utf8'));
  const results = [];
  for (const caseItem of corpus.cases) {
    for (const mode of ['normal', 'three-forms', 'back-check']) {
      const record = await run(caseItem, mode);
      console.log(`${record.automated.padEnd(8)} ${caseItem.id} · ${mode}`);
      results.push(record);
    }
  }
  const summary = Object.fromEntries(['pass', 'fail', 'rejected'].map((key) => [key, results.filter((item) => item.automated === key).length]));
  const report = {
    schema: 'rte.acceptance-report/1.0.0',
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    generated_at: new Date().toISOString(),
    environment: { runtime: `Node.js ${process.versions.node}`, library: `Transformers.js ${LIBRARY_VERSION}`, backend: 'ONNX CPU q8', models: MODELS },
    scope: 'Conditions 1–4 and 6 of ACCEPTANCE_STATUS.md on CPU. Not a browser/WASM, iPhone or offline-restart check (condition 5). Automated checks detect loss, masks and protected values; they do not judge translation quality.',
    summary,
    results,
  };
  const target = process.argv[2] || 'acceptance-report.json';
  await writeFile(target, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\n${summary.pass} pass · ${summary.fail} fail · ${summary.rejected} rejected → ${target}`);
}
