import { fetchAllData, storeAllData } from '../utils/importExportAll';

// Simple in-memory mock for localStorage
function createMockStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

describe('import/export all utils', () => {
  it('stores and fetches combined data correctly', async () => {
    const mockStorage = createMockStorage();
    const sampleData = {
      objectRegistry: [
        { name: 'Test', fields: [{ name: 'a', type: 'string' }], version: 1 },
      ],
      pdfData: {
        file1: {
          name: 'dummy.pdf',
          annotations: [
            {
              id: 'ann1',
              objectName: 'Test',
              page: 0,
              rect: { x: 0, y: 0, width: 1, height: 1 },
              values: { a: 'foo' },
              reviewed: false,
              pending: false,
              objectVersion: 1,
            },
          ],
        },
      },
    };

    await storeAllData(sampleData, mockStorage);
    const fetched = await fetchAllData(mockStorage);
    // fetched may contain images key (empty) – ignore it
    expect(fetched.objectRegistry).toEqual(sampleData.objectRegistry);
    expect(fetched.pdfData).toEqual(sampleData.pdfData);
  });
}); 