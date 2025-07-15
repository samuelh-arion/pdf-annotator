import { z } from 'zod';
import { PRIMITIVE_TYPES } from './zodGenerator';

// Helper: resolve OpenAI configuration (model, temperature, feed image)
function getOpenAISettings() {
  // Defaults – must match UI defaults in OpenAIKeyDialog
  const DEFAULT_MODEL = 'gpt-4.1-mini';
  const DEFAULT_TEMPERATURE = 0;

  const model =
    process.env.NEXT_PUBLIC_OPENAI_MODEL ||
    process.env.OPENAI_MODEL ||
    (typeof window !== 'undefined' && window.OPENAI_MODEL) ||
    DEFAULT_MODEL;

  let temperatureRaw =
    process.env.NEXT_PUBLIC_OPENAI_TEMPERATURE ||
    (typeof window !== 'undefined' ? window.OPENAI_TEMPERATURE : undefined);
  let temperature = Number(temperatureRaw);
  if (Number.isNaN(temperature)) temperature = DEFAULT_TEMPERATURE;
  // Clamp to valid range 0–2 as per OpenAI docs
  temperature = Math.max(0, Math.min(2, temperature));

  const feedImage =
    (typeof window !== 'undefined' && Boolean(window.OPENAI_FEED_IMAGE)) || false;

  return { model, temperature, feedImage };
}

/**
 * Recursively build a Zod schema for a given object name based on the registry.
 *
 * @param {string} objectName - Name of the object to build the schema for.
 * @param {Array<{name: string, fields: Array<{name: string, type: string}>}>} objects - Full registry of objects.
 * @param {Record<string, import('zod').ZodTypeAny>} cache - Internal cache to avoid infinite recursion.
 * @returns {import('zod').ZodObject} Zod schema for the object.
 */
export function buildZodSchema(objectName, objects, cache = {}) {
  if (cache[objectName]) return cache[objectName];

  const definition = objects.find((o) => o.name === objectName);
  if (!definition) {
    throw new Error(`Object definition for "${objectName}" not found.`);
  }

  const shape = {};

  // Helper to map field type string → Zod type
  const mapType = (type) => {
    // Primitive (string, number, ...)
    if (PRIMITIVE_TYPES.includes(type)) {
      // Special-case date → z.string() (OpenAI rarely outputs JS Date ISO automatically)
      if (type === 'date') return z.string();
      return z[type]();
    }

    // Array types e.g. array_string, array_Car
    if (type.startsWith('array_')) {
      const inner = type.replace('array_', '');
      return z.array(mapType(inner));
    }

    // Sub-object type
    return buildZodSchema(type, objects, cache);
  };

  definition.fields.forEach((field) => {
    const { name, type, enumValues, description } = field;

    let zodType;

    if (type === 'enum') {
      const valuesArray = typeof enumValues === 'string'
        ? enumValues.split(',').map((v) => v.trim()).filter(Boolean)
        : Array.isArray(enumValues)
          ? enumValues
          : [];
      zodType = valuesArray.length ? z.enum(valuesArray) : z.string();
    } else {
      zodType = mapType(type);
    }

    if (description) {
      zodType = zodType.describe(description);
    }

    shape[name] = zodType;
  });

  const schema = z.object(shape);
  cache[objectName] = schema;
  return schema;
}

/**
 * Parse free-form text into a structured object using OpenAI structured output + Zod.
 *
 * @param {string} text - The input text to parse.
 * @param {string} objectName - Name of the object to parse into (must exist in registry).
 * @param {Array} objects - Registry of object definitions.
 * @returns {Promise<unknown|null>} Parsed data or null if parsing failed / API unavailable.
 */
export async function parseTextToObject(text, objectName, objects, imageUrl) {
  if (!text?.trim()) return null;

  try {
    // Dynamically import to minimise bundle size.
    const [{ default: OpenAI }, { zodTextFormat }] = await Promise.all([
      import('openai'),
      import('openai/helpers/zod'),
    ]);

    // Attempt to obtain API key from env (for both browser & server contexts)
    const apiKey =
      process.env.NEXT_PUBLIC_OPENAI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      (typeof window !== 'undefined' ? window.OPENAI_API_KEY : undefined);

    if (!apiKey) {
      console.warn('OpenAI API key not configured – skipping parsing.');
      return null;
    }

    // Resolve model / temp / image settings
    const { model, temperature, feedImage } = getOpenAISettings();

    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

    const schema = buildZodSchema(objectName, objects);

    // Obtain custom system prompt for this object, if provided
    const objectDef = objects.find((o) => o.name === objectName);
    const systemPrompt = objectDef?.systemPrompt?.trim() || `Extract the ${objectName} information.`;

    // The name must match ^[a-zA-Z0-9_-]+$ according to API docs
    const safeName = objectName
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');

    // Build user message following new multimodal schema
    let userMessage;
    if (feedImage && imageUrl) {
      userMessage = {
        role: 'user',
        content: [
          { type: 'input_text', text },
          { type: 'input_image', image_url: imageUrl },
        ],
      };
    } else {
      userMessage = { role: 'user', content: text };
    }

    const response = await openai.responses.parse({
      model,
      temperature,
      input: [
        { role: 'system', content: systemPrompt },
        userMessage,
      ],
      text: {
        format: zodTextFormat(schema, safeName),
      },
    });

    return response?.output_parsed ?? null;
  } catch (err) {
    console.error('Failed to parse text with OpenAI:', err);
    return null;
  }
} 