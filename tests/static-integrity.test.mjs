import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const runtimeFiles = [
  'index.html',
  'styles.css',
  'app.js',
  'engine-core.js',
  'storage.js',
  'sw.js',
  'manifest.webmanifest',
  'icon.svg',
  'vendor/transformers-3.7.2.js',
];

test('all browser runtime files exist', async () => {
  await Promise.all(runtimeFiles.map((file) => access(resolve(root, file))));
});

test('index references the production assets', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  assert.match(html, /href="styles\.css"/u);
  assert.match(html, /src="app\.js"/u);
  assert.match(html, /href="manifest\.webmanifest"/u);
});

test('service worker pre-caches every local runtime dependency', async () => {
  const sw = await readFile(resolve(root, 'sw.js'), 'utf8');
  for (const file of runtimeFiles.filter((file) => !['sw.js'].includes(file))) {
    assert.match(sw, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'), `${file} missing from shell cache`);
  }
});

test('temporary assembly artifacts are absent', async () => {
  const app = await readFile(resolve(root, 'app.js'), 'utf8');
  assert.doesNotMatch(app, /app\.part-|\.rte-upload|bundle-manifest/u);
});


test('WASM fallback uses the Transformers.js default backend', async () => {
  const app = await readFile(resolve(root, 'app.js'), 'utf8');
  assert.doesNotMatch(app, /device:\s*['"]wasm['"]/u);
  assert.match(app, /attempt\.device\)\s+pipelineOptions\.device\s*=\s*attempt\.device/u);
  assert.match(app, /WebGPU/u);
});


test('neural pipelines are disposed before switching direction', async () => {
  const app = await readFile(resolve(root, 'app.js'), 'utf8');
  assert.match(app, /typeof engine\.dispose === ['"]function['"]/u);
  assert.match(app, /await disposeAllEngines\(\)/u);
  assert.match(app, /pagehide/u);
});
