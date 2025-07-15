import { migrateAnnotations } from '../utils/migrateAnnotations';

const pdfDataMock = {
  f1: {
    annotations: [
      { id: 'a1', objectName: 'Car', objectVersion: 1, humanRevised: false, values:{}, pageIndex:0 },
      { id: 'a2', objectName: 'Car', objectVersion: 1, humanRevised: true, values:{ brand:'Ford'}, pageIndex:0 },
    ],
  },
};

describe('migrateAnnotations', () => {
  const oldObj = {
    name: 'Car',
    version: 1,
    fields: [
      { name: 'brand', type: 'string' },
    ],
  };

  it('flags unreviewed for re-extract', () => {
    const newObj = { ...oldObj, version: 2, fields:[{name:'brand', type:'string'},{name:'year', type:'number'}], migrationOps:[{op:'create',field:'year',type:'number'}] };
    const { updatedPdfData, summary } = migrateAnnotations(pdfDataMock, oldObj, newObj);
    const a1 = updatedPdfData.f1.annotations.find((a)=>a.id==='a1');
    expect(a1.openaiPending).toBe(true);
    expect(summary.some((s)=>s.annotationId==='a1' && s.action==='reextract')).toBe(true);
  });

  it('marks reviewed minor rename automatically', () => {
    const newObj = { name:'Vehicle', version:2, fields:[{name:'brandName', type:'string'}], migrationOps:[{op:'rename',from:'brand',to:'brandName'}] };
    const { updatedPdfData } = migrateAnnotations(pdfDataMock, oldObj, newObj);
    const a2 = updatedPdfData.f1.annotations.find((a)=>a.id==='a2');
    expect(a2.values).toHaveProperty('brandName');
    expect(a2.values.brandName).toBe('Ford');
  });

  it('marks reviewed major change as pending', () => {
    const newObj = { ...oldObj, version:2, fields:[{name:'brand', type:'string'}, {name:'year', type:'number'}], migrationOps:[{op:'create',field:'year',type:'number'}] };
    const { updatedPdfData } = migrateAnnotations(pdfDataMock, oldObj, newObj);
    const a2 = updatedPdfData.f1.annotations.find((a)=>a.id==='a2');
    expect(a2.pendingValidation).toBe(true);
  });
}); 