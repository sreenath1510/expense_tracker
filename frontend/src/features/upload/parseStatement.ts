// =============================================================================
// STATEMENT PARSER  —  client-side CSV + PDF parse (temporary)
// =============================================================================
// While the backend doesn't exist, we parse statements in the browser so the
// mapping table is fully demonstrable. `parseStatementFile` is the single entry
// point: it sniffs the file type and routes CSVs through the inline parser
// below, or PDFs through the lazy-loaded pdf.js parser (kept out of the main
// bundle). Both return the same RawStatementRow[] shape, so the mapping UI is
// untouched — and so is the future swap to a FastAPI `/upload/parse` route.

import type { RawStatementRow } from '@/types';

let rowCounter = 0;
const tempId = () => `row_${Date.now()}_${rowCounter++}`;

/** Heuristically pick the date / amount / description columns from headers. */
function detectColumns(headers: string[]) {
  const lower = headers.map((h) => h.trim().toLowerCase());
  const find = (...candidates: string[]) =>
    lower.findIndex((h) => candidates.some((c) => h.includes(c)));

  return {
    date: find('date', 'txn date', 'transaction date', 'value date'),
    amount: find('amount', 'debit', 'withdrawal', 'value'),
    description: find('description', 'narration', 'particulars', 'details', 'remarks'),
  };
}

/** Split a CSV line respecting simple double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Normalize an amount string like "1,234.50" or "(500)" to a number. */
function parseAmount(raw: string): number {
  if (!raw) return NaN;
  const negative = /^\(.*\)$/.test(raw.trim());
  const cleaned = raw.replace(/[(),₹$\s]/g, '');
  const n = parseFloat(cleaned);
  if (Number.isNaN(n)) return NaN;
  return negative ? -Math.abs(n) : n;
}

/** Single entry point — routes by file type to the CSV or PDF parser. */
export async function parseStatementFile(file: File): Promise<RawStatementRow[]> {
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (isPdf) {
    // Lazy import so pdf.js (and its worker) only load when a PDF is dropped.
    const { parsePdfStatement } = await import('./parsePdf');
    return parsePdfStatement(file);
  }
  return parseCsvFile(file);
}

async function parseCsvFile(file: File): Promise<RawStatementRow[]> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]);
  const cols = detectColumns(headers);

  // If we can't find an amount column, fall back to positional (0,1,2).
  const dateIdx = cols.date >= 0 ? cols.date : 0;
  const amountIdx = cols.amount >= 0 ? cols.amount : 1;
  const descIdx = cols.description >= 0 ? cols.description : 2;

  const rows: RawStatementRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const amount = parseAmount(cells[amountIdx] ?? '');
    if (Number.isNaN(amount)) continue; // skip non-data rows
    rows.push({
      rowId: tempId(),
      date: (cells[dateIdx] ?? '').trim(),
      amount: Math.abs(amount), // store positive; type (expense/invest) comes from the mapped block
      description: (cells[descIdx] ?? '').trim(),
    });
  }
  return rows;
}
