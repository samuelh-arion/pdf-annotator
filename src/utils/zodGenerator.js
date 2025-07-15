/**
 * Supported primitive types for fields.
 * Additional types can be added here as needed.
 */
export const PRIMITIVE_TYPES = [
  'string',
  'number',
  'boolean',
  'date',
];

/**
 * Supported collection types. They follow the format `array_<primitive>`.
 */
export const ARRAY_TYPES = PRIMITIVE_TYPES.map((t) => `array_${t}`);

/**
 * Map a field type string to a Zod constructor string.
 *
 * @param {string} type - The type identifier (e.g., "string", "array_number").
 * @returns {string} - String representing the Zod constructor (e.g., "z.string()", "z.array(z.number())").
 */
export function mapTypeToZod(type, objectNames = []) {
  // Primitive type
  if (PRIMITIVE_TYPES.includes(type)) {
    return `z.${type}()`;
  }

  // Array types (could be primitive or object)
  if (type.startsWith('array_')) {
    const inner = type.replace('array_', '');

    // Primitive array
    if (PRIMITIVE_TYPES.includes(inner)) {
      return `z.array(z.${inner}())`;
    }

    // Array of objects
    if (objectNames.includes(inner)) {
      return `z.array(${inner}Schema)`;
    }

    throw new Error(`Unsupported array inner type: ${inner}`);
  }

  // Single object type
  if (objectNames.includes(type)) {
    return `${type}Schema`;
  }

  throw new Error(`Unsupported field type: ${type}`);
}

/**
 * Generates a Zod schema string for a given object definition.
 *
 * @param {string} objectName - The name of the object (e.g., "Car").
 * @param {Array<{name: string, type: string}>} fields - Array of field definitions.
 * @returns {string} - A string containing a valid Zod schema definition.
 */
export function generateZodSchemaString(objectName, fields, objectNames = []) {
  const shapeLines = fields.map(({ name, type, enumValues, description }) => {
    // Handle enum separately to include allowed values
    if (type === 'enum') {
      const valuesArray = typeof enumValues === 'string'
        ? enumValues.split(',').map((v) => v.trim()).filter(Boolean)
        : Array.isArray(enumValues)
          ? enumValues
          : [];
      const enumString = valuesArray.length ? `z.enum([${valuesArray.map((v) => `'${v}'`).join(', ')}])` : 'z.string()';
      const descWrapped = description ? `${enumString}.describe('${description.replace(/'/g, "\\'")}')` : enumString;
      return `  ${name}: ${descWrapped}`;
    }

    let typeString = mapTypeToZod(type, objectNames);
    if (description) {
      typeString = `${typeString}.describe('${description.replace(/'/g, "\\'")}')`;
    }
    return `  ${name}: ${typeString}`;
  });

  return `import { z } from 'zod';\n\nexport const ${objectName}Schema = z.object({\n${shapeLines.join(',\n')}\n});`;
}

/**
 * Generates an example JSON object with default values based on the field types.
 * This can be helpful for UI previews.
 *
 * @param {Array<{name: string, type: string}>} fields
 * @returns {Record<string, unknown>}
 */
export function generateExampleJson(fields) {
  const example = {};
  fields.forEach(({ name, type, enumValues }) => {
    switch (type) {
      case 'string':
        example[name] = '';
        break;
      case 'number':
        example[name] = 0;
        break;
      case 'boolean':
        example[name] = false;
        break;
      case 'date':
        example[name] = new Date().toISOString();
        break;
      case 'enum':
        if (enumValues && typeof enumValues === 'string') {
          example[name] = enumValues.split(',').map((v) => v.trim()).filter(Boolean)[0] || '';
        } else {
          example[name] = '';
        }
        break;
      default:
        if (type.startsWith('array_')) {
          example[name] = [];
        } else {
          // For object types default to empty object
          example[name] = {};
        }
    }
  });
  return example;
} 