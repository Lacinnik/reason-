import { DEFAULT_GLOSSARY, hashString, normalizeText, textSimilarity } from './engine-core.js';

const DB_NAME = 'rte-resonance-v2';
const DB_VERSION = 1;
const STORES = ['memory', 'glossary', 'settings'];
const FALLBACK_PREFIX = 'rte:v2:';
const MAX_IMPORT_MEMORY = 10000;
const MAX_IMPORT_GLOSSARY = 2000;

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class RTEStorage {
  constructor() {
    this.dbPromise = this.open().catch(() => null);
  }

  async open() {
    if (!('indexedDB' in globalThis)) return null;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('memory')) {
          const memory = db.createObjectStore('memory', { keyPath: 'id' });
          memory.createIndex('direction', 'direction', { unique: false });
          memory.createIndex('sourceNorm', 'sourceNorm', { unique: false });
        }
        if (!db.objectStoreNames.contains('glossary')) db.createObjectStore('glossary', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB unavailable'));
    });
  }

  fallbackRead(store) {
    try {
      return JSON.parse(localStorage.getItem(`${FALLBACK_PREFIX}${store}`) || '[]');
    } catch {
      return [];
    }
  }

  fallbackWrite(store, values) {
    localStorage.setItem(`${FALLBACK_PREFIX}${store}`, JSON.stringify(values));
  }

  async getAll(store) {
    if (!STORES.includes(store)) throw new Error(`Unknown store: ${store}`);
    const db = await this.dbPromise;
    if (!db) return this.fallbackRead(store);
    return new Promise((resolve, reject) => {
      const request = db.transaction(store, 'readonly').objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async get(store, key) {
    const db = await this.dbPromise;
    if (!db) return this.fallbackRead(store).find((item) => (item.id ?? item.key) === key) || null;
    return new Promise((resolve, reject) => {
      const request = db.transaction(store, 'readonly').objectStore(store).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async put(store, value) {
    const item = clone(value);
    const db = await this.dbPromise;
    if (!db) {
      const values = this.fallbackRead(store);
      const key = item.id ?? item.key;
      const index = values.findIndex((candidate) => (candidate.id ?? candidate.key) === key);
      if (index >= 0) values[index] = item;
      else values.push(item);
      this.fallbackWrite(store, values);
      return item;
    }
    return new Promise((resolve, reject) => {
      const request = db.transaction(store, 'readwrite').objectStore(store).put(item);
      request.onsuccess = () => resolve(item);
      request.onerror = () => reject(request.error);
    });
  }

  async remove(store, key) {
    const db = await this.dbPromise;
    if (!db) {
      const values = this.fallbackRead(store).filter((item) => (item.id ?? item.key) !== key);
      this.fallbackWrite(store, values);
      return;
    }
    await new Promise((resolve, reject) => {
      const request = db.transaction(store, 'readwrite').objectStore(store).delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(store) {
    const db = await this.dbPromise;
    if (!db) {
      this.fallbackWrite(store, []);
      return;
    }
    await new Promise((resolve, reject) => {
      const request = db.transaction(store, 'readwrite').objectStore(store).clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async ensureDefaults() {
    const glossary = await this.getAll('glossary');
    if (!glossary.length) {
      for (const entry of DEFAULT_GLOSSARY) await this.put('glossary', entry);
    }
  }

  async listGlossary() {
    return (await this.getAll('glossary')).sort((a, b) => a.en.localeCompare(b.en));
  }

  async saveGlossary({ id, en, ru }) {
    const cleanEn = String(en || '').trim();
    const cleanRu = String(ru || '').trim();
    if (!cleanEn || !cleanRu) throw new Error('Нужны оба термина: EN и RU.');
    const existing = (await this.listGlossary()).find((item) => (
      normalizeText(item.en) === normalizeText(cleanEn)
      || normalizeText(item.ru) === normalizeText(cleanRu)
    ));
    const entry = {
      id: id || existing?.id || `g-${hashString(normalizeText(cleanEn))}`,
      en: cleanEn,
      ru: cleanRu,
      createdAt: existing?.createdAt || nowIso(),
      updatedAt: nowIso(),
    };
    return this.put('glossary', entry);
  }

  async saveMemory({ direction, source, target, approved = true, metadata = {} }) {
    const sourceNorm = normalizeText(source);
    if (!sourceNorm || !String(target || '').trim()) throw new Error('Пустую пару нельзя сохранить.');
    const id = `${direction}:${hashString(sourceNorm)}`;
    const existing = await this.get('memory', id);
    const item = {
      id,
      direction,
      source: String(source).trim(),
      sourceNorm,
      target: String(target).trim(),
      approved,
      createdAt: existing?.createdAt || nowIso(),
      updatedAt: nowIso(),
      usageCount: (existing?.usageCount || 0) + 1,
      metadata: { ...(existing?.metadata || {}), ...metadata },
    };
    return this.put('memory', item);
  }

  async listMemory(direction = null) {
    const items = await this.getAll('memory');
    return items
      .filter((entry) => !direction || entry.direction === direction)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  async findExactMemory(direction, source) {
    const id = `${direction}:${hashString(normalizeText(source))}`;
    const item = await this.get('memory', id);
    return item && item.sourceNorm === normalizeText(source) ? item : null;
  }

  async findBestMemory(direction, source, threshold = 0.86) {
    const items = await this.listMemory(direction);
    let best = null;
    for (const item of items) {
      const score = textSimilarity(source, item.source);
      if (!best || score > best.score) best = { item, score };
    }
    return best && best.score >= threshold ? best : null;
  }

  async getSetting(key, fallback = null) {
    const item = await this.get('settings', key);
    return item ? item.value : fallback;
  }

  async setSetting(key, value) {
    await this.put('settings', { key, value, updatedAt: nowIso() });
    return value;
  }

  async stats() {
    const [memory, glossary] = await Promise.all([this.listMemory(), this.listGlossary()]);
    return { memory: memory.length, glossary: glossary.length };
  }

  async exportBundle() {
    const [memory, glossary, settings] = await Promise.all([
      this.getAll('memory'),
      this.getAll('glossary'),
      this.getAll('settings'),
    ]);
    return {
      format: 'rte-resonance-bundle',
      version: 2,
      exportedAt: nowIso(),
      memory,
      glossary,
      settings,
    };
  }

  async importBundle(bundle) {
    if (!bundle || bundle.format !== 'rte-resonance-bundle') throw new Error('Это не пакет памяти RTE.');
    const memory = Array.isArray(bundle.memory) ? bundle.memory : [];
    const glossary = Array.isArray(bundle.glossary) ? bundle.glossary : [];
    const settings = Array.isArray(bundle.settings) ? bundle.settings : [];
    if (memory.length > MAX_IMPORT_MEMORY || glossary.length > MAX_IMPORT_GLOSSARY) {
      throw new Error('Пакет превышает безопасный предел RTE.');
    }
    for (const item of memory) {
      if (!item?.direction || !item?.source || !item?.target) continue;
      await this.saveMemory({
        direction: item.direction,
        source: item.source,
        target: item.target,
        approved: item.approved !== false,
        metadata: { ...(item.metadata || {}), imported: true },
      });
    }
    for (const item of glossary) {
      if (!item?.en || !item?.ru) continue;
      await this.saveGlossary({ id: item.id, en: item.en, ru: item.ru });
    }
    for (const item of settings) {
      if (!item?.key) continue;
      await this.setSetting(item.key, item.value);
    }
    return this.stats();
  }
}
