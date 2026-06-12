// =============================================================================
// API CLIENT  —  RTK Query slice
// =============================================================================
// Single source of all server communication. Every endpoint here maps directly
// to a FastAPI route we planned in the architecture. While USE_MOCKS is true,
// a custom baseQuery short-circuits to the seeded mock data so the UI is fully
// interactive before the backend exists. Flip USE_MOCKS to false (or remove the
// shim) once FastAPI is running on localhost:8000 behind the Vite proxy.

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from '@reduxjs/toolkit/query';
import type {
  Block,
  LineItem,
  PaymentSource,
  IncomeSource,
  MatrixResponse,
  Transaction,
  MonthTransaction,
  IncomeEntry,
  IncomeEntryDetail,
  Budget,
  RawStatementRow,
  AuthResponse,
  LoginRequest,
  User,
} from '@/types';
import { logout } from '@/features/auth/authSlice';
import { handleMockRequest } from './mockStore';

export const USE_MOCKS = false;

// --- Mock base query --------------------------------------------------------
// Delegates to the stateful in-memory store so CRUD genuinely persists for the
// session. Mirrors fetchBaseQuery's arg shape, so flipping USE_MOCKS to false
// swaps in the real backend with zero changes to endpoints or components.
const mockBaseQuery: BaseQueryFn = async (args) => {
  const url = typeof args === 'string' ? args : args.url;
  const method = (typeof args === 'string' ? 'GET' : args.method ?? 'GET') as
    | 'GET'
    | 'POST'
    | 'PUT'
    | 'DELETE';
  const body = typeof args === 'string' ? undefined : args.body;

  await new Promise((r) => setTimeout(r, 200)); // simulate latency
  return { data: handleMockRequest({ url, method, body }) };
};

// The real base query attaches the bearer token (when present) to every
// request. Reading it from the store keeps a single source of truth — the
// auth slice — rather than touching localStorage here.
const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/api',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as { auth: { token: string | null } }).auth.token;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

// Wrap the base query so any 401 (expired/invalid token) clears auth state.
// The route guard then redirects to /login on the next render.
const realBaseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, apiCtx, extraOptions) => {
  const result = await rawBaseQuery(args, apiCtx, extraOptions);
  if (result.error && result.error.status === 401) {
    apiCtx.dispatch(logout());
  }
  return result;
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery: USE_MOCKS ? mockBaseQuery : realBaseQuery,
  tagTypes: [
    'Block',
    'LineItem',
    'PaymentSource',
    'IncomeSource',
    'Matrix',
    'Transaction',
    'Income',
    'Budget',
    'Remark',
  ],
  endpoints: (build) => ({
    // --- Auth ---
    login: build.mutation<AuthResponse, LoginRequest>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),
    register: build.mutation<AuthResponse, LoginRequest>({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
    }),
    getMe: build.query<User, void>({
      query: () => '/auth/me',
    }),

    // --- Categories: Blocks ---
    getBlocks: build.query<Block[], void>({
      query: () => '/blocks',
      providesTags: ['Block'],
    }),
    createBlock: build.mutation<Block, Partial<Block>>({
      query: (body) => ({ url: '/blocks', method: 'POST', body }),
      invalidatesTags: ['Block', 'Matrix'],
    }),
    updateBlock: build.mutation<Block, Partial<Block> & { id: number }>({
      query: ({ id, ...body }) => ({ url: `/blocks/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Block', 'Matrix'],
    }),
    deleteBlock: build.mutation<void, number>({
      query: (id) => ({ url: `/blocks/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Block', 'LineItem', 'Matrix'],
    }),

    // --- Categories: Line Items ---
    getLineItems: build.query<LineItem[], void>({
      query: () => '/line-items',
      providesTags: ['LineItem'],
    }),
    createLineItem: build.mutation<LineItem, Partial<LineItem>>({
      query: (body) => ({ url: '/line-items', method: 'POST', body }),
      invalidatesTags: ['LineItem', 'Matrix'],
    }),
    updateLineItem: build.mutation<LineItem, Partial<LineItem> & { id: number }>({
      query: ({ id, ...body }) => ({ url: `/line-items/${id}`, method: 'PUT', body }),
      invalidatesTags: ['LineItem', 'Matrix'],
    }),
    deleteLineItem: build.mutation<void, number>({
      query: (id) => ({ url: `/line-items/${id}`, method: 'DELETE' }),
      invalidatesTags: ['LineItem', 'Matrix'],
    }),

    // --- Payment Sources ---
    getPaymentSources: build.query<PaymentSource[], void>({
      query: () => '/payment-sources',
      providesTags: ['PaymentSource'],
    }),
    createPaymentSource: build.mutation<PaymentSource, Partial<PaymentSource>>({
      query: (body) => ({ url: '/payment-sources', method: 'POST', body }),
      invalidatesTags: ['PaymentSource'],
    }),
    updatePaymentSource: build.mutation<PaymentSource, Partial<PaymentSource> & { id: number }>({
      query: ({ id, ...body }) => ({ url: `/payment-sources/${id}`, method: 'PUT', body }),
      invalidatesTags: ['PaymentSource'],
    }),
    deletePaymentSource: build.mutation<void, number>({
      query: (id) => ({ url: `/payment-sources/${id}`, method: 'DELETE' }),
      invalidatesTags: ['PaymentSource'],
    }),

    // --- Income Sources ---
    getIncomeSources: build.query<IncomeSource[], void>({
      query: () => '/income-sources',
      providesTags: ['IncomeSource'],
    }),
    createIncomeSource: build.mutation<IncomeSource, Partial<IncomeSource>>({
      query: (body) => ({ url: '/income-sources', method: 'POST', body }),
      invalidatesTags: ['IncomeSource'],
    }),
    updateIncomeSource: build.mutation<IncomeSource, Partial<IncomeSource> & { id: number }>({
      query: ({ id, ...body }) => ({ url: `/income-sources/${id}`, method: 'PUT', body }),
      invalidatesTags: ['IncomeSource'],
    }),
    deleteIncomeSource: build.mutation<void, number>({
      query: (id) => ({ url: `/income-sources/${id}`, method: 'DELETE' }),
      invalidatesTags: ['IncomeSource', 'Matrix'],
    }),

    // --- Matrix / dashboard ---
    getMatrix: build.query<MatrixResponse, void>({
      query: () => '/matrix',
      providesTags: ['Matrix'],
    }),

    // --- Transactions ---
    getTransactionsByMonth: build.query<MonthTransaction[], string>({
      query: (month) => `/transactions?month=${month}`,
      providesTags: ['Transaction'],
    }),
    createTransaction: build.mutation<Transaction, Partial<Transaction>>({
      query: (body) => ({ url: '/transactions', method: 'POST', body }),
      invalidatesTags: ['Transaction', 'Matrix'],
    }),
    updateTransaction: build.mutation<Transaction, Partial<Transaction> & { id: number }>({
      query: ({ id, ...body }) => ({ url: `/transactions/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Transaction', 'Matrix'],
    }),
    deleteTransaction: build.mutation<void, number>({
      query: (id) => ({ url: `/transactions/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Transaction', 'Matrix'],
    }),
    batchCreateTransactions: build.mutation<{ inserted: number }, Partial<Transaction>[]>({
      query: (body) => ({ url: '/transactions/batch', method: 'POST', body }),
      invalidatesTags: ['Transaction', 'Matrix'],
    }),

    // --- Income entries ---
    getIncomeByMonth: build.query<IncomeEntryDetail[], string>({
      query: (month) => `/income-entries?month=${month}`,
      providesTags: ['Income'],
    }),
    createIncomeEntry: build.mutation<IncomeEntry, Partial<IncomeEntry>>({
      query: (body) => ({ url: '/income-entries', method: 'POST', body }),
      invalidatesTags: ['Income', 'Matrix'],
    }),
    deleteIncomeEntry: build.mutation<void, number>({
      query: (id) => ({ url: `/income-entries/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Income', 'Matrix'],
    }),

    // --- Budgets ---
    getBudgets: build.query<Budget[], void>({
      query: () => '/budgets',
      providesTags: ['Budget'],
    }),
    upsertBudget: build.mutation<Budget, { blockId: number; year: number; month: number; amount: number }>({
      query: (body) => ({ url: '/budgets', method: 'PUT', body }),
      invalidatesTags: ['Budget'],
    }),

    // --- Bulk upload parse (backend returns raw, uncategorized rows) ---
    parseStatement: build.mutation<RawStatementRow[], FormData>({
      query: (body) => ({ url: '/upload/parse', method: 'POST', body }),
    }),

    // --- Remarks ---
    upsertRemark: build.mutation<void, { year: number; month: number; body: string }>({
      query: (body) => ({ url: '/remarks', method: 'PUT', body }),
      invalidatesTags: ['Matrix', 'Remark'],
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useGetMeQuery,
  useGetBlocksQuery,
  useCreateBlockMutation,
  useUpdateBlockMutation,
  useDeleteBlockMutation,
  useGetLineItemsQuery,
  useCreateLineItemMutation,
  useUpdateLineItemMutation,
  useDeleteLineItemMutation,
  useGetPaymentSourcesQuery,
  useCreatePaymentSourceMutation,
  useUpdatePaymentSourceMutation,
  useDeletePaymentSourceMutation,
  useGetIncomeSourcesQuery,
  useCreateIncomeSourceMutation,
  useUpdateIncomeSourceMutation,
  useDeleteIncomeSourceMutation,
  useGetMatrixQuery,
  useGetTransactionsByMonthQuery,
  useCreateTransactionMutation,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
  useBatchCreateTransactionsMutation,
  useGetIncomeByMonthQuery,
  useCreateIncomeEntryMutation,
  useDeleteIncomeEntryMutation,
  useGetBudgetsQuery,
  useUpsertBudgetMutation,
  useParseStatementMutation,
  useUpsertRemarkMutation,
} = api;
