export const SESSION_SCHEMA = "architectonica.seven-transmissions-session/1.0.0-rc.1";
const KEYWORDS = [
  ["TX7", ["заново","перезапуск","отпустить","устарел","закрыть","обнул"]],
  ["TX5", ["результат","сделать","выпустить","артефакт","срок","материал"]],
  ["TX4", ["разрыв","конфликт","между","связать","мост","разные"]],
  ["TX6", ["встроить","интеграц","система","целое","процесс"]],
  ["TX1", ["основан","ядро","смысл","главное","опора"]],
  ["TX2", ["застрял","обойти","движение","ракурс","круг"]],
];

export function cleanVoices(value) {
  return [...new Set(String(value || "").split(/[\n,;]+/u).map(item => item.trim()).filter(Boolean))].slice(0, 8);
}

export function suggestTransmission(text) {
  const normalized = String(text || "").toLocaleLowerCase("ru");
  const found = KEYWORDS.find(([, words]) => words.some(word => normalized.includes(word)));
  return found ? { id:found[0], reason:"В предъявленном напряжении найден явный маркер: «" + found[1].find(word => normalized.includes(word)) + "»." } : { id:"TX3", reason:"Явного маркера режима нет; начните с взаимного отклика и затем выберите вручную." };
}

export function validateSession(draft, catalog) {
  const errors = [];
  if (String(draft.object || "").trim().split(/\s+/u).filter(Boolean).length < 3) errors.push("OBJECT_INCOMPLETE");
  if (String(draft.tension || "").trim().split(/\s+/u).filter(Boolean).length < 3) errors.push("TENSION_INCOMPLETE");
  if (cleanVoices(draft.voices).length < 2) errors.push("VOICES_INCOMPLETE");
  if (!catalog.some(item => item.id === draft.txId)) errors.push("TRANSMISSION_REQUIRED");
  if (String(draft.voiceTrace || "").trim().split(/\s+/u).filter(Boolean).length < 3) errors.push("TRACE_INCOMPLETE");
  if (String(draft.nextStep || "").trim().split(/\s+/u).filter(Boolean).length < 3) errors.push("STEP_INCOMPLETE");
  if (!String(draft.owner || "").trim()) errors.push("OWNER_REQUIRED");
  if (!String(draft.window || "").trim()) errors.push("WINDOW_REQUIRED");
  if (!["presented", "not-presented"].includes(draft.voiceGate)) errors.push("VOICE_GATE_REQUIRED");
  return errors;
}

export function buildSession(draft, catalog, environment = {}) {
  const errors = validateSession(draft, catalog);
  if (errors.length) { const error = new Error("Transmission session is incomplete: " + errors.join(", ")); error.codes = errors; throw error; }
  const transmission = catalog.find(item => item.id === draft.txId);
  const now = environment.now || (() => new Date().toISOString());
  const uuid = environment.uuid || (() => globalThis.crypto?.randomUUID?.() || "tx-" + Date.now());
  const ready = draft.voiceGate === "presented";
  return {
    schema: SESSION_SCHEMA,
    id: uuid(),
    createdAt: now(),
    laboratory: "reson",
    lifecycleState: "release-candidate",
    sharedObject: draft.object.trim(),
    declaredTension: draft.tension.trim(),
    voices: cleanVoices(draft.voices),
    transmission: { id:transmission.id, title:transmission.title, symbol:transmission.symbol, mode:transmission.mode },
    voiceTrace: draft.voiceTrace.trim(),
    nextStep: draft.nextStep.trim(),
    owner: draft.owner.trim(),
    window: draft.window.trim(),
    voiceGate: draft.voiceGate,
    outcome: ready ? "ready" : "hold",
    evidence: ["user-declared-object", "named-voices", "selected-transmission", "user-declared-voice-gate"],
    boundary: "The deck records explicit statements only; silence is never treated as consent and no hidden group state is inferred.",
    storage: "local-browser-only",
  };
}
