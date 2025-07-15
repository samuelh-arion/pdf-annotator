import { diffObjects } from '../utils/objectDiff';
import { migrateAnnotations } from '../utils/migrateAnnotations';

describe('Single field rename remains minor', () => {
  const oldObj = {
    name: 'Concentration',
    version: 1,
    fields: [
      { name: 'unit', type: 'string' },
      { name: 'value', type: 'number' },
      { name: 'element_name', type: 'string' },
    ],
  };

  const newObj = {
    ...oldObj,
    version: 2,
    fields: [
      { name: 'unit', type: 'string' },
      { name: 'value', type: 'number' },
      { name: 'element', type: 'string' },
    ],
  };

  it('diffObjects classifies as minor renameField', () => {
    const res = diffObjects(oldObj, newObj);
    expect(res.classification).toBe('minor');
    const op = res.minorOps.find((o) => o.type === 'renameField');
    expect(op).toBeDefined();
    expect(op.from).toBe('element_name');
    expect(op.to).toBe('element');
  });

  it('migrateAnnotations updates annotation value property', () => {
    const pdfData = {
      f1: {
        annotations: [
          {
            id: 'c1',
            objectName: 'Concentration',
            objectVersion: 1,
            humanRevised: true,
            values: { unit: '%', value: 0.42, element_name: 'Fe' },
            pageIndex: 0,
          },
        ],
      },
    };

    const { updatedPdfData } = migrateAnnotations(pdfData, oldObj, newObj);
    const ann = updatedPdfData.f1.annotations[0];
    expect(ann.pendingValidation).toBeFalsy();
    expect(ann.values.element).toBe('Fe');
    expect(ann.values.element_name).toBeUndefined();
  });
}); 