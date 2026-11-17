// Erweitertes Fake-DOM für UI-Tests (kein .test.mjs-Suffix, läuft nicht selbst als Test).
// Unterstützt: classList, Attribute, dataset, Events mit Bubbling, Tastaturereignisse, querySelector(All)
// für einfache Selektoren (tag, .klasse, #id, [attr], [attr="wert"], Kombination ohne Leerzeichen), Fokus.

export function createFakeDom() {
  const doc = { activeElement: null, title: '' };

  class FakeText {
    constructor(data) { this.nodeType = 3; this.data = String(data); this.parentNode = null; this.ownerDocument = doc; }
    get textContent() { return this.data; }
    set textContent(v) { this.data = String(v); }
  }

  class FakeEvent {
    constructor(type, init = {}) { Object.assign(this, { bubbles: true, cancelable: true }, init); this.type = type; this.defaultPrevented = false; this.target = null; }
    preventDefault() { this.defaultPrevented = true; }
    stopPropagation() { this.stopped = true; }
  }

  function matches(el, selector) {
    const parts = selector.match(/(\.[\w-]+|#[\w-]+|\[[^\]]+\]|^[a-zA-Z][\w-]*)/g) ?? [];
    return parts.every((p) => {
      if (p[0] === '.') return el.classList.contains(p.slice(1));
      if (p[0] === '#') return el.getAttribute('id') === p.slice(1);
      if (p[0] === '[') {
        const m = /^\[([\w-]+)(?:="?([^"\]]*)"?)?\]$/.exec(p);
        if (!m) return false;
        return m[2] === undefined ? el.hasAttribute(m[1]) : el.getAttribute(m[1]) === m[2];
      }
      return el.tagName.toLowerCase() === p.toLowerCase();
    });
  }

  class FakeElement {
    constructor(tag, ns = null) {
      this.nodeType = 1; this.tagName = tag; this.namespaceURI = ns; this.ownerDocument = doc;
      this.attrs = {}; this.children = []; this.parentNode = null; this.style = {}; this.dataset = {}; this.listeners = {};
      const self = this;
      this.classList = {
        contains: (c) => self.#classes().includes(c),
        add: (...cs) => self.#setClasses([...new Set([...self.#classes(), ...cs])]),
        remove: (...cs) => self.#setClasses(self.#classes().filter((c) => !cs.includes(c))),
        toggle: (c, force) => {
          const has = self.#classes().includes(c);
          const want = force === undefined ? !has : force;
          if (want && !has) self.classList.add(c); else if (!want && has) self.classList.remove(c);
          return want;
        }
      };
    }
    #classes() { return (this.attrs.class ?? '').split(/\s+/).filter(Boolean); }
    #setClasses(list) { this.attrs.class = list.join(' '); }
    get className() { return this.attrs.class ?? ''; }
    set className(v) { this.attrs.class = String(v); }
    get id() { return this.attrs.id ?? ''; }
    set id(v) { this.attrs.id = String(v); }
    get firstChild() { return this.children[0] ?? null; }
    get childNodes() { return this.children; }
    get textContent() { return this.children.map((c) => c.textContent).join(''); }
    set textContent(v) { this.children.forEach((c) => { c.parentNode = null; }); this.children = []; this.appendChild(new FakeText(v)); }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    hasAttribute(k) { return k in this.attrs; }
    removeAttribute(k) { delete this.attrs[k]; }
    appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
    append(...cs) { cs.forEach((c) => this.appendChild(typeof c === 'object' ? c : new FakeText(c))); }
    insertBefore(c, ref) {
      if (c.parentNode) c.parentNode.removeChild(c);
      c.parentNode = this;
      const i = ref ? this.children.indexOf(ref) : -1;
      if (i < 0) this.children.push(c); else this.children.splice(i, 0, c);
      return c;
    }
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; return c; }
    remove() { this.parentNode?.removeChild(this); }
    replaceChildren(...cs) { [...this.children].forEach((c) => this.removeChild(c)); this.append(...cs); }
    contains(n) { for (let x = n; x; x = x.parentNode) if (x === this) return true; return false; }
    addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
    removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== fn); }
    dispatchEvent(ev) {
      if (!ev.target) ev.target = this;
      for (const fn of [...(this.listeners[ev.type] ?? [])]) fn.call(this, ev);
      if (ev.bubbles && !ev.stopped && this.parentNode?.dispatchEvent) this.parentNode.dispatchEvent(ev);
      return !ev.defaultPrevented;
    }
    focus() {
      if (this.attrs.disabled !== undefined) return;
      doc.activeElement = this;
      this.dispatchEvent(new FakeEvent('focus', { bubbles: false }));
    }
    blur() { if (doc.activeElement === this) doc.activeElement = null; }
    click() { this.dispatchEvent(new FakeEvent('click')); }
    querySelectorAll(sel) {
      const out = [];
      const selectors = sel.split(',').map((s) => s.trim().split(/\s+/));
      const self = this;
      // Nachfahren-Kombinator (Leerzeichen): letzter Teil muss auf c passen, die übrigen auf Vorfahren in Reihenfolge.
      const test = (c, chain) => {
        if (!matches(c, chain[chain.length - 1])) return false;
        let idx = chain.length - 2;
        for (let a = c.parentNode; idx >= 0 && a && a !== self.parentNode; a = a.parentNode) {
          if (a.nodeType === 1 && matches(a, chain[idx])) idx -= 1;
        }
        return idx < 0;
      };
      const walk = (n) => n.children.forEach((c) => {
        if (c.nodeType !== 1) return;
        if (selectors.some((chain) => test(c, chain))) out.push(c);
        walk(c);
      });
      walk(this);
      return out;
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
  }

  Object.assign(doc, {
    createElement: (t) => new FakeElement(t),
    createElementNS: (ns, t) => new FakeElement(t, ns),
    createTextNode: (d) => new FakeText(d)
  });
  doc.body = doc.createElement('body');
  doc.getElementById = (id) => doc.body.querySelector(`#${id}`);
  doc.head = doc.createElement('head');
  const target = new FakeElement('window');
  return { document: doc, window: target, FakeEvent, install() { globalThis.document = doc; globalThis.Event = globalThis.Event ?? FakeEvent; }, key(el, key, init = {}) {
    const ev = new FakeEvent('keydown', { key, ...init }); el.dispatchEvent(ev); return ev;
  } };
}

/** Text im Teilbaum (rekursiv). */
export const textOf = (el) => el.textContent;
