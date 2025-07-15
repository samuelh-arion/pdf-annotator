"use client";

import { useState, useEffect } from 'react';
import {
  PRIMITIVE_TYPES,
  ARRAY_TYPES,
} from '../utils/zodGenerator';

export default function ObjectBuilder({
  subobjectNames = [],
  onSubobjectToggle = () => {},
  onSave = () => {},
  onCancel = () => {},
  initialData = null,
}) {
  // If editing, seed state from initialData
  const [objectName, setObjectName] = useState(initialData?.name || '');
  const [fields, setFields] = useState(initialData?.fields || []);
  const [systemPrompt, setSystemPrompt] = useState(initialData?.systemPrompt || '');
  const [isSubobject, setIsSubobject] = useState(initialData?.isSubobject || false);

  const initialFields = initialData ? initialData.fields : [];

  // Keep state in sync if initialData changes (e.g. switching edits)
  useEffect(() => {
    if (initialData) {
      setObjectName(initialData.name || '');
      setFields(initialData.fields || []);
      setIsSubobject(initialData.isSubobject || false);
      setSystemPrompt(initialData.systemPrompt || '');
    }
  }, [initialData]);

  const addField = () => {
    setFields((prev) => [
      ...prev,
      {
        name: '',
        type: 'string',
        description: '', // new
        enumValues: '', // new – comma-separated values when type === 'enum'
      },
    ]);
  };

  const updateField = (index, key, value) => {
    setFields((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
  };

  const removeField = (index) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  // Update parent about subobject status
  const handleSubobjectChange = (checked) => {
    setIsSubobject(checked);
    if (objectName) {
      onSubobjectToggle(objectName, checked);
    }
  };

  // Build dynamic type list: primitives + arrays + subobjects + array of subobjects
  const subobjectTypes = subobjectNames.flatMap((n) => [n, `array_${n}`]);
  // Include "enum" as an additional option
  const TYPE_OPTIONS = [...PRIMITIVE_TYPES, ...ARRAY_TYPES, 'enum', ...subobjectTypes];

  const handleSave = () => {
    if (!objectName.trim()) {
      // eslint-disable-next-line no-alert
      alert('Object name is required');
      return;
    }
    if (!fields.length) {
      // eslint-disable-next-line no-alert
      alert('Please add at least one field');
      return;
    }
    const migrationOps = [];
    if (initialData) {
      const oldMap = new Map(initialFields.map((f)=>[f.name,f]));
      const newMap = new Map(fields.map((f)=>[f.name,f]));

      const removed = [...oldMap.keys()].filter((n)=>!newMap.has(n));
      const added = [...newMap.keys()].filter((n)=>!oldMap.has(n));

      // Detect renames: pair removed and added of same type one-to-one
      const paired = new Set();
      removed.forEach((oldName)=>{
        const oldField = oldMap.get(oldName);
        const match = added.find((newName)=>{
          if (paired.has(newName)) return false;
          const newField = newMap.get(newName);
          return newField.type === oldField.type;
        });
        if (match) {
          migrationOps.push({ op:'rename', from:oldName, to:match });
          paired.add(match);
        }
      });

      // Remaining removed = delete
      removed.forEach((oldName)=>{
        if (!migrationOps.find((o)=>o.op==='rename' && o.from===oldName)) {
          migrationOps.push({ op:'delete', field: oldName });
        }
      });

      // Remaining added not renamed = create
      added.forEach((newName)=>{
        if (!paired.has(newName)) {
          const newField = newMap.get(newName);
          migrationOps.push({ op:'create', field:newName, type:newField.type });
        }
      });

      // Type changes
      oldMap.forEach((oldField, name)=>{
        if (newMap.has(name)) {
          const newField = newMap.get(name);
          if (newField.type !== oldField.type) {
            migrationOps.push({ op:'typeChange', field:name, from:oldField.type, to:newField.type });
          }
        }
      });
    }

    const baseVersion = initialData?.version || 0;
    const nextVersion = baseVersion + 1 || 1;
    onSave({ name: objectName.trim(), fields, isSubobject, systemPrompt: systemPrompt.trim(), version: nextVersion, migrationOps });
  };

  return (
    <div className="flex flex-col gap-6 w-full border-t pt-6 mt-6">
      <h2 className="text-xl font-semibold">{initialData ? 'Edit Object' : 'Create Object'}</h2>

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-medium">Object Name</span>
          <input
            type="text"
            value={objectName}
            onChange={(e) => setObjectName(e.target.value)}
            placeholder="e.g. Car"
            className="border rounded p-2"
          />
        </label>

        {/* System Prompt */}
        <label className="flex flex-col gap-1">
          <span className="font-medium">System Prompt (optional)</span>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Provide a custom system prompt for extracting this object. Leave blank to use the default."
            rows={3}
            className="border rounded p-2"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="font-medium">Fields</span>
          {fields.map((field, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                type="text"
                value={field.name}
                onChange={(e) => updateField(idx, 'name', e.target.value)}
                placeholder="field name"
                className="border rounded p-2 flex-1"
              />
              <select
                value={field.type}
                onChange={(e) => updateField(idx, 'type', e.target.value)}
                className="border rounded p-2"
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {/* Enum values (only visible when type === 'enum') */}
              {field.type === 'enum' && (
                <input
                  type="text"
                  value={field.enumValues}
                  onChange={(e) => updateField(idx, 'enumValues', e.target.value)}
                  placeholder="values e.g. red,green,blue"
                  className="border rounded p-2 flex-1"
                />
              )}

              {/* Field description (always last) */}
              <input
                type="text"
                value={field.description}
                onChange={(e) => updateField(idx, 'description', e.target.value)}
                placeholder="description"
                className="border rounded p-2 flex-1"
              />

              <button
                type="button"
                onClick={() => removeField(idx)}
                className="text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addField}
            className="self-start bg-blue-600 text-white px-4 py-2 rounded"
          >
            + Add Field
          </button>
        </div>
      </div>

      {/* Mark as subobject */}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isSubobject}
          onChange={(e) => handleSubobjectChange(e.target.checked)}
        />
        Expose as subobject
      </label>

      {/* Action buttons */}
      <div className="flex gap-4">
        <button
          type="button"
          onClick={handleSave}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-gray-400 text-white px-4 py-2 rounded"
        >
          Cancel
        </button>
      </div>
    </div>
  );
} 