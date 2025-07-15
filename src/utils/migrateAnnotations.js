// src/utils/migrateAnnotations.js
// Utility to update annotations across all pdfData entries after an object definition changes.
// pdfData shape: { fileId: { annotations: [...] } }
// An annotation has: { objectName, objectVersion, values, humanRevised, pendingValidation, ... }

import { diffObjects } from './objectDiff';

export function migrateAnnotations(pdfData, oldObj, newObj) {
  const ops = Array.isArray(newObj.migrationOps) && newObj.migrationOps.length ? newObj.migrationOps : null;
  if (ops) {
    return migrateWithOps(pdfData, oldObj, newObj, ops);
  }
  // fallback to diff
  const { classification, minorOps } = diffObjects(oldObj, newObj);
  return migrateWithDiff(pdfData, oldObj, newObj, classification, minorOps);
}

function migrateWithOps(pdfData, oldObj, newObj, ops) {
  const summary = [];
  const updated = {};
  const createsOrType = ops.filter(o=>o.op==='create' || o.op==='typeChange');
  Object.entries(pdfData).forEach(([fid, entry])=>{
    const newEntry = { ...entry };
    newEntry.annotations = (entry.annotations||[]).map((ann)=>{
      if (ann.objectName !== oldObj.name) return ann;
      const annReport = { fileId: fid, annotationId: ann.id, page: ann.pageIndex+1, changes: [] };
      if (!ann.humanRevised) {
        annReport.action='reextract'; summary.push(annReport);
        return { ...ann, objectName:newObj.name, objectVersion:newObj.version, openaiPending:true };
      }
      let newValues = { ...ann.values };
      ops.forEach((op)=>{
        if (op.op==='rename'){
          if (op.from in newValues){newValues[op.to]=newValues[op.from]; delete newValues[op.from]; annReport.changes.push(`rename ${op.from}->${op.to}`);} 
        }
        if (op.op==='delete'){
          if (op.field in newValues){ delete newValues[op.field]; annReport.changes.push(`delete ${op.field}`);} 
        }
      });
      // any create or typeChange ops treated as major
      if (createsOrType.length){ annReport.action='pendingValidation'; summary.push(annReport); return { ...ann, objectName:newObj.name, objectVersion:newObj.version, values:newValues, pendingValidation:true }; }
      summary.push(annReport);
      const { pendingValidation, openaiPending, ...restAnn } = ann;
      return { ...restAnn, objectName:newObj.name, objectVersion:newObj.version, values:newValues};
    });
    updated[fid]=newEntry;
  });
  return { updatedPdfData:updated, summary };
}

function migrateWithDiff(pdfData, oldObj, newObj, classification, minorOps){
  const summary=[]; const updated={};
  Object.entries(pdfData).forEach(([fid,entry])=>{
    const newEntry={...entry};
    newEntry.annotations=(entry.annotations||[]).map((ann)=>{
      if (ann.objectName!==oldObj.name) return ann;
      const annReport={fileId:fid,annotationId:ann.id,page:ann.pageIndex+1,changes:[]};
      if (!ann.humanRevised){ annReport.action='reextract'; summary.push(annReport); return {...ann,objectName:newObj.name,objectVersion:newObj.version,openaiPending:true}; }
      if (classification==='minor'){
        let vals={...ann.values};
        minorOps.forEach((op)=>{if(op.type==='renameField'){if(op.from in vals){vals[op.to]=vals[op.from]; delete vals[op.from]; annReport.changes.push(`rename ${op.from}->${op.to}`);} } if(op.type==='removeField'){ if(op.field in vals){ delete vals[op.field]; annReport.changes.push(`delete ${op.field}`);} }});
        summary.push(annReport);
        const { pendingValidation, openaiPending, ...restAnn } = ann; // clear major/ai flags
        return { ...restAnn, objectName:newObj.name, objectVersion:newObj.version, values:vals};
      }
      annReport.action='pendingValidation'; summary.push(annReport); return {...ann,objectName:newObj.name,objectVersion:newObj.version,pendingValidation:true};
    });
    updated[fid]=newEntry;
  });
  return {updatedPdfData:updated,summary};
} 