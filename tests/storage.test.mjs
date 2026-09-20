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

test('unapproved pairs remain exportable but never enter exact or fuzzy recall', async () => {
  const storage = new RTEStorage();
  await storage.saveMemory({ direction: 'en-ru', source: 'The field holds form.', target: 'Черновик.', approved: false });
  assert.equal(await storage.findExactMemory('en-ru', 'The field holds form.'), null);
  assert.equal(await storage.findBestMemory('en-ru', 'The field holds form.', 0), null);
  assert.equal((await storage.exportBundle()).memory.length, 1);
});

test('import requires explicit boolean approval, without promoting missing or string flags', async () => {
  const storage = new RTEStorage();
  for (const approved of [undefined, false, 'true', 1, true]) {
    await storage.importBundle({ format: 'rte-resonance-bundle', memory: [
      { direction: 'en-ru', source: 'A field.', target: 'Поле.', approved },
    ] });
    assert.equal(Boolean(await storage.findExactMemory('en-ru', 'A field.')), approved === true);
  }
});

test('damaged fallback data is not silently replaced with an empty store', async () => {
  for (const raw of ['{broken', '{}', '[null]']) {
    localStorage.setItem('rte:v2:memory', raw);
    const storage = new RTEStorage();
    await assert.rejects(storage.saveMemory({ direction: 'en-ru', source: 'A', target: 'Б' }));
    assert.equal(localStorage.getItem('rte:v2:memory'), raw);
  }
});

test('fallback verifies writes instead of reporting a silent storage failure as success', async () => {
  const original = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  try {
    await assert.rejects(new RTEStorage().setSetting('runtime', {}), /сохранение/);
  } finally { globalThis.localStorage = original; }
});

for (const operation of ['put', 'remove', 'clear']) {
  for (const finish of ['complete', 'abort']) {
    test(`IndexedDB ${operation} waits for transaction ${finish}, not request success`, async () => {
      const storage = new RTEStorage();
      let transaction;
      let request;
      const objectStore = Object.fromEntries(['put', 'delete', 'clear'].map((name) => [name, () => {
        request = {};
        return request;
      }]));
      storage.dbPromise = Promise.resolve({ transaction: () => {
        transaction = { objectStore: () => objectStore };
        return transaction;
      } });
      let settled = false;
      const pending = operation === 'put' ? storage.put('memory', { id: 'test' })
        : operation === 'remove' ? storage.remove('memory', 'test') : storage.clear('memory');
      const observed = pending.then(() => { settled = true; }, () => { settled = true; });
      await new Promise((resolve) => setImmediate(resolve));
      request.onsuccess?.();
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(settled, false);
      if (finish === 'abort') {
        transaction.error = new Error('Late quota abort');
        transaction.onabort();
        await assert.rejects(pending, /Late quota abort/);
      } else {
        transaction.oncomplete();
        await pending;
      }
      await observed;
      assert.equal(settled, true);
    });
  }
}
