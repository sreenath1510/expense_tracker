// =============================================================================
// UI SLICE
// =============================================================================
// Purely-local interface state that should survive a reload but never touches
// the server: the sidebar collapsed flag (persisted), the global Quick Add
// dialog, and the user's drag-reordered block order on the month screen
// (persisted so it's the same every visit).

import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

import type { PeriodMode } from '@/utils/period';

const COLLAPSED_KEY = 'ledger.sidebarCollapsed';
const BLOCK_ORDER_KEY = 'ledger.blockOrder';
const THEME_KEY = 'ledger.theme';
const PERIOD_MODE_KEY = 'ledger.periodMode';

type Theme = 'light' | 'dark';

function initialPeriodMode(): PeriodMode {
  // Fiscal (Apr–Mar) is the default — it matches how this ledger's data is
  // organized. Persisted so the choice sticks across visits.
  return localStorage.getItem(PERIOD_MODE_KEY) === 'calendar'
    ? 'calendar'
    : 'fiscal';
}

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

let nextToastId = 1;

function loadBlockOrder(): number[] {
  try {
    const raw = localStorage.getItem(BLOCK_ORDER_KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

function initialTheme(): Theme {
  // The inline script in index.html already resolved + applied this pre-paint.
  const fromDom = document.documentElement.dataset.theme;
  if (fromDom === 'light' || fromDom === 'dark') return fromDom;
  return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

interface UiState {
  sidebarCollapsed: boolean;
  theme: Theme;
  /** Calendar (Jan–Dec) vs fiscal (Apr–Mar) year windowing. Persisted. */
  periodMode: PeriodMode;
  quickAddOpen: boolean;
  /** When opened from a month screen, prefill the date into this month. */
  quickAddMonth: string | null;
  /** Persisted display order of block ids on the month screen (drag-reorder). */
  blockOrder: number[];
  /** Transient notification stack rendered by <ToastHost/>. Never persisted. */
  toasts: Toast[];
}

const initialState: UiState = {
  sidebarCollapsed: localStorage.getItem(COLLAPSED_KEY) === 'true',
  theme: initialTheme(),
  periodMode: initialPeriodMode(),
  quickAddOpen: false,
  quickAddMonth: null,
  blockOrder: loadBlockOrder(),
  toasts: [],
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      localStorage.setItem(COLLAPSED_KEY, String(state.sidebarCollapsed));
    },
    setSidebarCollapsed(state, action: PayloadAction<boolean>) {
      state.sidebarCollapsed = action.payload;
      localStorage.setItem(COLLAPSED_KEY, String(action.payload));
    },
    openQuickAdd(state, action: PayloadAction<string | undefined>) {
      state.quickAddOpen = true;
      state.quickAddMonth = action.payload ?? null;
    },
    closeQuickAdd(state) {
      state.quickAddOpen = false;
      state.quickAddMonth = null;
    },
    setBlockOrder(state, action: PayloadAction<number[]>) {
      state.blockOrder = action.payload;
      localStorage.setItem(BLOCK_ORDER_KEY, JSON.stringify(action.payload));
    },
    toggleTheme(state) {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      applyTheme(state.theme);
    },
    setTheme(state, action: PayloadAction<Theme>) {
      state.theme = action.payload;
      applyTheme(action.payload);
    },
    pushToast: {
      reducer(state, action: PayloadAction<Toast>) {
        state.toasts.push(action.payload);
      },
      prepare(payload: { message: string; tone?: ToastTone }) {
        return {
          payload: {
            id: nextToastId++,
            message: payload.message,
            tone: payload.tone ?? 'info',
          },
        };
      },
    },
    dismissToast(state, action: PayloadAction<number>) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
    setPeriodMode(state, action: PayloadAction<PeriodMode>) {
      state.periodMode = action.payload;
      localStorage.setItem(PERIOD_MODE_KEY, action.payload);
    },
  },
});

export const {
  toggleSidebar,
  setSidebarCollapsed,
  openQuickAdd,
  closeQuickAdd,
  setBlockOrder,
  toggleTheme,
  setTheme,
  pushToast,
  dismissToast,
  setPeriodMode,
} = uiSlice.actions;
export default uiSlice.reducer;
