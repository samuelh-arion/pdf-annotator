import { diffObjects } from '../utils/objectDiff';
import { migrateAnnotations } from '../utils/migrateAnnotations';

describe('Subobject rename is minor', () => {
  const subOld = { name: 'Info', version: 1, fields: [{ name: 'details', type: 'string' }], isSubobject: true };
  const subNew = { name: 'Details', version: 1, fields: [{ name: 'details', type: 'string' }], isSubobject: true };

  const parentOld = { name: 'Item', version: 1, fields: [{ name: 'info', type: 'Info' }] };
  const parentNew = { name: 'Item', version: 2, fields: [{ name: 'info', type: 'Details' }] };

  it('diffObjects classifies rename as minor', () => {
    const res = diffObjects(parentOld, parentNew);
    expect(res.classification).toBe('minor');
    expect(res.majorOps.length).toBe(0);
    const renameOp = res.minorOps.find((o) => o.type === 'renameSubobject');
    expect(renameOp).toBeDefined();
    expect(renameOp.from).toBe('Info');
    expect(renameOp.to).toBe('Details');
  });

  it('migrateAnnotations does not mark reviewed annotation for validation', () => {
    const pdfData = {
      f1: {
        annotations: [
          {
            id: 'a1',
            objectName: 'Item',
            objectVersion: 1,
            humanRevised: true,
            values: { info: { details: 'ok' } },
            pageIndex: 0,
          },
        ],
      },
    };

    const { updatedPdfData } = migrateAnnotations(pdfData, parentOld, parentNew);
    const ann = updatedPdfData.f1.annotations[0];
    expect(ann.pendingValidation).toBeFalsy();
    expect(ann.objectVersion).toBe(2);
  });
}); 