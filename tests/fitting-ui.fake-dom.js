// Minimales Fake-DOM (nur die Teilmenge, die die Fitting-Ansicht und js/util/dom.js benutzen).
// Kein Ersatz für einen Browser: prüft Verdrahtung und Logik, nicht Layout oder Styling.

const SVG_NS = 'http://www.w3.org/2000/svg';
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

class FakeText {
  constructor(data) { this.nodeType = 3; this.data = String(data); this.parent = null; }
  get textContent() { return this.data; }
}

class FakeElement {
  constructor(doc, tag, ns = null) {
    this.nodeType = 1; this.ownerDocument = doc; this.tagName = tag; this.namespaceURI = ns;
    this.attrs = new Map(); this.children = []; this.parent = null; this.listeners = new Map();
    this.styleProps = new Map(); this.style = { setProperty: (k, v) => this.styleProps.set(k, v) };
    this.value = ''; this.checked = false; this.disabled = false; this.hidden = false; this.open = false;
  }
  get firstChild() { return this.children[0] ?? null; }
  get isConnected() { let n = this; while (n.parent) n = n.parent; return n === this.ownerDocument.body; }
  get dataset() {
    const out = {};
    for (const [k, v] of this.attrs) if (k.startsWith('data-')) out[camel(k.slice(5))] = v;
    return out;
  }
  get className() { return this.attrs.get('class') ?? ''; }
  get classes() { return this.className.split(/\s+/).filter(Boolean); }
  get textContent() { return this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.children.forEach((c) => { c.parent = null; }); this.children = []; if (v !== '') this.append(String(v)); }
  setAttribute(k, v) {
    this.attrs.set(k, String(v));
    if (k === 'hidden') this.hidden = true;
    if (k === 'open') this.open = true;
  }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  removeAttribute(k) { this.attrs.delete(k); }
  appendChild(n) { if (n.parent) n.parent.removeChild(n); n.parent = this; this.children.push(n); return n; }
  append(...nodes) {
    for (const n of nodes.flat(Infinity)) {
      if (n === null || n === undefined) continue;
      this.appendChild(typeof n === 'object' && 'nodeType' in n ? n : new FakeText(n));
    }
  }
  removeChild(n) { const i = this.children.indexOf(n); if (i >= 0) this.children.splice(i, 1); n.parent = null; return n; }
  remove() { this.parent?.removeChild(this); }
  contains(n) { for (let x = n; x; x = x.parent) if (x === this) return true; return false; }
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(fn); }
  removeEventListener(type, fn) { const l = this.listeners.get(type) ?? []; l.splice(l.indexOf(fn), 1); }
  focus() { this.ownerDocument.activeElement = this; this.dispatch('focus', {}, false); this.dispatch('focusin', {}, true); }
  click() { if (this.getAttribute('aria-disabled') === 'true' && false) return; this.dispatch('click'); }
  showModal() { this.open = true; this.setAttribute('open', ''); }
  close() { if (!this.open) return; this.open = false; this.attrs.delete('open'); this.dispatch('close', {}, false); }
  /** Ereignis auslösen (blubbert nach oben). */
  dispatch(type, init = {}, bubbles = true) {
    const ev = {
      type, target: this, currentTarget: null, defaultPrevented: false, key: undefined,
      preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...init
    };
    for (let n = this; n && n.nodeType === 1; n = bubbles ? n.parent : null) {
      ev.currentTarget = n;
      for (const fn of [...(n.listeners.get(type) ?? [])]) fn(ev);
      if (!bubbles) break;
    }
    return ev;
  }
  // Selektoren: Tag, #id, .klasse, [attr], [attr="wert"], kombiniert; Leerzeichen = Nachfahre. Kein :not() u. ä.
  matchesCompound(sel) {
    const bare = sel.replace(/\[[^\]]*\]/g, ''); // Attributteile nicht als Klasse/ID deuten (Werte enthalten Punkte)
    const tag = /^[a-z][a-z0-9-]*/i.exec(bare)?.[0];
    if (tag && tag.toLowerCase() !== this.tagName.toLowerCase()) return false;
    for (const m of bare.matchAll(/#([\w-]+)/g)) if (this.getAttribute('id') !== m[1]) return false;
    for (const m of bare.matchAll(/\.([\w-]+)/g)) if (!this.classes.includes(m[1])) return false;
    for (const m of sel.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
      const v = this.getAttribute(m[1]);
      if (v === null || (m[2] !== undefined && v !== m[2])) return false;
    }
    return true;
  }
  querySelectorAll(selector) {
    const parts = selector.trim().split(/\s+(?![^[]*\])/);
    const walk = (node, i, out) => {
      for (const c of node.children) {
        if (c.nodeType !== 1) continue;
        if (c.matchesCompound(parts[i])) {
          if (i === parts.length - 1) out.push(c); else walk(c, i + 1, out);
        }
        walk(c, i, out);
      }
      return out;
    };
    return [...new Set(walk(this, 0, []))];
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}

export function createFakeDocument() {
  const doc = {
    activeElement: null,
    createElement: (tag) => new FakeElement(doc, tag),
    createElementNS: (ns, tag) => new FakeElement(doc, tag, ns ?? SVG_NS),
    createTextNode: (data) => new FakeText(data),
    getElementById: () => null
  };
  doc.body = new FakeElement(doc, 'body');
  doc.head = new FakeElement(doc, 'head');
  return doc;
}

/** Installiert ein Fake-`document` global; liefert { document, root, restore }. */
export function installFakeDom() {
  const previous = globalThis.document;
  const document = createFakeDocument();
  globalThis.document = document;
  const root = document.createElement('div');
  document.body.append(root);
  return { document, root, restore() { globalThis.document = previous; } };
}

/** Texte (Kleinbuchstaben nicht verändert) aller Nachfahren. */
export const textOf = (el) => el.textContent;
