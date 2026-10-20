const EXCHANGE = "architectonica.ecosystem-exchange/1.0.0";
const JOURNAL = "architectonica.exchange-journal/1.0.0";
const KEY = "architectonica.exchange-journal.v1";
const CLASSES = new Set(["none", "self-reported", "documented", "independent-observation"]);
const KNOWN = [
  [/^architectonica\.axis-handoff\//u, "gdeya-axis", "Game-GDEYA"],
  [/^architectonica\.axis-return\//u, "reson-field-check", "reason-"],
  [/^reson\.collective-meta-decision\//u, "reson-field-check", "reason-"],
  [/^architectonica\.seven-transmissions-session\//u, "reson-transmissions", "reason-"],
  [/^architectonica\.axis-game-trace\//u, "reson-axis-game", "reason-"],
];
const idIsValid = (value) => typeof value === "string" && value.length >= 8 && value.length <= 200;
export function validEnvelope(value) {
  return Boolean(value && value.schema === EXCHANGE && idIsValid(value.id) && Number.isFinite(Date.parse(value.created_at))
    && value.source?.ecosystem === "architectonica" && typeof value.source.product === "string"
    && typeof value.source.record_schema === "string" && value.payload?.schema === value.source.record_schema
    && (value.payload?.id === value.source.record_id || value.payload?.handoffId === value.source.record_id)
    && CLASSES.has(value.evidence_class) && value.verified === false);
}
const uuid = () => globalThis.crypto?.randomUUID?.() || `exchange-${Date.now()}-${Math.random().toString(16).slice(2)}`;
function readJournal() {
  const entries = JSON.parse(localStorage.getItem(KEY) || "[]");
  if (!Array.isArray(entries) || entries.length > 100 || !entries.every(validEnvelope)) throw new Error("INVALID_JOURNAL");
  return entries;
}
export function toEnvelope(record) {
  const recordId = idIsValid(record?.id) ? record.id : idIsValid(record?.handoffId) ? record.handoffId : null;
  if (!record || typeof record.schema !== "string" || !recordId) throw new Error("UNSUPPORTED_RECORD");
  const source = KNOWN.find(([pattern]) => pattern.test(record.schema));
  const product = source?.[1] ?? "unclassified-source";
  return { schema: EXCHANGE, id: uuid(), created_at: new Date().toISOString(),
    source: { ecosystem: "architectonica", product, repository: source?.[2] ?? "unknown", record_schema: record.schema, record_id: recordId },
    payload: record, evidence_class: CLASSES.has(record.evidence?.class) ? record.evidence.class : "none", verified: false };
}
export function normalize(value) {
  const records = value?.schema === JOURNAL ? value.entries : Array.isArray(value) ? value : [value];
  if (!Array.isArray(records) || records.length < 1 || records.length > 100) throw new Error("INVALID_IMPORT");
  return records.map((record) => validEnvelope(record) ? record : toEnvelope(record));
}
function download(filename, value) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.hidden = true; document.body.append(anchor); anchor.click();
  setTimeout(() => { anchor.remove(); URL.revokeObjectURL(url); }, 1000);
}
function install() {
  if (document.querySelector("#architectonica-exchange")) return;
  const style = document.createElement("style");
  style.textContent = `#architectonica-exchange{position:fixed;z-index:9999;right:max(16px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));width:min(370px,calc(100vw - 32px));font:13px/1.5 system-ui,sans-serif;color:#edf8f5}#architectonica-exchange details{background:#0b1d1a;border:1px solid #3a746a;box-shadow:0 14px 48px #0008}#architectonica-exchange summary{padding:12px 16px;cursor:pointer;list-style:none;color:#56e2cc;font-weight:700}#architectonica-exchange .body{padding:0 16px 16px;border-top:1px solid #25433d}#architectonica-exchange p{margin:12px 0;color:#a9bfba;font-size:11px}#architectonica-exchange .actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}#architectonica-exchange button,#architectonica-exchange label{min-height:40px;padding:8px;border:1px solid #45645e;background:#102722;color:#edf8f5;display:grid;place-items:center;text-align:center;font:inherit;font-size:11px;cursor:pointer}#architectonica-exchange input{display:none}#architectonica-exchange .wide{grid-column:1/-1}#architectonica-exchange output{display:block;margin-top:10px;color:#8fc7b9;font-size:11px}#architectonica-exchange ul{max-height:145px;overflow:auto;padding-left:18px;color:#b8cbc5;font-size:10px}#architectonica-exchange .warn{color:#d9b86c}@media(max-width:500px){#architectonica-exchange{right:8px;bottom:8px;width:calc(100vw - 16px)}}`;
  document.head.append(style);
  const panel = document.createElement("aside"); panel.id = "architectonica-exchange";
  panel.innerHTML = `<details><summary>↔ Обмен экосистемы · локально</summary><div class="body"><p>Подключите JSON текущей программы или возврат из другой студии. Исходная запись сохраняется; подлинность не проверяется.</p><div class="actions"><label>Импорт JSON<input id="exchange-import" type="file" accept="application/json,.json"></label><button id="exchange-export-one" disabled>Скачать конверт</button><button id="exchange-export-journal" class="wide">Скачать общий журнал</button></div><output id="exchange-message" aria-live="polite">Данные остаются в браузере до ручного экспорта.</output><ul id="exchange-entries"></ul><p class="warn">Не добавляйте персональные данные или секреты. verified=false всегда. Пакет памяти RTE не принимается.</p></div></details>`;
  document.body.append(panel);
  let latest = null; const message = panel.querySelector("#exchange-message"), list = panel.querySelector("#exchange-entries");
  const render = () => {
    try {
      const entries = readJournal();
      list.replaceChildren(...entries.slice(0, 8).map((entry) => { const item = document.createElement("li"); item.textContent = `${entry.source.product} · ${entry.source.record_schema} · verified=false`; return item; }));
      if (!entries.length) list.textContent = "Журнал пока пуст.";
    } catch { list.textContent = "Журнал недоступен или повреждён; исходные данные не перезаписаны."; }
  };
  panel.querySelector("#exchange-import").addEventListener("change", async (event) => {
    const input = event.currentTarget, file = input.files?.[0]; if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error("TOO_LARGE");
      const incoming = normalize(JSON.parse(await file.text())), journal = readJournal(), byId = new Map(journal.map((item) => [item.id, item]));
      incoming.forEach((item) => byId.set(item.id, item));
      localStorage.setItem(KEY, JSON.stringify([...byId.values()].slice(-100).reverse()));
      latest = incoming.at(-1); panel.querySelector("#exchange-export-one").disabled = false;
      message.textContent = `Принято: ${incoming.length}. Источник и содержимое не верифицированы.`; render();
    } catch (error) {
      message.textContent = error.message === "INVALID_JOURNAL" ? "Локальный журнал повреждён; он не перезаписан." : error.message === "TOO_LARGE" ? "Файл больше 2 МБ; перенесите записи частями." : "Файл не распознан или не содержит переносимую запись с schema и id.";
    } finally { input.value = ""; }
  });
  panel.querySelector("#exchange-export-one").addEventListener("click", () => latest && download(`architectonica-exchange-${latest.id}.json`, latest));
  panel.querySelector("#exchange-export-journal").addEventListener("click", () => {
    try { const entries = readJournal(); download("architectonica-exchange-journal.json", { schema: JOURNAL, exported_at: new Date().toISOString(), entries }); message.textContent = `Экспортировано: ${entries.length}. Файл остаётся у вас.`; }
    catch { message.textContent = "Экспорт невозможен: журнал недоступен или повреждён."; }
  });
  render();
}
if (typeof document !== "undefined") document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", install, { once: true }) : install();
