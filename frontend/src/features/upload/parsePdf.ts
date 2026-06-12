// =============================================================================
// PDF STATEMENT PARSER  —  client-side text extraction + heuristic line parse
// =============================================================================
// Bank/card statement PDFs have no universal schema, so we extract the text
// layer with pdf.js, rebuild visual lines from glyph positions, then pull a
// date + amount + description out of each line with tolerant heuristics.
//
// PDF parsing is inherently fuzzy (running balances, multi-line narrations,
// scanned/image-only PDFs with no text layer). That's why the mapping table
// lets you edit the parsed date and amount before saving — treat this as a
// strong first pass, not gospel. This module is lazy-imported from
// parseStatement.ts so pdf.js stays out of the main bundle.

import * as pdfjsLib from 'pdfjs-dist';
// Vite resolves this to a hashed asset URL and serves the worker as a module.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { RawStatementRow } from '@/types';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

let rowCounter = 0;
const tempId = () => `pdf_${Date.now()}_${rowCounter++}`;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

// A leading date: 01/02/2025, 01-02-25, 1.2.2025, 01 Feb 2025, 01-Feb-2025.
const DATE_RE =
  /(\d{1,2})[\/\-.\s](\d{1,2}|[A-Za-z]{3,9})[\/\-.\s](\d{2,4})/;

// A money token: requires comma grouping OR exactly two decimals so we don't
// mistake reference/cheque numbers for amounts. Optional currency + Cr/Dr.
const AMOUNT_RE =
  /(?:₹|rs\.?|inr)?\s?\(?-?\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?\)?|\(?-?\d+\.\d{2}\)?/gi;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Normalize a matched date to ISO YYYY-MM-DD (day-first, as Indian banks use). */
function toISO(day: string, monthRaw: string, yearRaw: string): string {
  let month: number;
  if (/^[A-Za-z]+$/.test(monthRaw)) {
    month = MONTHS[monthRaw.slice(0, 3).toLowerCase()] ?? NaN;
  } else {
    month = Number(monthRaw);
  }
  let year = Number(yearRaw);
  if (yearRaw.length === 2) year += 2000;
  const d = Number(day);
  if (!month || Number.isNaN(month) || !d || !year) return `${day} ${monthRaw} ${yearRaw}`;
  return `${year}-${pad(month)}-${pad(d)}`;
}

/** "1,234.50" / "(500.00)" / "₹1,200" -> number (always positive magnitude). */
function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[(),₹$\s]/gi, '').replace(/rs\.?|inr/gi, '');
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? NaN : Math.abs(n);
}

/** Rebuild visual text lines from a page's positioned glyph runs. */
async function extractLines(page: pdfjsLib.PDFPageProxy): Promise<string[]> {
  const content = await page.getTextContent();
  // Bucket items by their y position (transform[5]), tolerant to sub-pixel drift.
  const buckets = new Map<number, { x: number; str: string }[]>();
  for (const item of content.items) {
    if (!('str' in item) || !item.str.trim()) continue;
    const y = Math.round(item.transform[5]);
    // Snap to the nearest existing bucket within 2px so a line doesn't split.
    let key = y;
    for (const existing of buckets.keys()) {
      if (Math.abs(existing - y) <= 2) {
        key = existing;
        break;
      }
    }
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push({ x: item.transform[4], str: item.str });
  }

  return [...buckets.entries()]
    .sort((a, b) => b[0] - a[0]) // top of page first (PDF y grows upward)
    .map(([, items]) =>
      items
        .sort((a, b) => a.x - b.x)
        .map((i) => i.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    );
}

/** Turn one reconstructed line into a transaction row, or null if it isn't one. */
function parseLine(line: string): RawStatementRow | null {
  const dateMatch = line.match(DATE_RE);
  if (!dateMatch) return null;

  const amounts = line.match(AMOUNT_RE);
  if (!amounts || amounts.length === 0) return null;

  // Statements commonly print "... <amount> <running balance>". When two or
  // more money tokens trail the line, the transaction amount is usually the
  // second-to-last; with a single token, use it. Editable later regardless.
  const amountToken = amounts.length >= 2 ? amounts[amounts.length - 2] : amounts[0];
  const amount = parseAmount(amountToken);
  if (Number.isNaN(amount) || amount === 0) return null;

  // Description = the line minus the date prefix and any money tokens.
  let description = line.replace(dateMatch[0], ' ');
  for (const a of amounts) description = description.replace(a, ' ');
  description = description.replace(/\b(cr|dr)\b/gi, ' ').replace(/\s+/g, ' ').trim();

  return {
    rowId: tempId(),
    date: toISO(dateMatch[1], dateMatch[2], dateMatch[3]),
    amount,
    description,
  };
}

export async function parsePdfStatement(file: File): Promise<RawStatementRow[]> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  const rows: RawStatementRow[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const lines = await extractLines(page);
    for (const line of lines) {
      const row = parseLine(line);
      if (row) rows.push(row);
    }
  }

  await pdf.destroy();
  return rows;
}
