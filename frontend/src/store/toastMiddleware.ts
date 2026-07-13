// =============================================================================
// API ERROR → TOAST MIDDLEWARE
// =============================================================================
// Any rejected RTK Query MUTATION surfaces as an error toast, so components
// don't each need their own .catch() + banner. FastAPI puts human-readable
// messages in `detail` (e.g. the 409 "line item has transactions attached"),
// which we show verbatim when it's a plain string.
//
// Deliberately skipped:
//   - queries (pages already render their own loading/error states)
//   - 401s (the auth wrapper logs out and redirects — a toast would just
//     flash during the navigation)
//   - login/register (those forms show the error inline next to the fields)

import { isRejectedWithValue } from '@reduxjs/toolkit';
import type { Middleware } from '@reduxjs/toolkit';
import { pushToast } from '@/features/ui/uiSlice';

const INLINE_ERROR_ENDPOINTS = new Set(['login', 'register']);

interface RejectedMeta {
  arg?: { type?: string; endpointName?: string };
}

interface ApiErrorPayload {
  status?: number | string;
  data?: { detail?: unknown };
}

export const toastMiddleware: Middleware = (store) => (next) => (action) => {
  if (isRejectedWithValue(action)) {
    const meta = action.meta as RejectedMeta;
    const payload = action.payload as ApiErrorPayload | undefined;
    const endpoint = meta.arg?.endpointName ?? '';
    const isMutation = meta.arg?.type === 'mutation';

    if (
      isMutation &&
      !INLINE_ERROR_ENDPOINTS.has(endpoint) &&
      payload?.status !== 401
    ) {
      const detail = payload?.data?.detail;
      const message =
        typeof detail === 'string' && detail.trim()
          ? detail
          : payload?.status === 'FETCH_ERROR'
            ? 'Could not reach the server. Check your connection and try again.'
            : 'Something went wrong. Please try again.';
      store.dispatch(pushToast({ message, tone: 'error' }));
    }
  }
  return next(action);
};
