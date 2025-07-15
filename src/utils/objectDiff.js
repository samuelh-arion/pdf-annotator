// src/utils/objectDiff.js
// Utility to compare two object definitions and classify the difference as minor or major.
// Minor operations: renameField, removeField, renameObject (name change), description change, systemPrompt change.
// Major operations: addField, typeChange, structureChange (any array vs non-array change)
// Returns { classification: 'minor' | 'major', minorOps: [...], majorOps: [...] }

export function diffObjects(oldObj, newObj) {
  if (!oldObj) {
    return {
      classification: 'major',
      minorOps: [],
      majorOps: [{ type: 'newObject' }],
    };
  }

  const minorOps = [];
  const majorOps = [];

  // Name change
  if (oldObj.name !== newObj.name) {
    minorOps.push({ type: 'renameObject', from: oldObj.name, to: newObj.name });
  }

  // Description / prompt change are always minor
  if (oldObj.systemPrompt !== newObj.systemPrompt) {
    minorOps.push({ type: 'systemPromptChange' });
  }

  // Build field maps
  const oldFields = new Map();
  oldObj.fields.forEach((f) => oldFields.set(f.name, f));
  const newFields = new Map();
  newObj.fields.forEach((f) => newFields.set(f.name, f));

  // Detect removed fields (could be rename or removal)
  const removed = [];
  oldFields.forEach((f, name) => {
    if (!newFields.has(name)) removed.push(f);
  });

  const added = [];
  newFields.forEach((f, name) => {
    if (!oldFields.has(name)) added.push(f);
  });

  // Attempt to detect simple renames: same type, one removed ↔ one added
  const renamePairs = [];
  if (removed.length === 1 && added.length === 1) {
    const r = removed[0];
    const a = added[0];
    if (r.type === a.type) {
      renamePairs.push({ from: r.name, to: a.name });
    }
  }

  // Classify operations
  removed.forEach((f) => {
    // Skip if it was recognised as rename
    const renamed = renamePairs.find((p) => p.from === f.name);
    if (!renamed) minorOps.push({ type: 'removeField', field: f.name });
  });

  renamePairs.forEach((p) => minorOps.push({ type: 'renameField', from: p.from, to: p.to }));

  // Added fields
  added.forEach((f) => {
    // Skip rename target already handled
    const renamed = renamePairs.find((p) => p.to === f.name);
    if (!renamed) majorOps.push({ type: 'addField', field: f.name });
  });

  // Type changes
  oldFields.forEach((f, name) => {
    if (newFields.has(name)) {
      const nf = newFields.get(name);
      if (nf.type !== f.type) {
        // Determine whether this difference is purely a rename of an object reference (minor)
        const PRIMITIVE_TYPES = ['string', 'number', 'boolean', 'date', 'enum'];
        const isArray = (t) => t.startsWith('array_');
        const baseType = (t) => (isArray(t) ? t.replace('array_', '') : t);

        const oldIsArray = isArray(f.type);
        const newIsArray = isArray(nf.type);
        const oldBase = baseType(f.type);
        const newBase = baseType(nf.type);
        const oldIsPrimitive = PRIMITIVE_TYPES.includes(oldBase);
        const newIsPrimitive = PRIMITIVE_TYPES.includes(newBase);

        // Both sides remain within the same collection category (array vs single) and are non-primitive → treat as rename of referenced object (minor)
        if (oldIsArray === newIsArray && !oldIsPrimitive && !newIsPrimitive) {
          minorOps.push({ type: 'renameSubobject', field: name, from: f.type, to: nf.type });
        } else {
          majorOps.push({ type: 'typeChange', field: name, from: f.type, to: nf.type });
        }
      }
    }
  });

  const classification = majorOps.length ? 'major' : 'minor';
  return { classification, minorOps, majorOps };
}

export function isMinorChange(result){
  return result.classification==='minor';
} 