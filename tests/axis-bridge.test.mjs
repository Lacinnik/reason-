import test from "node:test";
import assert from "node:assert/strict";
import { axisFromHash, buildGdeyaReturnUrl, createAxisReturn, createExchangeRecord, encodeEnvelope, validateAxisHandoff } from "../field-check/axis-bridge.mjs";

const handoff={schema:"architectonica.axis-handoff/1.0.0",id:"handoff-12345678",created_at:new Date(0).toISOString(),producer:"gdeya",recipient:"reson-field-check",
  object:"Запуск общего проекта",subject_manifestation:"Автор удерживает личную ось",reflected_image:"Мост между субъектом и полем",target_relation:"Предъявить объект без передачи авторства",
  context:"Встреча рабочей группы",next_action:"Назначить владельца следующего шага",invariant:"Сохранить объект и отдельность голосов",q:null,evidence_status:"self-reported-draft"};

test("RESON accepts a structurally valid GDEYA axis handoff from the URL fragment",()=>{
  assert.ok(validateAxisHandoff(handoff));
  const result=axisFromHash(`#axis=${encodeEnvelope(handoff)}`);
  assert.equal(result.ok,true);
  assert.equal(result.handoff.object,handoff.object);
  assert.equal(result.handoff.q,null);
});

test("RESON return keeps Q null and is linked to the exact handoff",()=>{
  const decision={schema:"reson.collective-meta-decision/1.1.0",id:"field-12345678",shared_object:handoff.object,q:null,allow:true,links_verified:true,gate:"ok"};
  const returned=createAxisReturn(handoff,decision,{now:1000,uuid:()=>"return-12345678"});
  assert.equal(returned.handoff_id,handoff.id);
  assert.equal(returned.q,null);
  const url=buildGdeyaReturnUrl(handoff,returned);
  assert.match(url,/https:\/\/lacinnik\.github\.io\/Game-GDEYA\/labs\/axis-cycle\/#/u);
  assert.match(url,/source=/u);
  assert.match(url,/return=/u);
});

test("axis bridge rejects changed objects",()=>{
  const decision={schema:"reson.collective-meta-decision/1.1.0",id:"field-12345678",shared_object:"Другой объект",q:null,allow:false,links_verified:false,gate:"trust"};
  assert.throws(()=>createAxisReturn(handoff,decision),/AXIS_DECISION_MISMATCH/u);
});

test("REZON exports its legacy decision in the ecosystem exchange envelope",()=>{
  const decision={schema:"reson.collective-meta-decision/1.1.0",id:"field-12345678",q:null};
  const envelope=createExchangeRecord(decision,"reson-field-check",{now:2000,uuid:()=>"exchange-12345678"});
  assert.equal(envelope.schema,"architectonica.ecosystem-exchange/1.0.0");
  assert.equal(envelope.payload,decision);
  assert.equal(envelope.source.record_id,decision.id);
  assert.equal(envelope.verified,false);
});
