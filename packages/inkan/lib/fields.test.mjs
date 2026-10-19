import { describe, expect, it } from 'vitest';
import { combineFields, fieldLabel, fieldsSchema, formatValue, mergeFields, parseValue, projectFieldsSchema, readFields } from './fields.mjs';

const risk = { type: 'enum', values: ['low', 'medium', 'high'] };

describe('fieldsSchema', () => {
  it('accepts definitions and defaults the type to text', () => {
    expect(fieldsSchema.parse({ vendor: {}, risk }).vendor.type).toBe('text');
  });

  it('rejects keys records already carry in decisions.json', () => {
    expect(fieldsSchema.safeParse({ url: { type: 'url' } }).success).toBe(false);
  });

  it('rejects reserved and malformed names', () => {
    const issues = fieldsSchema.safeParse({ status: {}, '1x': {} }).error?.issues.map((i) => i.message);
    expect(issues).toEqual(['"status" is a built-in key and cannot be a field', 'field names start with a letter and use letters, digits, - and _']);
  });

  it('needs values for enums and keeps options to their types', () => {
    const r = fieldsSchema.safeParse({ a: { type: 'enum' }, b: { type: 'text', values: ['x'] }, c: { type: 'date', unit: 'd' } });
    expect(r.error?.issues.map((i) => i.path.join('.'))).toEqual(['a.values', 'b.values', 'c.unit']);
  });

  it('checks the default against the type', () => {
    expect(fieldsSchema.safeParse({ risk: { ...risk, default: 'huge' } }).success).toBe(false);
    expect(fieldsSchema.safeParse({ risk: { ...risk, default: 'low' } }).success).toBe(true);
  });

  it('lets a project turn a field off', () => {
    expect(projectFieldsSchema.parse({ risk: false })).toEqual({ risk: false });
  });
});

describe('parseValue', () => {
  it.each([
    [{ type: 'number' }, '12.5', 12.5],
    [{ type: 'boolean' }, 'true', true],
    [{ type: 'date' }, new Date('2026-03-01'), '2026-03-01'],
    [risk, 'High', 'high'],
    [{ type: 'list' }, 'one', ['one']],
    [{ type: 'list', values: ['a', 'b'] }, ['b', 'a', 'b'], ['b', 'a']],
    [{ type: 'url' }, 'https://x.dev/a', 'https://x.dev/a'],
    [{ type: 'text' }, 42, '42'],
    [{ type: 'text' }, 'two\nlines', 'two lines'],
  ])('%j reads %j', (def, raw, value) => {
    expect(parseValue(def, raw)).toEqual({ value });
  });

  it.each([
    [{ type: 'number' }, 'lots'],
    [{ type: 'boolean' }, 'yes'],
    [{ type: 'date' }, '03/01/2026'],
    [{ type: 'date' }, '2026-02-30'],
    [risk, 'extreme'],
    [{ type: 'list', values: ['a'] }, ['c']],
    [{ type: 'url' }, 'javascript:alert(1)'],
    [{ type: 'url' }, '/\\evil.example'],
    [{ type: 'text' }, { a: 1 }],
  ])('%j rejects %j', (def, raw) => {
    expect(parseValue(def, raw)).toHaveProperty('error');
  });
});

describe('readFields', () => {
  const fields = mergeFields({ risk: { ...risk, required: true }, cost: { type: 'number' } });

  it('returns declared values and ignores other keys', () => {
    expect(readFields(fields, { risk: 'low', cost: 3, other: 'x' })).toEqual({ values: { risk: 'low', cost: 3 }, issues: [] });
  });

  it('treats blank strings as missing', () => {
    expect(readFields(fields, { risk: '  ' }).issues).toEqual([{ field: 'risk', message: 'risk is required' }]);
  });

  it('reports missing required and invalid values', () => {
    expect(readFields(fields, { cost: 'x' }).issues).toEqual([
      { field: 'risk', message: 'risk is required' },
      { field: 'cost', message: 'cost: "x" is not a number' },
    ]);
  });
});

describe('mergeFields', () => {
  it('adds, replaces and removes project fields after the site ones', () => {
    const merged = mergeFields({ risk, cost: { type: 'number' } }, { cost: false, pii: { type: 'boolean', label: 'PII' }, risk: { ...risk, label: 'Risiko' } });
    expect(merged.map((f) => [f.name, f.label])).toEqual([['risk', 'Risiko'], ['pii', 'PII']]);
  });
});

describe('combineFields', () => {
  it('merges values per name and rejects conflicting types', () => {
    const a = mergeFields({ risk });
    const b = mergeFields({ risk: { type: 'enum', values: ['high', 'critical'] } });
    expect(combineFields([a, b])[0].values).toEqual(['low', 'medium', 'high', 'critical']);
    expect(() => combineFields([a, mergeFields({ risk: { type: 'number' } })])).toThrow(/enum field in one project and a number/);
  });

  it('rejects conflicting units and drops the filter when any project does', () => {
    expect(() => combineFields([mergeFields({ cost: { type: 'number', unit: 'k€' } }), mergeFields({ cost: { type: 'number', unit: 'days' } })])).toThrow(/k€ in one project and in days/);
    const combined = combineFields([mergeFields({ cost: { type: 'number' } }), mergeFields({ cost: { type: 'number', filter: false } })]);
    expect(combined[0].filter).toBe(false);
  });
});

it('formats values and labels', () => {
  expect(fieldLabel('riskLevel')).toBe('Risk level');
  expect(fieldLabel('data_class')).toBe('Data class');
  expect(formatValue({ type: 'number', unit: 'k€' }, 1200)).toBe('1,200 k€');
  expect(formatValue({ type: 'boolean' }, false)).toBe('No');
  expect(formatValue({ type: 'list' }, ['a', 'b'])).toBe('a, b');
});
