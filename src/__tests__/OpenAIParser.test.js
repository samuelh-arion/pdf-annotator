import { buildZodSchema } from '../utils/openaiParser';

describe('buildZodSchema', () => {
  const objects = [
    {
      name: 'Car',
      fields: [
        { name: 'brand', type: 'string' },
        { name: 'year', type: 'number' },
      ],
    },
    {
      name: 'Person',
      fields: [
        { name: 'name', type: 'string' },
        { name: 'vehicles', type: 'array_Car' },
      ],
    },
  ];

  it('creates a Zod schema for simple object', () => {
    const schema = buildZodSchema('Car', objects);
    expect(typeof schema.parse).toBe('function');
    const parsed = schema.parse({ brand: 'Tesla', year: 2024 });
    expect(parsed.brand).toBe('Tesla');
    expect(parsed.year).toBe(2024);
  });

  it('handles nested object arrays', () => {
    const schema = buildZodSchema('Person', objects);
    const data = {
      name: 'Alice',
      vehicles: [
        { brand: 'BMW', year: 2020 },
        { brand: 'Tesla', year: 2024 },
      ],
    };
    const parsed = schema.parse(data);
    expect(parsed).toEqual(data);
  });
}); 