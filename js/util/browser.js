// Browser-Adapter (localStorage, Datei-Download/-Upload). Bewusst außerhalb von js/core.

/** Speicher-Adapter-Interface: { get(key), set(key, value), remove(key) } (synchron, Strings). */
export function createLocalStorageAdapter(storage = globalThis.localStorage) {
  return {
    get: (key) => storage.getItem(key),
    set: (key, value) => storage.setItem(key, value),
    remove: (key) => storage.removeItem(key)
  };
}

/** Löst einen Datei-Download aus. */
export function downloadText(filename, text, mime = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Öffnet den Dateidialog und liefert den Textinhalt (oder null bei Abbruch). */
export function pickTextFile(accept = '.json,application/json') {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      resolve(file ? await file.text() : null);
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
