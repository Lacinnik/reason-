import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

class MemoryLocalStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(String(key), String(value)); }
  removeItem(key) { this.values.delete(String(key)); }
  clear() { this.values.clear(); }
}

globalThis.localStorage = new MemoryLocalStorage();
delete globalThis.indexedDB;

const { RTEStorage } = await import('../storage.js?fallback-storage-tests=1');

beforeEach(() => globalThis.localStorage.clear());

test('fallback storage persists approved memory and respects direction', async () => {
  const storage = new RTEStorage();
  await storage.saveMemory({
    direction: 'en-ru',
    source: 'The field preserves coherence.',
    target: 'Поле сохраняет когерентность.',
    metadata: { corrected: true },
  });

  const exact = await storage.findExactMemory('en-ru', '  The field preserves coherence.  ');
  assert.equal(exact.target, 'Поле сохраняет когерентность.');
  assert.equal(exact.metadata.corrected, true);
  assert.equal(await storage.findExactMemory('ru-en', 'The field preserves coherence.'), null);

  const fuzzy = await storage.findBestMemory('en-ru', 'The field preserves its coherence.', 0.45);
  assert.ok(fuzzy);
  assert.equal(fuzzy.item.direction, 'en-ru');
});

test('glossary, settings, export and import survive the fallback backend', async () => {
  const source = new RTEStorage();
  await source.ensureDefaults();
  await source.saveGlossary({ en: 'resonance', ru: 'резонанс' });
  await source.saveMemory({ direction: 'ru-en', source: 'Поле удерживает форму.', target: 'The field holds the form.' });
  await source.setSetting('runtime', { candidateCount: 3, deepCheck: true });

  const bundle = await source.exportBundle();
  assert.equal(bundle.format, 'rte-resonance-bundle');
  assert.ok(bundle.glossary.length > 0);
  assert.equal(bundle.memory.length, 1);

  globalThis.localStorage.clear();
  const target = new RTEStorage();
  const stats = await target.importBundle(bundle);
  assert.equal(stats.memory, 1);
  assert.ok(stats.glossary > 0);
  assert.deepEqual(await target.getSetting('runtime'), { candidateCount: 3, deepCheck: true });
  assert.equal((await target.findExactMemory('ru-en', 'Поле удерживает форму.')).target, 'The field holds the form.');
});
