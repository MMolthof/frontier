import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Minimales Fake-DOM, nur um die Logik von h()/clear()/setText() zu prüfen (kein Browser nötig).
function makeEl(tag, ns = null) {
  const el = {
    nodeType: 1, tagName: tag, namespaceURI: ns, attrs: {}, children: [], style: {}, dataset: {}, listeners: {},
    get firstChild() { return this.children[0] ?? null; },
    get textContent() { return this.children.map((c) => (c.nodeType === 3 ? c.data : c.textContent)).join(''); },
    set textContent(v) { this.children = [{ nodeType: 3, data: String(v) }]; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    addEventListener(type, fn) { this.listeners[type] = fn; },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children.splice(this.children.indexOf(c), 1); }
  };
  el.ownerDocument = doc;
  return el;
}
const doc = {
  createElement: (t) => makeEl(t),
  createElementNS: (ns, t) => makeEl(t, ns),
  createTextNode: (data) => ({ nodeType: 3, data })
};
let h, clear, setText, saved;
before(async () => {
  saved = globalThis.document;
  globalThis.document = doc;
  ({ h, clear, setText } = await import('../js/util/dom.js'));
});
after(() => { globalThis.document = saved; });

test('h: Attribute, class-Array, dataset, style, Events, boolesche Attribute', () => {
  let clicked = 0;
  const el = h('button', {
    class: ['c-btn', false, 'c-btn--alt'], dataset: { id: 7 }, style: { width: '40%' },
    onClick: () => clicked++, disabled: true, 'aria-label': 'x', hidden: false, title: null
  }, 'Los');
  assert.equal(el.attrs.class, 'c-btn c-btn--alt');
  assert.equal(el.dataset.id, '7');
  assert.equal(el.style.width, '40%');
  assert.equal(el.attrs.disabled, '');
  assert.equal(el.attrs['aria-label'], 'x');
  assert.ok(!('hidden' in el.attrs) && !('title' in el.attrs));
  el.listeners.click();
  assert.equal(clicked, 1);
  assert.equal(el.textContent, 'Los');
});

test('h: Kinder (verschachtelte Arrays, null, Zahlen, Nodes), attrs weggelassen, SVG-Namespace', () => {
  const el = h('div', null, 'a', [h('span', null, 'b'), null, [3]], false);
  assert.equal(el.textContent, 'ab3');
  const noAttrs = h('p', 'nur Text');
  assert.equal(noAttrs.textContent, 'nur Text');
  const child = h('i', null, 'k');
  assert.equal(h('div', child).children[0], child);
  assert.equal(h('svg', { viewBox: '0 0 100 60' }, h('path', { d: 'M0 0' })).namespaceURI, 'http://www.w3.org/2000/svg');
});

test('clear und setText', () => {
  const el = h('div', null, 'x', h('b', null, 'y'));
  clear(el);
  assert.equal(el.children.length, 0);
  setText(el, 5);
  assert.equal(el.textContent, '5');
  const before = el.children[0];
  setText(el, '5');
  assert.equal(el.children[0], before); // unverändert, kein neuer Knoten
});
