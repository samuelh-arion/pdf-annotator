import { migrateAnnotations } from '../utils/migrateAnnotations';

const basePdfData = {
  f1: {
    annotations: [
      { id: 'r1', objectName: 'Item', objectVersion: 1, humanRevised: true, values:{ name:'Book', price:20 }, pageIndex:0 },
      { id: 'u1', objectName: 'Item', objectVersion: 1, humanRevised: false, values:{ name:'Pen', price:2 }, pageIndex:0 },
    ],
  },
};

describe('Comprehensive object schema migration', () => {
  const oldObj = {
    name: 'Item',
    version: 1,
    fields: [
      { name: 'name', type: 'string' },
      { name: 'price', type: 'number' },
    ],
  };

  /** Helper to deep clone pdfData for each test */
  const clonePdf = () => JSON.parse(JSON.stringify(basePdfData));

  describe('migrationOps based', () => {
    it('minor rename – reviewed annotation updated automatically', () => {
      const newObj = {
        ...oldObj,
        version: 2,
        name: 'Product',
        fields: [
          { name: 'title', type: 'string' },
          { name: 'price', type: 'number' },
        ],
        migrationOps: [{ op: 'rename', from: 'name', to: 'title' }],
      };
      const { updatedPdfData, summary } = migrateAnnotations(clonePdf(), oldObj, newObj);
      const reviewed = updatedPdfData.f1.annotations.find((a) => a.id === 'r1');
      expect(reviewed.values).toHaveProperty('title', 'Book');
      expect(reviewed.pendingValidation).toBeFalsy();
      // Summary should include changes but no pendingValidation action
      expect(summary.some((s) => s.annotationId === 'r1' && s.action === undefined)).toBe(true);
    });

    it('minor rename – unreviewed annotation set for re-extraction', () => {
      const newObj = {
        ...oldObj,
        version: 2,
        fields: [
          { name: 'title', type: 'string' },
          { name: 'price', type: 'number' },
        ],
        migrationOps: [{ op: 'rename', from: 'name', to: 'title' }],
      };
      const { updatedPdfData, summary } = migrateAnnotations(clonePdf(), oldObj, newObj);
      const unrev = updatedPdfData.f1.annotations.find((a) => a.id === 'u1');
      expect(unrev.openaiPending).toBe(true);
      expect(summary.some((s) => s.annotationId === 'u1' && s.action === 'reextract')).toBe(true);
    });

    it('major create field – reviewed annotation flagged for validation', () => {
      const newObj = {
        ...oldObj,
        version: 2,
        fields: [
          { name: 'name', type: 'string' },
          { name: 'price', type: 'number' },
          { name: 'category', type: 'string' },
        ],
        migrationOps: [{ op: 'create', field: 'category', type: 'string' }],
      };
      const { updatedPdfData } = migrateAnnotations(clonePdf(), oldObj, newObj);
      const reviewed = updatedPdfData.f1.annotations.find((a) => a.id === 'r1');
      expect(reviewed.pendingValidation).toBe(true);
    });

    it('major create field – unreviewed annotation set for re-extraction', () => {
      const newObj = {
        ...oldObj,
        version: 2,
        fields: [
          { name: 'name', type: 'string' },
          { name: 'price', type: 'number' },
          { name: 'category', type: 'string' },
        ],
        migrationOps: [{ op: 'create', field: 'category', type: 'string' }],
      };
      const { updatedPdfData, summary } = migrateAnnotations(clonePdf(), oldObj, newObj);
      const unrev = updatedPdfData.f1.annotations.find((a) => a.id === 'u1');
      expect(unrev.openaiPending).toBe(true);
      expect(summary.some((s) => s.annotationId === 'u1' && s.action === 'reextract')).toBe(true);
    });
  });

  describe('diff-based migrations (no explicit ops array)', () => {
    it('minor rename detected by diff – reviewed annotation updated automatically', () => {
      const newObj = {
        ...oldObj,
        version: 2,
        name: 'Item',
        fields: [
          { name: 'title', type: 'string' },
          { name: 'price', type: 'number' },
        ],
      };
      const { updatedPdfData } = migrateAnnotations(clonePdf(), oldObj, newObj);
      const reviewed = updatedPdfData.f1.annotations.find((a) => a.id === 'r1');
      expect(reviewed.values).toHaveProperty('title', 'Book');
      expect(reviewed.pendingValidation).toBeFalsy();
    });

    it('major add field detected by diff – reviewed annotation flagged for validation', () => {
      const newObj = {
        ...oldObj,
        version: 2,
        fields: [
          { name: 'name', type: 'string' },
          { name: 'price', type: 'number' },
          { name: 'category', type: 'string' },
        ],
      };
      const { updatedPdfData } = migrateAnnotations(clonePdf(), oldObj, newObj);
      const reviewed = updatedPdfData.f1.annotations.find((a) => a.id === 'r1');
      expect(reviewed.pendingValidation).toBe(true);
    });
  });

  describe('subobject change propagation', () => {
    it('editing a subobject causes parent annotations to require validation', () => {
      // Define subobject and parent
      const subOld = { name:'Info', version:1, fields:[{name:'details', type:'string'}], isSubobject:true };
      const subNew = { ...subOld, version:2, fields:[{name:'details', type:'string'},{name:'extra', type:'number'}], migrationOps:[{op:'create', field:'extra', type:'number'}], isSubobject:true };
      const parentOld = { name:'Item', version:1, fields:[{name:'info', type:'Info'}] };
      const parentNew = { ...parentOld, version:2, migrationOps:[{op:'typeChange', field:'__subobjectUpdate', from:'none', to:'none'}] };

      const pdf = {
        f1:{ annotations:[ {id:'p1', objectName:'Item', objectVersion:1, humanRevised:true, values:{ info:{ details:'ok'}}, pageIndex:0 } ] }
      };

      // First migrate subobject (would not touch parent annotations)
      const subRes = migrateAnnotations(pdf, subOld, subNew);
      // Then propagate to parent
      const parentRes = migrateAnnotations(subRes.updatedPdfData, parentOld, parentNew);
      const ann = parentRes.updatedPdfData.f1.annotations[0];
      expect(ann.pendingValidation).toBe(true);
    });
  });
}); 