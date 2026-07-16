const $ = (id) => document.getElementById(id);
const ui = {
  source: $('source'), target: $('target'), translate: $('translate'), swap: $('swap'), copy: $('copy'), clear: $('clear'), prepare: $('prepare'),
  sourceLang: $('sourceLang'), targetLang: $('targetLang'), log: $('log'), resonanceValue: $('resonanceValue'), resonanceFill: $('resonanceFill'),
  alpha: $('alpha'), quality: $('quality'), container: $('container'), flow: $('flow'), modelEnRu: $('modelEnRu'), modelRuEn: $('modelRuEn')
};

let direction = 'en-ru';
let translator = null;
let translatorKey = '';
let transformersModule = null;

const state = { loading: false, ready: false };

function setLog(message, error = false) {
  ui.log.textContent = message;
  ui.log.className = error ? 'log error' : 'log';
}
function setBusy(value) {
  state.loading = value;
  ui.translate.disabled = value;
  ui.prepare.disabled = value;
  ui.swap.disabled = value;
  ui.translate.textContent = value ? 'Загрузка…' : 'Перевести';
}
function directionMeta() {
  return direction === 'en-ru'
    ? { source: 'English', target: 'Русский', model: ui.modelEnRu.value.trim() }
    : { source: 'Русский', target: 'English', model: ui.modelRuEn.value.trim() };
}
function renderDirection() {
  const m = directionMeta();
  ui.sourceLang.textContent = m.source;
  ui.targetLang.textContent = m.target;
  ui.swap.textContent = `${m.source} → ${m.target}`;
  ui.source.placeholder = m.source === 'English' ? 'Enter English text…' : 'Введите русский текст…';
}

async function loadLibrary() {
  if (transformersModule) return transformersModule;
  setLog('Загружаю вычислительный модуль Transformers.js…');
  transformersModule = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2');
  transformersModule.env.allowLocalModels = false;
  transformersModule.env.useBrowserCache = true;
  return transformersModule;
}

async function ensureTranslator(force = false) {
  const { model } = directionMeta();
  if (!model) throw new Error('Не задан идентификатор модели.');
  const key = `${direction}:${model}`;
  if (!force && translator && translatorKey === key) return translator;
  setBusy(true);
  const { pipeline } = await loadLibrary();
  setLog(`Загружаю модель ${model}. При первом запуске это может занять несколько минут…`);
  translator = await pipeline('translation', model, {
    dtype: 'q8',
    progress_callback: (p) => {
      if (!p || !p.status) return;
      const pct = Number.isFinite(p.progress) ? ` ${Math.round(p.progress)}%` : '';
      setLog(`${p.status}${pct}${p.file ? ` · ${p.file}` : ''}`);
    }
  });
  translatorKey = key;
  state.ready = true;
  setBusy(false);
  setLog(`Модель ${model} готова. Повторные запуски используют браузерный кэш.`);
  return translator;
}

function estimateMetrics(source, translated) {
  const s = source.trim(); const t = translated.trim();
  const srcWords = s.split(/\s+/).filter(Boolean).length || 1;
  const dstWords = t.split(/\s+/).filter(Boolean).length || 1;
  const ratio = Math.min(srcWords, dstWords) / Math.max(srcWords, dstWords);
  const alpha = Math.max(0.35, Math.min(0.98, 0.62 + ratio * 0.32));
  const quality = Math.max(0.35, Math.min(0.96, translated.length > 2 ? 0.78 + Math.min(0.16, dstWords / 100) : 0.4));
  const container = Math.max(0.35, Math.min(0.98, 0.58 + ratio * 0.38));
  const flow = Math.max(0.35, Math.min(0.95, /[.!?…]$/.test(t) ? 0.9 : 0.78));
  const resonance = (alpha + quality + container + flow) / 4;
  return { alpha, quality, container, flow, resonance };
}
function renderMetrics(m) {
  const fmt = (x) => x.toFixed(2);
  ui.alpha.textContent = fmt(m.alpha); ui.quality.textContent = fmt(m.quality); ui.container.textContent = fmt(m.container); ui.flow.textContent = fmt(m.flow);
  const pct = Math.round(m.resonance * 100); ui.resonanceValue.textContent = `${pct}%`; ui.resonanceFill.style.width = `${pct}%`;
}

async function runTranslation() {
  const text = ui.source.value.trim();
  if (!text) { setLog('Введите текст для перевода.', true); return; }
  try {
    setBusy(true);
    const engine = await ensureTranslator();
    setLog('Выполняю перевод локально…');
    const result = await engine(text, { max_new_tokens: Math.min(512, Math.max(64, text.length * 2)) });
    const translated = Array.isArray(result) ? result[0]?.translation_text : result?.translation_text;
    if (!translated) throw new Error('Модель не вернула текст перевода.');
    ui.target.value = translated;
    renderMetrics(estimateMetrics(text, translated));
    localStorage.setItem('rte:last', JSON.stringify({ direction, source: text, target: translated }));
    setLog('Перевод завершён. Метрики являются локальной оценкой формы, а не внешней экспертной проверкой.');
  } catch (error) {
    console.error(error);
    setLog(`Ошибка: ${error?.message || error}. Проверьте интернет для первого запуска, идентификатор модели и свободную память устройства.`, true);
  } finally { setBusy(false); }
}

ui.translate.addEventListener('click', runTranslation);
ui.swap.addEventListener('click', () => {
  direction = direction === 'en-ru' ? 'ru-en' : 'en-ru';
  const oldSource = ui.source.value; ui.source.value = ui.target.value; ui.target.value = oldSource;
  translator = null; translatorKey = ''; state.ready = false; renderDirection(); setLog('Направление изменено. Для него будет подключена отдельная модель.');
});
ui.copy.addEventListener('click', async () => {
  if (!ui.target.value) return;
  try { await navigator.clipboard.writeText(ui.target.value); setLog('Перевод скопирован.'); }
  catch { ui.target.select(); document.execCommand('copy'); setLog('Перевод скопирован.'); }
});
ui.clear.addEventListener('click', () => { ui.source.value = ''; ui.target.value = ''; renderMetrics({alpha:0,quality:0,container:0,flow:0,resonance:0}); setLog('Поля очищены.'); });
ui.prepare.addEventListener('click', async () => {
  try { await ensureTranslator(true); setLog('Текущее направление подготовлено для повторного офлайн-запуска. Для второго направления переключите язык и повторите подготовку.'); }
  catch (e) { setBusy(false); setLog(`Не удалось подготовить модель: ${e?.message || e}`, true); }
});
ui.modelEnRu.addEventListener('change', () => { translator = null; translatorKey = ''; });
ui.modelRuEn.addEventListener('change', () => { translator = null; translatorKey = ''; });

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').then(() => setLog('Оболочка приложения подключена. Первый перевод требует загрузки модели.')).catch((e) => setLog(`Service Worker не подключён: ${e.message}`, true));
}
try {
  const saved = JSON.parse(localStorage.getItem('rte:last') || 'null');
  if (saved) { direction = saved.direction || direction; ui.source.value = saved.source || ''; ui.target.value = saved.target || ''; }
} catch {}
renderDirection();
