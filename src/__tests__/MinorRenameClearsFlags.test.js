import { migrateAnnotations } from '../utils/migrateAnnotations';

describe('Minor rename migration clears validation flags', () => {
  const oldObj = {
    name: 'Item',
    version: 1,
    fields: [{ name: 'oldName', type: 'string' }],
  };

  const newObj = {
    ...oldObj,
    version: 2,
    fields: [{ name: 'newName', type: 'string' }],
  };

  it('clears pendingValidation for reviewed annotation', () => {
    const pdfData = {
      f1: {
        annotations: [
          {
            id: 'a1',
            objectName: 'Item',
            objectVersion: 1,
            humanRevised: true,
            pendingValidation: true,
            values: { oldName: 'foo' },
            pageIndex: 0,
          },
        ],
      },
    };
    const { updatedPdfData } = migrateAnnotations(pdfData, oldObj, newObj);
    const ann = updatedPdfData.f1.annotations[0];
    expect(ann.pendingValidation).toBeFalsy();
    expect(ann.values.newName).toBe('foo');
  });

  // Unreviewed annotations are still re-extracted even for minor changes; no additional assertion needed.
}); 