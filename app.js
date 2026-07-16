import {
  APP_VERSION,
  LIBRARY_VERSION,
  computeMetrics,
  formatBytes,
  maskGlossary,
  maskInvariants,
  normalizeText,
  rankCandidates,
  restoreGlossary,
  restoreInvariants,
  safeJsonParse,
  splitTextIntoSegments,
} from './engine-core.js';
import { RTEStorage } from './storage.js';

const PINNED_TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2';
const $ = (id) => document.getElementById(id);
const ui = {
  versionBadge: $('versionBadge'), networkBadge: $('networkBadge'), backendBadge: $('backendBadge'),
  source: $('source'), target: $('target'), sourceLang: $('sourceLang'), targetLang: $('targetLang'), sourceCount: $('sourceCount'), targetCount: $('targetCount'),
  translate: $('translate'), swap: $('swap'), copy: $('copy'), clear: $('clear'), approve: $('approve'),
  candidateCount: $('candidateCount'), deepCheck: $('deepCheck'), glossaryEnabled: $('glossaryEnabled'), deviceMode: $('deviceMode'), segmentSize: $('segmentSize'),
  candidatesSection: $('candidatesSection'), candidatesList: $('candidatesList'),
  resonanceValue: $('resonanceValue'), resonanceFill: $('resonanceFill'), alpha: $('alpha'), quality: $('quality'), container: $('container'), flow: $('flow'),
  log: $('log'), progress: $('progress'), progressFill: $('progressFill'),
  glossaryEn: $('glossaryEn'), glossaryRu: $('glossaryRu'), glossaryAdd: $('glossaryAdd'), glossaryList: $('glossaryList'),
  memoryCount: $('memoryCount'), glossaryCount: $('glossaryCount'), memoryList: $('memoryList'), clearMemory: $('clearMemory'), exportBundle: $('exportBundle'), importBundle: $('importBundle'), bundleFile: $('bundleFile'),
  prepareCurrent: $('prepareCurrent'), prepareAll: $('prepareAll'), refreshDiagnostics: $('refreshDiagnostics'), persistStorage: $('persistStorage'),
  cacheLibrary: $('cacheLibrary'), cacheShell: $('cacheShell'), cacheEnRu: $('cacheEnRu'), cacheRuEn: $('cacheRuEn'), cacheStorage: $('cacheStorage'), cachePersistence: $('cachePersistence'),
  modelEnRu: $('modelEnRu'), modelRuEn: $('modelRuEn'),
};

const storage = new RTEStorage();
const engines = new Map();
let transformersModule = null;
let direction = 'en-ru';
let currentCandidates = [];
let selectedCandidateId = null;
let lastContext = null;
let targetDirty = false;
let glossaryEntries = [];
let settings = {
  candidateCount: 3,
  deepCheck: false,
  glossaryEnabled: true,
  deviceMode: 'auto',
  segmentSize: 420,
  modelEnRu: 'Xenova/opus-mt-en-ru',
  modelRuEn: 'Xenova/opus-mt-ru-en',
};

const state = { busy: false, librarySource: 'pinned-loader', activeBackend: '—' };

async function disposeEngine(key) {
  const engine = engines.get(key);
  if (!engine) return;
  engines.delete(key);
  try {
    if (typeof engine.dispose === 'function') await engine.dispose();
  } catch (error) {
    console.warn(`Could not dispose engine ${key}.`, error);
  }
  if (!engines.size) {
    state.activeBackend = '—';
    renderBackend();
  }
}

async function disposeAllEngines(exceptKey = null) {
  const keys = [...engines.keys()].filter((key) => key !== exceptKey);
  for (const key of keys) await disposeEngine(key);
}

function directionMeta(dir = direction) {
  const enRu = dir === 'en-ru';
  return {
    direction: dir,
    source: enRu ? 'English' : 'Русский',
    target: enRu ? 'Русский' : 'English',
    sourceLocale: enRu ? 'en' : 'ru',
    targetLocale: enRu ? 'ru' : 'en',
    model: (enRu ? ui.modelEnRu.value : ui.modelRuEn.value).trim(),
    reverseDirection: enRu ? 'ru-en' : 'en-ru',
  };
}

function setLog(message, { error = false, success = false } = {}) {
  ui.log.textContent = message;
  ui.log.className = `log${error ? ' error' : ''}${success ? ' success' : ''}`;
}

function setProgress(value, label = '') {
  const pct = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  ui.progress.hidden = pct <= 0 || pct >= 100;
  ui.progressFill.style.width = `${pct}%`;
  ui.progress.setAttribute('aria-label', label || `${pct}%`);
}

function setBusy(value, label = 'Перевести') {
  state.busy = value;
  for (const button of [ui.translate, ui.swap, ui.prepareCurrent, ui.prepareAll, ui.approve]) button.disabled = value;
  ui.translate.textContent = value ? label : 'Перевести';
  if (!value) setProgress(100);
}

function updateCounts() {
  ui.sourceCount.textContent = `${ui.source.value.length} зн.`;
  ui.targetCount.textContent = `${ui.target.value.length} зн.`;
}

function renderDirection() {
  const meta = directionMeta();
  ui.sourceLang.textContent = meta.source;
  ui.targetLang.textContent = meta.target;
  ui.swap.textContent = `${meta.source} → ${meta.target}`;
  ui.source.placeholder = meta.source === 'English' ? 'Enter English text…' : 'Введите русский текст…';
  ui.target.placeholder = meta.target === 'English' ? 'Translation will appear here…' : 'Перевод появится здесь…';
  ui.source.lang = meta.sourceLocale;
  ui.target.lang = meta.targetLocale;
}

function renderNetwork() {
  const online = navigator.onLine;
  ui.networkBadge.textContent = online ? 'онлайн' : 'офлайн';
  ui.networkBadge.className = `badge ${online ? 'online' : 'offline'}`;
}

function renderBackend() {
  ui.backendBadge.textContent = state.activeBackend === '—' ? 'движок не загружен' : state.activeBackend;
}

function renderMetrics(metrics = null) {
  if (!metrics) {
    for (const node of [ui.alpha, ui.quality, ui.container, ui.flow]) node.textContent = '—';
    ui.resonanceValue.textContent = '0%';
    ui.resonanceFill.style.width = '0%';
    return;
  }
  const fmt = (value) => Number(value).toFixed(2);
  ui.alpha.textContent = fmt(metrics.alpha);
  ui.quality.textContent = fmt(metrics.quality);
  ui.container.textContent = fmt(metrics.container);
  ui.flow.textContent = fmt(metrics.flow);
  const pct = Math.round(metrics.resonance * 100);
  ui.resonanceValue.textContent = `${pct}%`;
  ui.resonanceFill.style.width = `${pct}%`;
}

function isAppleSafari() {
  const ua = navigator.userAgent || '';
  return /Safari/u.test(ua) && !/Chrome|Chromium|Edg/u.test(ua);
}

function backendAttempts() {
  const mode = settings.deviceMode;
  const webgpuAvailable = Boolean(navigator.gpu);
  const attempts = [];
  if (mode === 'webgpu' && webgpuAvailable && !isAppleSafari()) {
    attempts.push({ device: 'webgpu', dtype: 'fp16', label: 'WebGPU · fp16 (эксперимент)' });
  }
  attempts.push({ device: null, dtype: 'q8', label: 'WASM · q8 (надёжно)' });
  return attempts;
}

async function loadLibrary() {
  if (transformersModule) return transformersModule;
  setLog('Подключаю зафиксированную версию Transformers.js…');
  try {
    transformersModule = await import('./vendor/transformers-3.7.2.js');
    state.librarySource = 'pinned-loader';
  } catch (localError) {
    console.warn('Local Transformers.js failed, trying pinned CDN fallback.', localError);
    transformersModule = await import(PINNED_TRANSFORMERS_URL);
    state.librarySource = 'cdn-fallback';
  }

  const { env } = transformersModule;
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  env.useBrowserCache = true;
  if ('useWasmCache' in env) env.useWasmCache = true;
  try {
    if (env.backends?.onnx?.wasm) {
      env.backends.onnx.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${LIBRARY_VERSION}/dist/`;
    }
  } catch (error) {
    console.warn('Could not set pinned WASM path.', error);
  }
  return transformersModule;
}

function readyKey(dir) {
  return `rte:v2:ready:${dir}`;
}

function markDirectionReady(dir, data) {
  localStorage.setItem(readyKey(dir), JSON.stringify({ ...data, at: new Date().toISOString(), version: APP_VERSION }));
}

function readDirectionReady(dir) {
  return safeJsonParse(localStorage.getItem(readyKey(dir)) || 'null');
}

async function ensureTranslator(dir = direction, force = false) {
  const meta = directionMeta(dir);
  if (!meta.model) throw new Error(`Не задана модель для ${meta.source} → ${meta.target}.`);
  const { pipeline } = await loadLibrary();
  const attempts = backendAttempts();
  let lastError = null;

  for (const attempt of attempts) {
    const backendKey = attempt.device || 'wasm';
    const key = `${dir}:${meta.model}:${backendKey}:${attempt.dtype}`;
    if (!force && engines.has(key)) {
      const cached = engines.get(key);
      state.activeBackend = attempt.label;
      renderBackend();
      return cached;
    }

    // Keep at most one live neural pipeline. Model files remain in browser cache,
    // while releasing ONNX/WebGPU memory makes direction changes safer on iPhone.
    await disposeAllEngines();

    try {
      setLog(`Загружаю ${meta.model} · ${attempt.label}. Первый запуск может занять несколько минут…`);
      const pipelineOptions = {
        dtype: attempt.dtype,
        progress_callback: (progress) => {
          if (!progress?.status) return;
          const pct = Number.isFinite(progress.progress) ? Math.round(progress.progress) : 0;
          setProgress(pct, progress.file || progress.status);
          const suffix = progress.file ? ` · ${progress.file}` : '';
          setLog(`${progress.status}${pct ? ` ${pct}%` : ''}${suffix}`);
        },
      };
      // Transformers.js uses CPU/WASM by default. Only pass a device override for WebGPU.
      if (attempt.device) pipelineOptions.device = attempt.device;
      const engine = await pipeline('translation', meta.model, pipelineOptions);
      engines.set(key, engine);
      state.activeBackend = attempt.label;
      markDirectionReady(dir, { model: meta.model, backend: attempt.label, librarySource: state.librarySource });
      renderBackend();
      await refreshDiagnostics();
      return engine;
    } catch (error) {
      lastError = error;
      console.warn(`Backend ${attempt.label} failed.`, error);
      if (attempt.device === 'webgpu') setLog('WebGPU не удержал модель. Перехожу на надёжный WASM-контур…');
    }
  }
  throw lastError || new Error('Не удалось загрузить модель.');
}

function normalizePipelineOutput(result) {
  const list = Array.isArray(result) ? result : [result];
  return list
    .map((item) => item?.translation_text ?? item?.generated_text ?? '')
    .map((text) => String(text).trim())
    .filter(Boolean);
}

function looksDegenerateTranslation(source, translation) {
  const output = String(translation || '').trim();
  if (!output) return true;
  if ((output.match(/\.1%/gu) || []).length >= 3) return true;
  const tokens = normalizeText(output).split(/[^\p{L}\p{N}%]+/u).filter(Boolean);
  if (tokens.length >= 24 && (new Set(tokens).size / tokens.length) < 0.32) return true;
  const sourceLength = Math.max(1, String(source || '').trim().length);
  return output.length > Math.max(480, sourceLength * 10);
}

async function translateSegment(segmentText, dir, {
  candidateCount = 1,
  glossary = glossaryEntries,
  allowMemory = true,
  progressLabel = '',
} = {}) {
  if (allowMemory) {
    const exact = await storage.findExactMemory(dir, segmentText);
    if (exact) {
      return {
        candidates: Array.from({ length: candidateCount }, () => exact.target),
        fromMemory: true,
        memoryTarget: exact.target,
      };
    }
  }

  const bestMemory = allowMemory ? await storage.findBestMemory(dir, segmentText, 0.88) : null;
  const invariantProtected = maskInvariants(segmentText);
  const glossaryProtected = settings.glossaryEnabled
    ? maskGlossary(invariantProtected.text, glossary, dir)
    : { text: invariantProtected.text, placeholders: [] };
  const engine = await ensureTranslator(dir);
  const beams = candidateCount > 1 ? Math.max(4, candidateCount) : 2;
  const maxNewTokens = Math.min(512, Math.max(64, Math.ceil(segmentText.length * 1.8)));
  if (progressLabel) setLog(progressLabel);

  let result;
  try {
    result = await engine(glossaryProtected.text, {
      max_new_tokens: maxNewTokens,
      num_beams: beams,
      num_return_sequences: candidateCount,
      early_stopping: true,
      no_repeat_ngram_size: 3,
      length_penalty: 1,
      do_sample: false,
    });
  } catch (error) {
    if (candidateCount > 1) {
      console.warn('Multi-candidate generation failed; falling back to one sequence.', error);
      result = await engine(glossaryProtected.text, {
        max_new_tokens: maxNewTokens,
        num_beams: 2,
        num_return_sequences: 1,
        early_stopping: true,
      });
    } else {
      throw error;
    }
  }

  const restored = normalizePipelineOutput(result).map((text) => {
    const glossaryRestored = restoreGlossary(text, glossaryProtected.placeholders);
    return restoreInvariants(glossaryRestored, invariantProtected.placeholders);
  });
  if (!restored.length) throw new Error('Модель не вернула текст перевода.');
  if (restored.every((item) => looksDegenerateTranslation(segmentText, item))) {
    throw new Error('Модель вернула деградировавший результат. Выберите WASM, обновите страницу и повторите перевод.');
  }
  if (candidateCount > 1 && bestMemory?.item?.target) {
    const memoryCandidate = bestMemory.item.target.trim();
    if (memoryCandidate && !restored.some((item) => normalizeText(item) === normalizeText(memoryCandidate))) {
      restored.push(memoryCandidate);
    }
  }
  while (restored.length < candidateCount) restored.push(restored[0]);
  return {
    candidates: restored.slice(0, candidateCount),
    fromMemory: false,
    memoryTarget: bestMemory?.item?.target || '',
    memorySimilarity: bestMemory?.score || 0,
  };
}

function joinDocumentCandidate(segments, translatedSegments, candidateIndex) {
  let output = '';
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    const translated = translatedSegments[i]?.candidates?.[candidateIndex]
      || translatedSegments[i]?.candidates?.[0]
      || '';
    output += `${segment.prefix || ''}${translated}${segment.suffix || ''}`;
  }
  return output.trim();
}

async function translateDocument(text, dir, {
  candidateCount = settings.candidateCount,
  allowMemory = true,
  useGlossary = settings.glossaryEnabled,
  statusPrefix = 'Перевожу',
} = {}) {
  const meta = directionMeta(dir);
  const segments = splitTextIntoSegments(text, { maxChars: settings.segmentSize, locale: meta.sourceLocale });
  if (!segments.length) return { candidates: [], segments: [], translatedSegments: [] };

  const translatedSegments = [];
  for (let index = 0; index < segments.length; index += 1) {
    const pct = 5 + ((index / segments.length) * 70);
    setProgress(pct, `${statusPrefix}: сегмент ${index + 1}/${segments.length}`);
    const result = await translateSegment(segments[index].text, dir, {
      candidateCount,
      glossary: useGlossary ? glossaryEntries : [],
      allowMemory,
      progressLabel: `${statusPrefix}: сегмент ${index + 1} из ${segments.length}…`,
    });
    translatedSegments.push(result);
  }

  const documents = Array.from({ length: candidateCount }, (_, candidateIndex) => ({
    id: `candidate-${candidateIndex}-${Date.now()}`,
    text: joinDocumentCandidate(segments, translatedSegments, candidateIndex),
    candidateIndex,
    fromMemory: translatedSegments.every((segment) => segment.fromMemory),
    memoryTarget: translatedSegments.map((segment) => segment.memoryTarget).filter(Boolean).join(' '),
  }));

  const unique = [];
  const seen = new Set();
  for (const document of documents) {
    const key = normalizeText(document.text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(document);
  }
  return { candidates: unique, segments, translatedSegments };
}

async function performBackCheck(candidate, sourceText) {
  const reverse = directionMeta().reverseDirection;
  const result = await translateDocument(candidate.text, reverse, {
    candidateCount: 1,
    allowMemory: false,
    useGlossary: settings.glossaryEnabled,
    statusPrefix: 'Обратная проверка',
  });
  return result.candidates[0]?.text || '';
}

function renderCandidates(candidates) {
  currentCandidates = candidates;
  ui.candidatesList.innerHTML = '';
  ui.candidatesSection.hidden = candidates.length <= 1;
  candidates.forEach((candidate, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `candidate-card${candidate.id === selectedCandidateId ? ' selected' : ''}`;
    const label = index === 0 ? 'Резонансный выбор' : `Альтернатива ${index + 1}`;
    button.innerHTML = `
      <span class="candidate-head"><strong>${label}</strong><span>${Math.round(candidate.metrics.resonance * 100)}%</span></span>
      <span class="candidate-text"></span>
      <span class="candidate-meta">α ${candidate.metrics.alpha.toFixed(2)} · Q ${candidate.metrics.quality.toFixed(2)} · Cₘ ${candidate.metrics.container.toFixed(2)} · T ${candidate.metrics.flow.toFixed(2)}</span>
    `;
    button.querySelector('.candidate-text').textContent = candidate.text;
    button.addEventListener('click', () => selectCandidate(candidate.id));
    ui.candidatesList.appendChild(button);
  });
}

function selectCandidate(id) {
  const candidate = currentCandidates.find((item) => item.id === id);
  if (!candidate) return;
  selectedCandidateId = id;
  ui.target.value = candidate.text;
  targetDirty = false;
  renderMetrics(candidate.metrics);
  renderCandidates(currentCandidates);
  updateCounts();
  if (lastContext) lastContext.selectedCandidateId = id;
  setLog('Выбран вариант с нужной формой. Результат можно отредактировать и принять в память.');
}

async function runTranslation({ ignoreWholeMemory = false } = {}) {
  const sourceText = ui.source.value.trim();
  if (!sourceText) {
    setLog('Введите текст для перевода.', { error: true });
    return;
  }

  setBusy(true, 'Резонирую…');
  targetDirty = false;
  currentCandidates = [];
  selectedCandidateId = null;
  ui.candidatesSection.hidden = true;
  renderMetrics(null);

  try {
    if (!ignoreWholeMemory) {
      const exact = await storage.findExactMemory(direction, sourceText);
      if (exact) {
        const metrics = computeMetrics({ source: sourceText, translation: exact.target, glossaryEntries, direction });
        const candidate = { id: `memory-${Date.now()}`, text: exact.target, metrics, score: metrics.resonance, fromMemory: true };
        lastContext = { source: sourceText, direction, candidates: [candidate], selectedCandidateId: candidate.id, translatedSegments: [], segments: [] };
        selectedCandidateId = candidate.id;
        currentCandidates = [candidate];
        ui.target.value = exact.target;
        renderMetrics(metrics);
        updateCounts();
        setLog('Точный перевод найден в утверждённой памяти — нейромодель не запускалась.', { success: true });
        return;
      }
    }

    const candidateCount = Number(settings.candidateCount) || 1;
    const result = await translateDocument(sourceText, direction, { candidateCount });
    let candidates = rankCandidates(result.candidates, {
      source: sourceText,
      glossaryEntries: settings.glossaryEnabled ? glossaryEntries : [],
      direction,
      memoryTarget: result.candidates[0]?.memoryTarget || '',
    });

    if (settings.deepCheck) {
      const checked = [];
      for (let index = 0; index < candidates.length; index += 1) {
        setProgress(76 + ((index / Math.max(1, candidates.length)) * 22), `Глубокая проверка ${index + 1}/${candidates.length}`);
        setLog(`Глубокая проверка: обратный перевод варианта ${index + 1} из ${candidates.length}…`);
        const backTranslation = await performBackCheck(candidates[index], sourceText);
        checked.push({ ...candidates[index], backTranslation });
      }
      candidates = rankCandidates(checked, {
        source: sourceText,
        glossaryEntries: settings.glossaryEnabled ? glossaryEntries : [],
        direction,
      });
    }

    candidates = candidates.map((candidate, index) => ({ ...candidate, id: `candidate-${Date.now()}-${index}` }));
    if (!candidates.length) throw new Error('Не удалось сформировать перевод.');
    selectedCandidateId = candidates[0].id;
    lastContext = {
      source: sourceText,
      direction,
      candidates,
      selectedCandidateId,
      segments: result.segments,
      translatedSegments: result.translatedSegments,
    };
    ui.target.value = candidates[0].text;
    renderCandidates(candidates);
    renderMetrics(candidates[0].metrics);
    updateCounts();
    localStorage.setItem('rte:v2:last', JSON.stringify({ direction, source: sourceText, target: candidates[0].text }));
    const memorySegments = result.translatedSegments.filter((segment) => segment.fromMemory).length;
    const suffix = memorySegments ? ` Память удержала ${memorySegments} сегм.` : '';
    setLog(`Перевод завершён: ${result.segments.length} сегм., ${candidates.length} форм.${settings.deepCheck ? ' Обратная проверка выполнена.' : ''}${suffix}`, { success: true });
  } catch (error) {
    console.error(error);
    setLog(`Ошибка: ${error?.message || error}. Проверьте свободную память и наличие первично загруженных моделей.`, { error: true });
  } finally {
    setBusy(false);
    setProgress(100);
    await refreshDiagnostics();
  }
}

async function approveTranslation() {
  const source = ui.source.value.trim();
  const target = ui.target.value.trim();
  if (!source || !target) {
    setLog('Для памяти нужны исходный текст и подтверждённый перевод.', { error: true });
    return;
  }
  setBusy(true, 'Сохраняю…');
  try {
    await storage.saveMemory({
      direction,
      source,
      target,
      approved: true,
      metadata: { corrected: targetDirty, appVersion: APP_VERSION },
    });

    const selected = currentCandidates.find((candidate) => candidate.id === selectedCandidateId);
    if (!targetDirty && selected && lastContext?.segments?.length === lastContext?.translatedSegments?.length) {
      for (let index = 0; index < lastContext.segments.length; index += 1) {
        const sourceSegment = lastContext.segments[index].text;
        const translated = lastContext.translatedSegments[index]?.candidates?.[selected.candidateIndex]
          || lastContext.translatedSegments[index]?.candidates?.[0];
        if (sourceSegment && translated) {
          await storage.saveMemory({
            direction,
            source: sourceSegment,
            target: translated,
            approved: true,
            metadata: { segment: true, appVersion: APP_VERSION },
          });
        }
      }
    }
    targetDirty = false;
    await renderMemory();
    setLog('Перевод принят. Следующее совпадение будет взято из локальной памяти.', { success: true });
  } catch (error) {
    setLog(`Не удалось сохранить память: ${error.message}`, { error: true });
  } finally {
    setBusy(false);
  }
}

async function renderGlossary() {
  glossaryEntries = await storage.listGlossary();
  ui.glossaryList.innerHTML = '';
  for (const entry of glossaryEntries) {
    const row = document.createElement('div');
    row.className = 'term-row';
    row.innerHTML = '<span class="term-pair"></span><button type="button" class="icon-button" aria-label="Удалить термин">×</button>';
    row.querySelector('.term-pair').textContent = `${entry.en} ↔ ${entry.ru}`;
    row.querySelector('button').addEventListener('click', async () => {
      await storage.remove('glossary', entry.id);
      await renderGlossary();
      await renderMemory();
    });
    ui.glossaryList.appendChild(row);
  }
  ui.glossaryCount.textContent = String(glossaryEntries.length);
}

async function renderMemory() {
  const [entries, stats] = await Promise.all([storage.listMemory(), storage.stats()]);
  ui.memoryCount.textContent = String(stats.memory);
  ui.glossaryCount.textContent = String(stats.glossary);
  ui.memoryList.innerHTML = '';
  if (!entries.length) {
    ui.memoryList.innerHTML = '<div class="empty-state">Память пока пуста. Примите первый перевод.</div>';
    return;
  }
  for (const entry of entries.slice(0, 8)) {
    const row = document.createElement('div');
    row.className = 'memory-row';
    row.innerHTML = '<div><strong class="memory-source"></strong><span class="memory-target"></span></div><button type="button" class="icon-button" aria-label="Удалить запись">×</button>';
    row.querySelector('.memory-source').textContent = entry.source;
    row.querySelector('.memory-target').textContent = entry.target;
    row.querySelector('button').addEventListener('click', async () => {
      await storage.remove('memory', entry.id);
      await renderMemory();
    });
    ui.memoryList.appendChild(row);
  }
}

async function addGlossaryEntry() {
  try {
    await storage.saveGlossary({ en: ui.glossaryEn.value, ru: ui.glossaryRu.value });
    ui.glossaryEn.value = '';
    ui.glossaryRu.value = '';
    await renderGlossary();
    await renderMemory();
    setLog('Термин добавлен в локальный словарь.', { success: true });
  } catch (error) {
    setLog(error.message, { error: true });
  }
}

function downloadJson(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function exportBundle() {
  const bundle = await storage.exportBundle();
  downloadJson(`rte_resonance_bundle_${new Date().toISOString().slice(0, 10)}.json`, bundle);
  setLog('Память, словарь и настройки экспортированы.', { success: true });
}

async function importBundle(file) {
  const text = await file.text();
  const bundle = JSON.parse(text);
  await storage.importBundle(bundle);
  await Promise.all([renderGlossary(), renderMemory(), loadSettings()]);
  setLog('Пакет памяти импортирован.', { success: true });
}

function sanitizeSettings(value = {}) {
  const candidates = [1, 3].includes(Number(value.candidateCount)) ? Number(value.candidateCount) : 3;
  const segment = [320, 420, 560].includes(Number(value.segmentSize)) ? Number(value.segmentSize) : 420;
  const device = ['auto', 'wasm', 'webgpu'].includes(value.deviceMode) ? value.deviceMode : 'auto';
  return {
    candidateCount: candidates,
    deepCheck: Boolean(value.deepCheck),
    glossaryEnabled: value.glossaryEnabled !== false,
    deviceMode: device,
    segmentSize: segment,
    modelEnRu: String(value.modelEnRu || 'Xenova/opus-mt-en-ru').trim(),
    modelRuEn: String(value.modelRuEn || 'Xenova/opus-mt-ru-en').trim(),
  };
}

async function saveSettings() {
  settings = sanitizeSettings({
    candidateCount: ui.candidateCount.value,
    deepCheck: ui.deepCheck.checked,
    glossaryEnabled: ui.glossaryEnabled.checked,
    deviceMode: ui.deviceMode.value,
    segmentSize: ui.segmentSize.value,
    modelEnRu: ui.modelEnRu.value,
    modelRuEn: ui.modelRuEn.value,
  });
  await storage.setSetting('runtime', settings);
}

async function loadSettings() {
  settings = sanitizeSettings({ ...settings, ...(await storage.getSetting('runtime', {})) });
  ui.candidateCount.value = String(settings.candidateCount);
  ui.deepCheck.checked = settings.deepCheck;
  ui.glossaryEnabled.checked = settings.glossaryEnabled;
  ui.deviceMode.value = settings.deviceMode;
  ui.segmentSize.value = String(settings.segmentSize);
  ui.modelEnRu.value = settings.modelEnRu;
  ui.modelRuEn.value = settings.modelRuEn;
}

function statusNode(node, ok, text) {
  node.textContent = text;
  node.className = `status-value ${ok ? 'ok' : 'pending'}`;
}

async function refreshDiagnostics() {
  renderNetwork();
  const shellReady = Boolean(navigator.serviceWorker?.controller || await navigator.serviceWorker?.getRegistration?.());
  let libraryReady = Boolean(transformersModule);
  if ('caches' in globalThis) {
    try {
      const [localLoader, remoteRuntime] = await Promise.all([
        caches.match('./vendor/transformers-3.7.2.js'),
        caches.match(PINNED_TRANSFORMERS_URL),
      ]);
      libraryReady = libraryReady || Boolean(localLoader && remoteRuntime);
    } catch {
      // Cache inspection is advisory only.
    }
  }
  statusNode(ui.cacheLibrary, libraryReady, libraryReady ? `кэширована · v${LIBRARY_VERSION}` : `ожидает загрузки · v${LIBRARY_VERSION}`);
  statusNode(ui.cacheShell, shellReady, shellReady ? 'готова' : 'ожидает перезагрузки');
  const enMarker = readDirectionReady('en-ru');
  const ruMarker = readDirectionReady('ru-en');
  const enReady = enMarker?.version === APP_VERSION && enMarker?.model === directionMeta('en-ru').model ? enMarker : null;
  const ruReady = ruMarker?.version === APP_VERSION && ruMarker?.model === directionMeta('ru-en').model ? ruMarker : null;
  statusNode(ui.cacheEnRu, Boolean(enReady), enReady ? `подготовлено · ${enReady.backend}` : 'не подготовлено');
  statusNode(ui.cacheRuEn, Boolean(ruReady), ruReady ? `подготовлено · ${ruReady.backend}` : 'не подготовлено');

  if (navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate();
    statusNode(ui.cacheStorage, true, `${formatBytes(estimate.usage)} / ${formatBytes(estimate.quota)}`);
  } else {
    statusNode(ui.cacheStorage, false, 'нет оценки');
  }

  if (navigator.storage?.persisted) {
    const persisted = await navigator.storage.persisted();
    statusNode(ui.cachePersistence, persisted, persisted ? 'защищено' : 'обычный кэш');
  } else {
    statusNode(ui.cachePersistence, false, 'не поддерживается');
  }
}

async function prepareDirection(dir) {
  setBusy(true, 'Подготавливаю…');
  try {
    await ensureTranslator(dir, true);
    setLog(`${directionMeta(dir).source} → ${directionMeta(dir).target}: модель готова для повторного офлайн-запуска.`, { success: true });
  } finally {
    setBusy(false);
    await refreshDiagnostics();
  }
}

async function prepareAll() {
  setBusy(true, 'Готовлю обе…');
  try {
    await loadLibrary();
    await ensureTranslator('en-ru', true);
    await ensureTranslator('ru-en', true);
    setLog('Обе модели и вычислительный контур подготовлены. Теперь проверьте перевод без сети.', { success: true });
  } catch (error) {
    setLog(`Подготовка не завершена: ${error.message}`, { error: true });
  } finally {
    setBusy(false);
    await refreshDiagnostics();
  }
}

async function requestPersistence() {
  if (!navigator.storage?.persist) {
    setLog('Этот браузер не поддерживает запрос постоянного хранилища.', { error: true });
    return;
  }
  const granted = await navigator.storage.persist();
  setLog(granted ? 'Браузер защитил данные RTE от автоматической очистки.' : 'Браузер оставил обычный режим кэша.', { success: granted, error: !granted });
  await refreshDiagnostics();
}

function restoreLastSession() {
  const saved = safeJsonParse(localStorage.getItem('rte:v2:last') || 'null');
  if (!saved) return;
  direction = saved.direction || direction;
  ui.source.value = saved.source || '';
  ui.target.value = saved.target || '';
}

ui.translate.addEventListener('click', () => runTranslation());
ui.swap.addEventListener('click', () => {
  direction = direction === 'en-ru' ? 'ru-en' : 'en-ru';
  const oldSource = ui.source.value;
  ui.source.value = ui.target.value;
  ui.target.value = oldSource;
  currentCandidates = [];
  selectedCandidateId = null;
  lastContext = null;
  targetDirty = false;
  renderDirection();
  renderCandidates([]);
  renderMetrics(null);
  updateCounts();
  setLog('Направление изменено. Для него подключается отдельная модель.');
});
ui.copy.addEventListener('click', async () => {
  if (!ui.target.value) return;
  try {
    await navigator.clipboard.writeText(ui.target.value);
  } catch {
    ui.target.select();
    document.execCommand('copy');
  }
  setLog('Перевод скопирован.', { success: true });
});
ui.clear.addEventListener('click', () => {
  ui.source.value = '';
  ui.target.value = '';
  currentCandidates = [];
  lastContext = null;
  targetDirty = false;
  renderCandidates([]);
  renderMetrics(null);
  updateCounts();
  setLog('Поля очищены.');
});
ui.approve.addEventListener('click', approveTranslation);
ui.source.addEventListener('input', updateCounts);
ui.target.addEventListener('input', () => { targetDirty = true; updateCounts(); });
ui.glossaryAdd.addEventListener('click', addGlossaryEntry);
ui.glossaryEn.addEventListener('keydown', (event) => { if (event.key === 'Enter') addGlossaryEntry(); });
ui.glossaryRu.addEventListener('keydown', (event) => { if (event.key === 'Enter') addGlossaryEntry(); });
ui.clearMemory.addEventListener('click', async () => {
  if (!confirm('Удалить всю локальную переводную память? Словарь останется.')) return;
  await storage.clear('memory');
  await renderMemory();
  setLog('Переводная память очищена.');
});
ui.exportBundle.addEventListener('click', exportBundle);
ui.importBundle.addEventListener('click', () => ui.bundleFile.click());
ui.bundleFile.addEventListener('change', async () => {
  const file = ui.bundleFile.files?.[0];
  if (!file) return;
  try { await importBundle(file); }
  catch (error) { setLog(`Импорт не выполнен: ${error.message}`, { error: true }); }
  finally { ui.bundleFile.value = ''; }
});
for (const control of [ui.candidateCount, ui.deepCheck, ui.glossaryEnabled, ui.deviceMode, ui.segmentSize]) {
  control.addEventListener('change', saveSettings);
}
ui.modelEnRu.addEventListener('change', async () => {
  await disposeAllEngines();
  localStorage.removeItem(readyKey('en-ru'));
  await saveSettings();
  await refreshDiagnostics();
});
ui.modelRuEn.addEventListener('change', async () => {
  await disposeAllEngines();
  localStorage.removeItem(readyKey('ru-en'));
  await saveSettings();
  await refreshDiagnostics();
});
ui.prepareCurrent.addEventListener('click', async () => {
  try { await prepareDirection(direction); }
  catch (error) { setBusy(false); setLog(`Не удалось подготовить модель: ${error.message}`, { error: true }); }
});
ui.prepareAll.addEventListener('click', prepareAll);
ui.refreshDiagnostics.addEventListener('click', refreshDiagnostics);
ui.persistStorage.addEventListener('click', requestPersistence);
window.addEventListener('online', renderNetwork);
window.addEventListener('offline', renderNetwork);
window.addEventListener('pagehide', () => { void disposeAllEngines(); });
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !state.busy) {
    event.preventDefault();
    runTranslation();
  }
});

async function boot() {
  ui.versionBadge.textContent = `RTE v${APP_VERSION}`;
  await storage.ensureDefaults();
  await loadSettings();
  await Promise.all([renderGlossary(), renderMemory()]);
  restoreLastSession();
  renderDirection();
  renderNetwork();
  renderBackend();
  updateCounts();
  renderMetrics(null);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch (error) {
      setLog(`Service Worker не подключён: ${error.message}`, { error: true });
    }
  }
  await refreshDiagnostics();
  setLog('RTE готов. Быстрый режим использует память и сегментацию; глубокая проверка выполняет обратный перевод.');
}

boot().catch((error) => {
  console.error(error);
  setLog(`Ошибка запуска: ${error.message}`, { error: true });
});
