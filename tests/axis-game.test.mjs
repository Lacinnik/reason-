import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../axis-game/index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function harness(storage = new Map()) {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, { id, style: {}, dataset: {}, textContent: '',
        classList: { toggle(k, on) { if (on) classes.add(k); else classes.delete(k); }, contains: k => classes.has(k), add: k => classes.add(k), remove: k => classes.delete(k) },
        scrollIntoView() {}, getContext: () => new Proxy({}, { get: () => () => {} }),
      });
    }
    return elements.get(id);
  };
  const geometries = ['euclid', 'lob', 'riemann', 'projective', 'supra'].map(g => Object.assign(element(g), { dataset: { g } }));
  const operators = ['measure', 'love', 'axis', 'discern'].map(o => Object.assign(element(o), { dataset: { o } }));
  const screens = ['intro', 'game', 'help', 'end'].map(element);
  const context = { document: { querySelector: s => element(s), querySelectorAll: s => s === '.screen' ? screens : s === '[data-g]' ? geometries : s === '[data-o]' ? operators : [] },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v) },
    navigator: {}, innerWidth: 400, innerHeight: 800, devicePixelRatio: 1,
    addEventListener() {}, requestAnimationFrame() {}, setTimeout() {},
  };
  context.window = context;
  vm.runInNewContext(script, context);
  element('#again').onclick();
  return { context, element, storage, choose() { geometries[0].onclick(); operators[0].onclick(); },
    finish() { for (let i=0;i<8;i++) { this.choose(); element('#resolve').onclick(); element('#next').onclick(); } },
  };
}

test('AXIS requires both choices and admits one result per node', () => {
  const h = harness();
  h.element('#resolve').onclick();
  h.element('#next').onclick();
  assert.equal(h.context.fieldState.i, 0);
  assert.equal(h.context.fieldState.log.length, 0);
  h.choose();
  h.element('#resolve').onclick();
  const state = JSON.stringify(h.context.fieldState);
  h.element('#resolve').onclick();
  assert.equal(JSON.stringify(h.context.fieldState), state);
});

test('AXIS completes exactly eight nodes and preserves a bounded score', () => {
  const h = harness(); h.finish();
  assert.equal(h.context.fieldState.log.length, 8);
  assert.ok(h.element('end').classList.contains('active'));
  assert.ok(h.context.fieldState.score >= 0 && h.context.fieldState.score <= 100);
  h.element('#next').onclick();
  assert.equal(h.context.fieldState.i, 8);
  assert.match(h.element('#saveStatus').textContent, /сохранён/);
});

for (const failure of ['read', 'write', 'silent', 'corrupt']) {
  test(`AXIS shows the result without claiming persistence on ${failure} failure`, () => {
    const h = harness();
    if (failure === 'read') h.context.localStorage.getItem = () => { throw new Error('denied'); };
    if (failure === 'write') h.context.localStorage.setItem = () => { throw new Error('quota'); };
    if (failure === 'silent') h.context.localStorage.setItem = () => {};
    if (failure === 'corrupt') h.storage.set('tzar-axis-best', 'broken');
    h.finish();
    assert.ok(h.element('end').classList.contains('active'));
    assert.match(h.element('#saveStatus').textContent, /не подтверждено/);
    if (failure === 'corrupt') assert.equal(h.storage.get('tzar-axis-best'), 'broken');
  });
}

test('AXIS explicitly distinguishes game scores from psychological measurement', () => {
  assert.match(html, /не психологическая диагностика/);
  assert.match(html, /Внешний возврат Q не измерялся/);
});
