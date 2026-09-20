import test from "node:test";
import assert from "node:assert/strict";
import { readJournal, persistJournal, persistValue } from "../local-journal.mjs";
const store = initial => { const data = new Map(initial === undefined ? [] : [["key", initial]]); return { getItem:key=>data.get(key) ?? null, setItem:(key,value)=>data.set(key,value) }; };
test("journal prepends, caps at 100, verifies write", () => {
 const storage = store(JSON.stringify(Array.from({length:100},(_,id)=>({id}))));
 assert.equal(persistJournal(storage,"key",{id:"new"}).ok,true);
 const result=readJournal(storage,"key"); assert.equal(result.entries.length,100); assert.equal(result.entries[0].id,"new");
});
test("corrupt and wrong-shape journals are not overwritten", () => {
 for(const raw of ["{","null","{}","false"]) { const storage=store(raw); assert.equal(persistJournal(storage,"key",{}).ok,false); assert.equal(storage.getItem("key"),raw); }
});
test("storage read/write denial and silent loss fail closed", () => {
 for(const storage of [{getItem(){throw Error("denied")}}, {getItem:()=>null,setItem(){throw Error("quota")}}, {getItem:()=>null,setItem(){}}]) assert.equal(persistJournal(storage,"key",{}).ok,false);
 assert.equal(persistValue({setItem(){},getItem(){throw Error("denied")}},"key",{}).ok,false);
});
test("empty journal is distinct from inaccessible journal",()=>{ assert.deepEqual(readJournal(store(),"key"),{ok:true,entries:[]}); assert.equal(readJournal({getItem(){throw Error()}},"key").ok,false); });
