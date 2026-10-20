export const AXIS_HANDOFF_SCHEMA = "architectonica.axis-handoff/1.0.0";
export const AXIS_RETURN_SCHEMA = "architectonica.axis-return/1.0.0";
export const ECOSYSTEM_EXCHANGE_SCHEMA = "architectonica.ecosystem-exchange/1.0.0";
const MAX_TOKEN_LENGTH = 16000;
const limits = { object:500, subject_manifestation:1200, reflected_image:1200, target_relation:1200, context:1200, next_action:1200, invariant:1200 };
const clean = value => typeof value === "string" ? value.trim() : "";
const validText = (value,key) => clean(value).length >= 3 && clean(value).length <= limits[key];
const validId = value => typeof value === "string" && value.length >= 8 && value.length <= 200;

function bytesToBase64(bytes) {
  let binary="";
  for(let index=0;index<bytes.length;index+=1) binary+=String.fromCharCode(bytes[index]);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary=atob(value),bytes=new Uint8Array(binary.length);
  for(let index=0;index<binary.length;index+=1) bytes[index]=binary.charCodeAt(index);
  return bytes;
}

export function encodeEnvelope(value) {
  const token=bytesToBase64(new TextEncoder().encode(JSON.stringify(value))).replaceAll("+","-").replaceAll("/","_").replace(/=+$/u,"");
  if(token.length>MAX_TOKEN_LENGTH) throw new Error("AXIS_TOKEN_TOO_LARGE");
  return token;
}

export function decodeEnvelope(token) {
  if(typeof token!=="string"||token.length<8||token.length>MAX_TOKEN_LENGTH||!/^[A-Za-z0-9_-]+$/u.test(token)) throw new Error("INVALID_AXIS_TOKEN");
  const base64=token.replaceAll("-","+").replaceAll("_","/").padEnd(Math.ceil(token.length/4)*4,"=");
  return JSON.parse(new TextDecoder().decode(base64ToBytes(base64)));
}

export function validateAxisHandoff(value) {
  if(!value||value.schema!==AXIS_HANDOFF_SCHEMA||value.producer!=="gdeya"||value.recipient!=="reson-field-check"||!validId(value.id)
    ||typeof value.created_at!=="string"||!Number.isFinite(Date.parse(value.created_at))||value.q!==null||value.evidence_status!=="self-reported-draft") return false;
  return Object.keys(limits).every(key=>validText(value[key],key));
}

export function axisFromHash(hash) {
  try {
    const token=new URLSearchParams(String(hash||"").replace(/^#/u,"")).get("axis");
    const handoff=decodeEnvelope(token);
    return validateAxisHandoff(handoff)?{ok:true,handoff,token}:{ok:false,reason:"INVALID_AXIS_HANDOFF"};
  } catch { return {ok:false,reason:"INVALID_AXIS_HANDOFF"}; }
}

export function createAxisReturn(handoff,decision,environment={}) {
  if(!validateAxisHandoff(handoff)||!decision||decision.schema!=="reson.collective-meta-decision/1.1.0"||decision.shared_object!==handoff.object||decision.q!==null
    ||typeof decision.allow!=="boolean"||typeof decision.links_verified!=="boolean"||!["ok","trust","missing-metrics","metrics"].includes(decision.gate)) throw new Error("AXIS_DECISION_MISMATCH");
  const now=environment.now??Date.now();
  const makeId=environment.uuid??(()=>globalThis.crypto?.randomUUID?.()||`return-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  return {schema:AXIS_RETURN_SCHEMA,id:makeId(),created_at:new Date(now).toISOString(),producer:"reson-field-check",recipient:"gdeya-axis",handoff_id:handoff.id,
    field_decision_id:decision.id,object:decision.shared_object,allow:decision.allow,links_verified:decision.links_verified,gate:decision.gate,q:null};
}

export function createExchangeRecord(record, product = "reson-field-check", environment = {}) {
  if (!record || typeof record.schema !== "string" || !validId(record.id)) throw new Error("INVALID_EXCHANGE_RECORD");
  const now = environment.now ?? Date.now();
  const makeId = environment.uuid ?? (() => globalThis.crypto?.randomUUID?.() || `exchange-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  return { schema: ECOSYSTEM_EXCHANGE_SCHEMA, id: makeId(), created_at: new Date(now).toISOString(),
    source: { ecosystem: "architectonica", product, repository: "reason-", record_schema: record.schema, record_id: record.id },
    payload: record, evidence_class: "none", verified: false };
}

export function buildGdeyaReturnUrl(handoff,returned,base="https://lacinnik.github.io/Game-GDEYA/labs/axis-cycle/") {
  if(!validateAxisHandoff(handoff)||returned?.schema!==AXIS_RETURN_SCHEMA||returned.handoff_id!==handoff.id) throw new Error("AXIS_RETURN_MISMATCH");
  const url=new URL(base);
  if(url.protocol!=="https:"&&url.hostname!=="127.0.0.1"&&url.hostname!=="localhost") throw new Error("INVALID_RETURN_ORIGIN");
  url.hash=new URLSearchParams({source:encodeEnvelope(handoff),return:encodeEnvelope(returned)}).toString();
  return url.href;
}
