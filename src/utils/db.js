import { openDB } from 'idb';

const DB_NAME = 'annotator';
const DB_VERSION = 2; // bump version to add new objectStore
const IMAGE_STORE = 'images';
const PDF_STORE = 'pdfs';

let dbPromise = null;

function isIDBAvailable() {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

export async function getDB() {
  if (!isIDBAvailable()) return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(IMAGE_STORE)) {
          db.createObjectStore(IMAGE_STORE);
        }
        if (!db.objectStoreNames.contains(PDF_STORE)) {
          db.createObjectStore(PDF_STORE);
        }
      },
    });
  }
  return dbPromise;
}

export async function saveImages(fileId, images) {
  const db = await getDB();
  if (!db) return;
  const tx = db.transaction(IMAGE_STORE, 'readwrite');
  images.forEach((img, index) => {
    tx.store.put(img, `${fileId}-${index}`);
  });
  await tx.done;
}

export async function loadImages(fileId) {
  const db = await getDB();
  if (!db) return [];
  const images = [];
  for (let i = 0; ; i += 1) {
    const img = await db.get(IMAGE_STORE, `${fileId}-${i}`);
    if (!img) break;
    images.push(img);
  }
  return images;
}

// Delete all images associated with a given fileId
export async function deleteImages(fileId) {
  const db = await getDB();
  if (!db) return;
  const tx = db.transaction(IMAGE_STORE, 'readwrite');
  for (let i = 0; ; i += 1) {
    const key = `${fileId}-${i}`;
    const has = await tx.store.get(key);
    if (!has) break;
    tx.store.delete(key);
  }
  await tx.done;
}

export async function savePdf(fileId, blob) {
  const db = await getDB();
  if (!db) return;
  const tx = db.transaction(PDF_STORE, 'readwrite');
  tx.store.put(blob, fileId);
  await tx.done;
}

export async function loadPdf(fileId) {
  const db = await getDB();
  if (!db) return null;
  return db.get(PDF_STORE, fileId);
}

export async function deletePdf(fileId) {
  const db = await getDB();
  if (!db) return;
  const tx = db.transaction(PDF_STORE, 'readwrite');
  await tx.store.delete(fileId);
  await tx.done;
} 