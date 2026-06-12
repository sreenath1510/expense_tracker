// =============================================================================
// UPLOAD SLICE  —  in-progress bulk-mapping draft
// =============================================================================
// The interactive mapping table needs to hold many rows being categorized
// before a single batch save. That's transient client state, not server state,
// so it lives here rather than in RTK Query.

import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { MappedRow, RawStatementRow } from '@/types';

interface UploadState {
  rows: MappedRow[];
}

const initialState: UploadState = {
  rows: [],
};

const uploadSlice = createSlice({
  name: 'upload',
  initialState,
  reducers: {
    // Seed the table from a freshly parsed statement.
    loadParsedRows(state, action: PayloadAction<RawStatementRow[]>) {
      state.rows = action.payload.map((r) => ({
        ...r,
        lineItemId: null,
        paymentSourceId: null,
      }));
    },
    setRowLineItem(state, action: PayloadAction<{ rowId: string; lineItemId: number | null }>) {
      const row = state.rows.find((r) => r.rowId === action.payload.rowId);
      if (row) row.lineItemId = action.payload.lineItemId;
    },
    setRowPaymentSource(
      state,
      action: PayloadAction<{ rowId: string; paymentSourceId: number | null }>,
    ) {
      const row = state.rows.find((r) => r.rowId === action.payload.rowId);
      if (row) row.paymentSourceId = action.payload.paymentSourceId;
    },
    // Parsed values are editable — PDF (and messy CSV) parsing can mis-read a
    // date or grab the running balance instead of the transaction amount.
    setRowAmount(state, action: PayloadAction<{ rowId: string; amount: number }>) {
      const row = state.rows.find((r) => r.rowId === action.payload.rowId);
      if (row) row.amount = action.payload.amount;
    },
    setRowDate(state, action: PayloadAction<{ rowId: string; date: string }>) {
      const row = state.rows.find((r) => r.rowId === action.payload.rowId);
      if (row) row.date = action.payload.date;
    },
    // Apply a value to every row at once (quick "map all to X" affordance).
    setAllLineItems(state, action: PayloadAction<number>) {
      state.rows.forEach((r) => (r.lineItemId = action.payload));
    },
    setAllPaymentSources(state, action: PayloadAction<number>) {
      state.rows.forEach((r) => (r.paymentSourceId = action.payload));
    },
    // Apply a value to a specific set of rows (the checkbox multi-select:
    // change one selected row's dropdown → applies to every selected row).
    setLineItemForRows(
      state,
      action: PayloadAction<{ rowIds: string[]; lineItemId: number | null }>,
    ) {
      const ids = new Set(action.payload.rowIds);
      state.rows.forEach((r) => {
        if (ids.has(r.rowId)) r.lineItemId = action.payload.lineItemId;
      });
    },
    setPaymentSourceForRows(
      state,
      action: PayloadAction<{ rowIds: string[]; paymentSourceId: number | null }>,
    ) {
      const ids = new Set(action.payload.rowIds);
      state.rows.forEach((r) => {
        if (ids.has(r.rowId)) r.paymentSourceId = action.payload.paymentSourceId;
      });
    },
    removeRow(state, action: PayloadAction<string>) {
      state.rows = state.rows.filter((r) => r.rowId !== action.payload);
    },
    clearUpload(state) {
      state.rows = [];
    },
  },
});

export const {
  loadParsedRows,
  setRowLineItem,
  setRowPaymentSource,
  setRowAmount,
  setRowDate,
  setAllLineItems,
  setAllPaymentSources,
  setLineItemForRows,
  setPaymentSourceForRows,
  removeRow,
  clearUpload,
} = uploadSlice.actions;

export default uploadSlice.reducer;
