// =============================================================================
// AUTH SLICE
// =============================================================================
// Holds the JWT + the signed-in user. Both are mirrored to localStorage so a
// page reload keeps the session — the token is sent on every API request by
// the prepareHeaders hook in api/client.ts. On logout (or a 401 from the
// server) the slice clears and the router bounces the user back to /login.

import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { AuthResponse, User } from '@/types';

const TOKEN_KEY = 'ledger.token';
const USER_KEY = 'ledger.user';

interface AuthState {
  token: string | null;
  user: User | null;
}

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

const initialState: AuthState = {
  token: localStorage.getItem(TOKEN_KEY),
  user: loadUser(),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<AuthResponse>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      localStorage.setItem(TOKEN_KEY, action.payload.token);
      localStorage.setItem(USER_KEY, JSON.stringify(action.payload.user));
    },
    logout(state) {
      state.token = null;
      state.user = null;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
