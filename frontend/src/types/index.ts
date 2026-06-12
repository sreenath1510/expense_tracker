// =============================================================================
// DOMAIN TYPES  —  mirror the backend schema & API contracts
// =============================================================================
// Keeping these aligned with the SQLite schema means the frontend and FastAPI
// backend share one mental model. When the backend lands, these become the
// canonical request/response shapes.

// --- Auth -------------------------------------------------------------------

export interface User {
  id: number;
  username: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export type BlockType = 'EXPENSE' | 'INVESTMENT';

export interface Block {
  id: number;
  name: string;
  type: BlockType;
  sortOrder: number;
}

export interface LineItem {
  id: number;
  blockId: number;
  name: string;
  sortOrder: number;
}

export interface PaymentSource {
  id: number;
  name: string;
  sortOrder: number;
}

export interface IncomeSource {
  id: number;
  name: string;
  sortOrder: number;
}

export interface Transaction {
  id: number;
  txnDate: string; // ISO 'YYYY-MM-DD'
  amount: number;
  lineItemId: number;
  paymentSourceId: number;
  description?: string | null;
}

export interface IncomeEntry {
  id: number;
  entryDate: string;
  amount: number;
  incomeSourceId: number;
  description?: string | null;
}

export interface Budget {
  id: number;
  blockId: number;
  year: number;
  month: number; // 1-12
  amount: number;
}

export interface MonthlyRemark {
  id: number;
  year: number;
  month: number; // 1-12
  body: string;
}

// --- Matrix / reporting shapes ----------------------------------------------

/** A single month column key, e.g. "2025-01". */
export type MonthKey = string;

export interface MatrixCell {
  monthKey: MonthKey;
  amount: number;
}

/** One Line Item row across all month columns. */
export interface MatrixLineItemRow {
  lineItemId: number;
  lineItemName: string;
  cells: Record<MonthKey, number>;
}

/** A Block grouping its line-item rows, with rolled-up subtotals. */
export interface MatrixBlockGroup {
  blockId: number;
  blockName: string;
  blockType: BlockType;
  rows: MatrixLineItemRow[];
  subtotals: Record<MonthKey, number>; // rolled up from rows
}

/** The computed summary engine output (theme.md feature E). */
export interface MatrixSummary {
  totalIncome: Record<MonthKey, number>;
  totalExpenditure: Record<MonthKey, number>;
  balance: Record<MonthKey, number>;
  totalInvestments: Record<MonthKey, number>;
  liquidSavings: Record<MonthKey, number>;
}

/** Full payload powering the dashboard matrix view. */
export interface MatrixResponse {
  months: MonthKey[];
  blocks: MatrixBlockGroup[];
  summary: MatrixSummary;
  remarks: Record<MonthKey, string>;
}

/**
 * A single transaction enriched with the names needed to display it in the
 * month drilldown, so the detail view doesn't have to re-join against the
 * blocks/line-items/payment-sources collections itself.
 */
export interface MonthTransaction {
  id: number;
  txnDate: string; // ISO 'YYYY-MM-DD'
  amount: number;
  blockId: number;
  blockName: string;
  blockType: BlockType;
  lineItemId: number;
  lineItemName: string;
  paymentSourceId: number;
  paymentSourceName: string;
  description?: string | null;
}

/** An income entry enriched with its source name, for the month view. */
export interface IncomeEntryDetail {
  id: number;
  entryDate: string; // ISO 'YYYY-MM-DD'
  amount: number;
  incomeSourceId: number;
  incomeSourceName: string;
  description?: string | null;
}

// --- Bulk upload shapes -----------------------------------------------------

/** A raw parsed row from an uploaded statement — uncategorized by design. */
export interface RawStatementRow {
  rowId: string; // client-side temp id for the mapping table
  date: string;
  amount: number;
  description: string;
}

/** A row after the user maps it in the interactive table. */
export interface MappedRow extends RawStatementRow {
  lineItemId: number | null;
  paymentSourceId: number | null;
}
