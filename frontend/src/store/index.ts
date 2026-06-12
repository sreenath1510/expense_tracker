// =============================================================================
// REDUX STORE
// =============================================================================
// Redux Toolkit store. Server state is owned by RTK Query (api reducer);
// purely-local UI state (like the in-progress bulk-upload mapping draft) lives
// in dedicated slices added under `reducer` as features grow.

import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { api } from '@/api/client';
import uploadReducer from '@/features/upload/uploadSlice';
import authReducer from '@/features/auth/authSlice';
import uiReducer from '@/features/ui/uiSlice';

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    upload: uploadReducer,
    auth: authReducer,
    ui: uiReducer,
  },
  middleware: (getDefault) => getDefault().concat(api.middleware),
});

// Enables refetchOnFocus / refetchOnReconnect behaviors.
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
