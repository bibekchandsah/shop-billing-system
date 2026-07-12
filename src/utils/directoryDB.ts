const DB_NAME = 'BackupDirectoryDB';
const STORE_NAME = 'handles';
const KEY_NAME = 'backupDir';

export const saveDirectoryHandle = async (handle: FileSystemDirectoryHandle): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const putRequest = store.put(handle, KEY_NAME);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
};

export const getDirectoryHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getRequest = store.get(KEY_NAME);
      getRequest.onsuccess = () => resolve(getRequest.result || null);
      getRequest.onerror = () => reject(getRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteDirectoryHandle = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const deleteRequest = store.delete(KEY_NAME);
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
};

export const writeBlobToDirectory = async (
  directoryHandle: FileSystemDirectoryHandle,
  filename: string,
  blob: Blob
): Promise<void> => {
  const options = { mode: 'readwrite' as const };
  const dirAny = directoryHandle as any;
  if ((await dirAny.queryPermission(options)) !== 'granted') {
    if ((await dirAny.requestPermission(options)) !== 'granted') {
      throw new Error('Write permission to directory denied.');
    }
  }
  let finalFilename = filename;
  let counter = 1;
  const dotIndex = filename.lastIndexOf('.');
  const namePart = dotIndex !== -1 ? filename.slice(0, dotIndex) : filename;
  const extPart = dotIndex !== -1 ? filename.slice(dotIndex) : '';

  while (true) {
    try {
      // Check if file already exists in the directory
      await directoryHandle.getFileHandle(finalFilename, { create: false });
      // If it exists, append increment index
      finalFilename = `${namePart} (${counter})${extPart}`;
      counter++;
    } catch (err: any) {
      // NotFoundError means name is available
      if (err.name === 'NotFoundError') {
        break;
      }
      throw err;
    }
  }

  const fileHandle = await directoryHandle.getFileHandle(finalFilename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
};
