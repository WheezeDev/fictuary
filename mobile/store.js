// Saves stories inside the phone (the browser's own database).
// "works" holds details and tags, "texts" holds the chapters, so the library loads fast.
const Store = (() => {
  let dbp;
  function db() {
    dbp ||= new Promise((resolve, reject) => {
      const req = indexedDB.open('fictuary', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('works', { keyPath: 'id' });
        req.result.createObjectStore('texts', { keyPath: 'id' });
        req.result.createObjectStore('settings');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }
  async function run(store, mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(store, mode);
      const out = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error); // a full phone shows up here as a "QuotaExceededError"
    });
  }
  // Saves a story's text and details together: either both are saved or neither is,
  // so a full phone never leaves half a story behind.
  async function putStory(text, work) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(['texts', 'works'], 'readwrite');
      try {
        tx.objectStore('texts').put(text);
        tx.objectStore('works').put(work);
      } catch (err) {
        tx.abort();
        return reject(err);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  return {
    putStory,
    allWorks: () => run('works', 'readonly', (s) => s.getAll()),
    getWork: (id) => run('works', 'readonly', (s) => s.get(id)),
    putWork: (w) => run('works', 'readwrite', (s) => s.put(w)),
    getText: (id) => run('texts', 'readonly', (s) => s.get(id)),
    putText: (t) => run('texts', 'readwrite', (s) => s.put(t)),
    allTexts: () => run('texts', 'readonly', (s) => s.getAll()),
    remove: async (id) => {
      await run('works', 'readwrite', (s) => s.delete(id));
      await run('texts', 'readwrite', (s) => s.delete(id));
    },
    getSetting: (key) => run('settings', 'readonly', (s) => s.get(key)),
    setSetting: (key, value) => run('settings', 'readwrite', (s) => s.put(value, key)),
  };
})();
