import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../field-check/', import.meta.url);

test('Collective Field Check ships a complete local decision flow', async () => {
  const [html, css, js] = await Promise.all([
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('styles.css', root), 'utf8'),
    readFile(new URL('app.js', root), 'utf8'),
  ]);
  for (const stage of ['setup', 'field', 'result']) assert.match(html, new RegExp(`data-stage=["']${stage}["']`, 'u'));
  assert.match(html, /COLLECTIVE META CORE · STABLE 1\.0/u);
  assert.match(js, /reson\.collective-meta-decision\/1\.0\.0/u);
  assert.match(js, /linksVerified/u);
  assert.match(js, /value >= \.75/u);
  assert.match(js, /names\.length >= 2 && names\.length <= 6/u);
  assert.match(js, /toLocaleLowerCase\("ru-RU"\)/u);
  assert.doesNotMatch(js, /slice\(0, 6\)/u);
  assert.match(js, /localStorage\.setItem/u);
  assert.match(js, /document\.body\.append\(link\)/u);
  assert.match(js, /setTimeout\(\(\) =>/u);
  assert.match(js, /serviceWorker\.register\("\.\.\/sw\.js"\)/u);
  assert.match(css, /-webkit-appearance:none/u);
});

test('Collective Field Check has no external runtime dependency', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.doesNotMatch(html, /https?:\/\//u);
  assert.match(html, /\.\/app\.js/u);
  assert.match(html, /\.\/styles\.css/u);
});
