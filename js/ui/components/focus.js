// Fokus-Helfer ohne querySelector (läuft auch im Fake-DOM).

const FOCUSABLE = new Set(['button', 'a', 'input', 'select', 'textarea']);

export function isFocusable(el) {
  if (el.nodeType !== 1) return false;
  if (el.getAttribute('aria-disabled') === 'true' && el.getAttribute('data-skip-focus') === 'true') return false;
  if (el.hasAttribute('disabled')) return false;
  if (el.getAttribute('tabindex') === '-1') return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'a') return el.hasAttribute('href');
  return FOCUSABLE.has(tag) || el.hasAttribute('tabindex');
}

/** Alle fokussierbaren Nachfahren in Dokumentreihenfolge. */
export function focusableWithin(root) {
  const out = [];
  const walk = (node) => node.children.forEach((c) => {
    if (c.nodeType !== 1) return;
    if (isFocusable(c)) out.push(c);
    walk(c);
  });
  walk(root);
  return out;
}
