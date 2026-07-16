import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const requiredIds = [
  'source', 'target', 'translate', 'swap', 'approve', 'candidateCount',
  'deepCheck', 'glossaryEnabled', 'deviceMode', 'segmentSize',
  'candidatesSection', 'candidatesList', 'prepareCurrent', 'prepareAll',
  'modelEnRu', 'modelRuEn', 'memoryList', 'glossaryList',
];

test('HTML exposes the complete RTE v2 interface', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of requiredIds) assert.match(html, new RegExp(`id=["']${id}["']`, 'u'), `missing #${id}`);
  assert.match(html, /<script\s+type=["']module["']\s+src=["']app\.js["']/u);
  assert.match(html, /styles\.css/u);
});

test('manifest is valid and scoped for GitHub Pages', async () => {
  const raw = await readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8');
  const manifest = JSON.parse(raw);
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);
});

test('service worker precaches every local runtime module', async () => {
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  for (const file of ['index.html', 'app.js', 'styles.css', 'engine-core.js', 'storage.js', 'manifest.webmanifest', 'icon.svg', 'vendor/transformers-3.7.2.js']) {
    assert.match(sw, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'), `service worker omits ${file}`);
  }
});

test('repository package contains no temporary assembly artifacts', async () => {
  const root = new URL('../', import.meta.url);
  const entries = await readdir(root);
  assert.ok(!entries.some((name) => name.startsWith('app.part-')));
  assert.ok(!entries.includes('.rte-upload'));
  assert.ok(!entries.includes('bundle-manifest.txt'));
});

test('Transformers loader is pinned to the approved version', async () => {
  const loader = await readFile(new URL('../vendor/transformers-3.7.2.js', import.meta.url), 'utf8');
  assert.match(loader, /@huggingface\/transformers@3\.7\.2/u);
  assert.doesNotMatch(loader, /@latest/u);
});
