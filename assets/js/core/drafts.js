/**
 * The test being written on the Add a test page, kept in this browser so it
 * survives a trip to the quiz and back. IndexedDB, because it holds the
 * test's figures too.
 *
 * A draft is { text, files: [{ path, blob }], course, code, title }.
 */

const DATABASE = 'exam-drill';
const STORE = 'drafts';
const KEY = 'current';

function withStore(mode, run) {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(DATABASE, 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore(STORE);
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      const transaction = db.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      transaction.oncomplete = () => {
        db.close();
        resolve(request.result);
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    };
  });
}

export function saveDraft(draft) {
  return withStore('readwrite', (store) => store.put(draft, KEY));
}

/** @returns {Promise<object|undefined>} */
export function loadDraft() {
  return withStore('readonly', (store) => store.get(KEY));
}
