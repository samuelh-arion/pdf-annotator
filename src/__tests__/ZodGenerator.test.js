import { generateZodSchemaString } from '../utils/zodGenerator';

describe('generateZodSchemaString', () => {
  it('creates a valid schema string for primitive fields', () => {
    const schema = generateZodSchemaString('Car', [
      { name: 'name', type: 'string' },
      { name: 'year', type: 'number' },
      { name: 'electric', type: 'boolean' },
    ]);

    expect(schema).toContain('name: z.string()');
    expect(schema).toContain('year: z.number()');
    expect(schema).toContain('electric: z.boolean()');
    expect(schema).toContain('export const CarSchema');
  });

  it('supports array types', () => {
    const schema = generateZodSchemaString('Garage', [
      { name: 'cars', type: 'array_string' },
    ]);

    expect(schema).toContain('cars: z.array(z.string())');
  });

  it('handles array of subobjects', () => {
    const schema = generateZodSchemaString(
      'Fleet',
      [{ name: 'vehicles', type: 'array_Car' }],
      ['Car']
    );

    expect(schema).toContain('vehicles: z.array(CarSchema)');
  });
}); 