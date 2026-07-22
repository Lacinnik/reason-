import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

function createWorkerHarness(source, workerUrl) {
  const listeners = new Map();
  const stores = new Map();
  const normalize = input => new URL(typeof input === 'string' ? input : input.url, workerUrl).href;

  class MemoryCache {
    constructor() { this.entries = new Map(); }
    async add(input) {
      const url = normalize(input);
      this.entries.set(url, new Response(`cached:${url}`));
    }
    async addAll(inputs) {
      for (const input of inputs) await this.add(input);
    }
    async match(input) { return this.entries.get(normalize(input)); }
    async put(input, response) { this.entries.set(normalize(input), response); }
  }

  const cacheStorage = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new MemoryCache());
      return stores.get(name);
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
    async match(input) {
      for (const cache of stores.values()) {
        const response = await cache.match(input);
        if (response) return response;
      }
      return undefined;
    },
  };

  const self = {
    location: { origin: new URL(workerUrl).origin },
    clients: { claim: async () => {} },
    skipWaiting: async () => {},
    addEventListener(type, listener) { listeners.set(type, listener); },
  };

  vm.runInNewContext(source, {
    self,
    caches: cacheStorage,
    fetch: async () => { throw new Error('offline'); },
    URL,
    Response,
    console,
  });

  return {
    async install() {
      let completion;
      listeners.get('install')({ waitUntil(value) { completion = Promise.resolve(value); } });
      await completion;
    },
    async navigate(path) {
      let response;
      const request = { method: 'GET', mode: 'navigate', url: new URL(path, workerUrl).href };
      listeners.get('fetch')({
        request,
        respondWith(value) { response = Promise.resolve(value); },
        waitUntil() {},
      });
      return response;
    },
  };
}

test('shared Service Worker restores each published RESON vertical while offline', async () => {
  const source = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  const worker = createWorkerHarness(source, 'https://example.test/reason-/sw.js');
  await worker.install();

  const fieldResponse = await worker.navigate('./field-check/?offline=1');
  assert.equal(fieldResponse.status, 200);
  assert.match(await fieldResponse.text(), /field-check\/index\.html$/u);

  const transmissionsResponse = await worker.navigate('./transmissions/?offline=1');
  assert.equal(transmissionsResponse.status, 200);
  assert.match(await transmissionsResponse.text(), /transmissions\/index\.html$/u);
});
