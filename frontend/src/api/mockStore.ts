// =============================================================================
// MOCK STORE  —  stateful in-memory backend stand-in
// =============================================================================
// Makes the UI fully interactive before the FastAPI backend exists: CRUD
// mutations actually mutate this store, and RTK Query's tag invalidation
// refetches the GET endpoints so changes show up immediately. Resets on reload
// (no persistence — that's the real backend's job). Delete USE_MOCKS or set it
// false in client.ts once FastAPI is live, and none of this runs.

import {
  mockBlocks,
  mockLineItems,
  mockPaymentSources,
  mockIncomeSources,
  mockMatrix,
} from './mockData';
import type {
  Block,
  LineItem,
  PaymentSource,
  IncomeSource,
} from '@/types';

// Deep-clone the seed so edits don't mutate the original module exports.
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

interface Store {
  blocks: Block[];
  lineItems: LineItem[];
  paymentSources: PaymentSource[];
  incomeSources: IncomeSource[];
}

const db: Store = {
  blocks: clone(mockBlocks),
  lineItems: clone(mockLineItems),
  paymentSources: clone(mockPaymentSources),
  incomeSources: clone(mockIncomeSources),
};

// Simple incrementing id generator per collection.
const nextId = (rows: { id: number }[]) =>
  rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface MockRequest {
  url: string;
  method: Method;
  body?: unknown;
}

/**
 * Routes a request against the in-memory store. Returns the same shape the
 * real API will, so swapping to fetchBaseQuery later requires no UI changes.
 */
export function handleMockRequest({ url, method, body }: MockRequest): unknown {
  // --- Collection GETs ---
  if (method === 'GET') {
    switch (url) {
      case '/blocks':
        return db.blocks;
      case '/line-items':
        return db.lineItems;
      case '/payment-sources':
        return db.paymentSources;
      case '/income-sources':
        return db.incomeSources;
      case '/matrix':
        // The matrix still comes from the static seed — recomputing it from
        // live transactions is the backend's job (AggregationService).
        return mockMatrix;
      default:
        return { ok: true };
    }
  }

  // --- Blocks ---
  if (url === '/blocks' && method === 'POST') {
    const b = body as Partial<Block>;
    const created: Block = {
      id: nextId(db.blocks),
      name: b.name ?? 'Untitled',
      type: b.type ?? 'EXPENSE',
      sortOrder: b.sortOrder ?? db.blocks.length,
    };
    db.blocks.push(created);
    return created;
  }
  if (url.startsWith('/blocks/') && method === 'PUT') {
    const id = Number(url.split('/')[2]);
    const idx = db.blocks.findIndex((x) => x.id === id);
    if (idx >= 0) db.blocks[idx] = { ...db.blocks[idx], ...(body as Partial<Block>) };
    return db.blocks[idx];
  }
  if (url.startsWith('/blocks/') && method === 'DELETE') {
    const id = Number(url.split('/')[2]);
    db.blocks = db.blocks.filter((x) => x.id !== id);
    // cascade: drop child line items
    db.lineItems = db.lineItems.filter((li) => li.blockId !== id);
    return { ok: true };
  }

  // --- Line items ---
  if (url === '/line-items' && method === 'POST') {
    const li = body as Partial<LineItem>;
    const created: LineItem = {
      id: nextId(db.lineItems),
      blockId: li.blockId!,
      name: li.name ?? 'Untitled',
      sortOrder: li.sortOrder ?? db.lineItems.length,
    };
    db.lineItems.push(created);
    return created;
  }
  if (url.startsWith('/line-items/') && method === 'PUT') {
    const id = Number(url.split('/')[2]);
    const idx = db.lineItems.findIndex((x) => x.id === id);
    if (idx >= 0) db.lineItems[idx] = { ...db.lineItems[idx], ...(body as Partial<LineItem>) };
    return db.lineItems[idx];
  }
  if (url.startsWith('/line-items/') && method === 'DELETE') {
    const id = Number(url.split('/')[2]);
    db.lineItems = db.lineItems.filter((x) => x.id !== id);
    return { ok: true };
  }

  // --- Payment sources ---
  if (url === '/payment-sources' && method === 'POST') {
    const ps = body as Partial<PaymentSource>;
    const created: PaymentSource = {
      id: nextId(db.paymentSources),
      name: ps.name ?? 'Untitled',
      sortOrder: ps.sortOrder ?? db.paymentSources.length,
    };
    db.paymentSources.push(created);
    return created;
  }
  if (url.startsWith('/payment-sources/') && method === 'PUT') {
    const id = Number(url.split('/')[2]);
    const idx = db.paymentSources.findIndex((x) => x.id === id);
    if (idx >= 0)
      db.paymentSources[idx] = { ...db.paymentSources[idx], ...(body as Partial<PaymentSource>) };
    return db.paymentSources[idx];
  }
  if (url.startsWith('/payment-sources/') && method === 'DELETE') {
    const id = Number(url.split('/')[2]);
    db.paymentSources = db.paymentSources.filter((x) => x.id !== id);
    return { ok: true };
  }

  // Fallback for not-yet-mocked mutations (transactions, remarks, upload).
  return { ok: true };
}
