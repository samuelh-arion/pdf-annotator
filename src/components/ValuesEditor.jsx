"use client";

import { useEffect, useState } from "react";
import { PRIMITIVE_TYPES } from "../utils/zodGenerator";

// Determine if a type is a subobject reference present in registry
const isSubobjectType = (type, registryNames) => {
  if (registryNames.includes(type)) return { base: type, isArray: false };
  if (type.startsWith("array_") && registryNames.includes(type.replace("array_", ""))) {
    return { base: type.replace("array_", ""), isArray: true };
  }
  return null;
};

// Helper to get primitive type (string,number,boolean,date) from array_ and such
const innerType = (t) => (t.startsWith("array_") ? t.replace("array_", "") : t);

export default function ValuesEditor({ objectDef, values = {}, onChange = () => {}, registry = [] }) {
  const [localValues, setLocalValues] = useState(values);

  // Keep localValues in sync when the outer values prop changes (e.g. reset)
  useEffect(() => {
    setLocalValues(values);
  }, [values]);

  if (!objectDef) {
    return <p className="text-sm text-gray-600">No object definition found.</p>;
  }

  const handleFieldChange = (fieldName, newVal) => {
    const updated = { ...localValues, [fieldName]: newVal };
    setLocalValues(updated);
    onChange(updated);
  };

  const renderInput = (field) => {
    const { name, type, enumValues } = field;
    const val = localValues[name] ?? "";
    const subInfo = isSubobjectType(type, registry.map((o) => o.name));
    if (subInfo) {
      // Single subobject
      if (!subInfo.isArray) {
        return (
          <div className="border rounded p-2">
            <ValuesEditor
              objectDef={registry.find((o) => o.name === subInfo.base)}
              values={val || {}}
              onChange={(v) => handleFieldChange(name, v)}
              registry={registry}
            />
          </div>
        );
      }

      // Array of subobjects
      const arrVal = Array.isArray(val) ? val : [];
      const handleUpdateIdx = (idx, v) => {
        const copy = [...arrVal];
        copy[idx] = v;
        handleFieldChange(name, copy);
      };
      const handleAdd = () => {
        handleFieldChange(name, [...arrVal, {}]);
      };
      const handleRemove = (idx) => {
        const copy = arrVal.filter((_, i) => i !== idx);
        handleFieldChange(name, copy);
      };
      return (
        <div className="flex flex-col gap-2">
          {arrVal.map((item, idx) => (
            <div key={idx} className="border rounded p-2 relative">
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center"
              >
                ×
              </button>
              <ValuesEditor
                objectDef={registry.find((o) => o.name === subInfo.base)}
                values={item}
                onChange={(v) => handleUpdateIdx(idx, v)}
                registry={registry}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={handleAdd}
            className="bg-blue-600 text-white px-2 py-1 rounded self-start text-xs"
          >
            + Add {subInfo.base}
          </button>
        </div>
      );
    }

    // Enum
    if (type === "enum") {
      const options = typeof enumValues === "string"
        ? enumValues.split(',').map((v) => v.trim()).filter(Boolean)
        : Array.isArray(enumValues) ? enumValues : [];
      return (
        <select
          value={val}
          onChange={(e) => handleFieldChange(name, e.target.value)}
          className="border rounded p-1 w-full"
        >
          <option value="">-- select --</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    // Primitive types
    if (PRIMITIVE_TYPES.includes(innerType(type))) {
      const baseType = innerType(type);
      const isArray = type.startsWith("array_");

      const handlePrimitive = (raw) => {
        let parsed = raw;
        if (!isArray) {
          switch (baseType) {
            case "number":
              parsed = raw === "" ? "" : Number(raw);
              break;
            case "boolean":
              parsed = !!raw;
              break;
            default:
              // string , date keep as is
              break;
          }
        } else {
          // Array: split by comma and trim
          parsed = raw.split(',').map((v) => v.trim()).filter(Boolean);
        }
        handleFieldChange(name, parsed);
      };

      // For booleans use checkbox
      if (!isArray && baseType === "boolean") {
        return (
          <input
            type="checkbox"
            checked={!!val}
            onChange={(e) => handleFieldChange(name, e.target.checked)}
            className="h-4 w-4"
          />
        );
      }

      // For dates use date input
      if (!isArray && baseType === "date") {
        return (
          <input
            type="date"
            value={val ? val.slice(0, 10) : ""}
            onChange={(e) => handlePrimitive(e.target.value)}
            className="border rounded p-1 w-full"
          />
        );
      }

      // Default text input
      return (
        <input
          type={baseType === "number" && !isArray ? "number" : "text"}
          value={isArray ? (Array.isArray(val) ? val.join(', ') : '') : val}
          onChange={(e) => handlePrimitive(e.target.value)}
          className="border rounded p-1 w-full"
        />
      );
    }

    // Subobject or array of subobjects: fallback to JSON textarea
    return (
      <textarea
        value={val ? JSON.stringify(val, null, 2) : "{}"}
        onChange={(e) => {
          try {
            const obj = JSON.parse(e.target.value || '{}');
            handleFieldChange(name, obj);
          } catch {
            // ignore parse error for now
          }
        }}
        className="border rounded p-1 w-full text-xs font-mono h-24"
      />
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {objectDef.fields.map((field) => (
        <label key={field.name} className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            {field.name}
            {field.description ? (
              <span className="text-gray-500"> – {field.description}</span>
            ) : null}
          </span>
          {renderInput(field)}
        </label>
      ))}
    </div>
  );
} 