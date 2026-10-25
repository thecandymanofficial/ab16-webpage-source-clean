import { describe, it, expect } from 'vitest';
import { toCsv, formatDateForCsv, type CsvColumn } from './adminCsv';

describe('toCsv', () => {
  it('converts rows to CSV with headers', () => {
    interface Row { name: string; qty: number }
    const rows: Row[] = [
      { name: 'Hoodie', qty: 2 },
      { name: 'Cap', qty: 1 },
    ];
    const cols: CsvColumn<Row>[] = [
      { header: 'Name', accessor: (r) => r.name },
      { header: 'Qty', accessor: (r) => r.qty },
    ];
    expect(toCsv(rows, cols)).toBe('Name,Qty\nHoodie,2\nCap,1');
  });

  it('escapes commas, quotes, and newlines', () => {
    interface Row { text: string }
    const rows: Row[] = [{ text: 'hello, "world"' }];
    const cols: CsvColumn<Row>[] = [{ header: 'Text', accessor: (r) => r.text }];
    expect(toCsv(rows, cols)).toBe('Text\n"hello, ""world"""');
  });

  it('handles empty rows', () => {
    interface Row { a: string }
    const cols: CsvColumn<Row>[] = [{ header: 'A', accessor: (r) => r.a }];
    expect(toCsv([], cols)).toBe('A\n');
  });
});

describe('formatDateForCsv', () => {
  it('returns ISO date portion', () => {
    expect(formatDateForCsv('2026-10-25T14:30:00Z')).toBe('2026-10-25');
  });

  it('returns empty string for empty input', () => {
    expect(formatDateForCsv('')).toBe('');
  });
});
