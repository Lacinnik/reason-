import test from "node:test";
import assert from "node:assert/strict";
import { assessField } from "../field-check/runtime.mjs";
import { compileTzarLanguage } from "../tzar-language-001.mjs";
import { buildSession, cleanVoices } from "../transmissions/runtime.mjs";
import { TRANSMISSIONS } from "../transmissions/catalog.mjs";
const group = value => [{id:"a",trustTo:"b",alpha:value,qualityHypothesis:value,T:value},{id:"b",trustTo:"a",alpha:value,qualityHypothesis:value,T:value}];
test("Field Check never upgrades missing estimates into ALLOW",()=>{
  for(const value of [null,undefined,"0.75",NaN,Infinity,-1,2]) {
    const result=assessField(group(value)); assert.equal(result.allow,false); assert.equal(result.gate,"missing-metrics"); assert.deepEqual(result.metrics,{alpha:null,qualityHypothesis:null,T:null});
  }
  const partial=group(.75); partial[1].T=null; assert.equal(assessField(partial).allow,false);
});
test("Field Check distinguishes low estimates, unknown links, empty group, declared threshold",()=>{
  assert.equal(assessField(group(.75)).allow,true);
  assert.equal(assessField(group(.5)).gate,"metrics");
  assert.equal(assessField([]).allow,false);
  const invalid=group(1); invalid[0].trustTo="ghost"; assert.equal(assessField(invalid).gate,"trust");
});
test("language compiler preserves unknown coordinates and rejects coerced Q",()=>{
  const empty=compileTzarLanguage({});
  assert.equal(empty.status,"HOLD-INPUT");
  assert.equal(empty.tensor.O,null); assert.equal(empty.tensor.S,null); assert.equal(empty.tensor.Q,null);
  for(const q of ["0","1","",false,true]) assert.throws(()=>compileTzarLanguage({observedQ:q}),/Q_MUST_BE_OBSERVED_BINARY/);
});
test("all seven transmissions preserve declared mode, explicit gate, and Q=null",()=>{
  const draft={object:"Выпуск нового продукта",tension:"Собрать общий следующий шаг",voices:"Анна\nБорис",voiceTrace:"Оба голоса предъявили различия",nextStep:"Собрать единый макет",owner:"Анна",window:"завтра"};
  for(const tx of TRANSMISSIONS) for(const voiceGate of ["presented","not-presented"]) {
    const session=buildSession({...draft,txId:tx.id,voiceGate},TRANSMISSIONS);
    assert.equal(session.transmission.id,tx.id); assert.equal(session.language.selection.transmission.id,tx.id);
    assert.equal(session.outcome,voiceGate==="presented"?"ready":"hold"); assert.equal(session.language.tensor.Q,null);
  }
});
test("ninth voice is rejected, never silently dropped",()=>{
  const voices=Array.from({length:9},(_,i)=>"Участник "+i).join("\n");
  assert.equal(cleanVoices(voices).length,9);
  assert.throws(()=>buildSession({voices},TRANSMISSIONS),/VOICES_OVERFLOW/);
});
