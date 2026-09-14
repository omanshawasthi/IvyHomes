import { create } from 'zustand';
import type { UserDTO } from '../../../shared/types/index.js';

interface AuthState {
  user:          UserDTO | null;
  authenticated: boolean;
  setUser:       (user: UserDTO) => void;
  clearUser:     () => void;
}

/**
 * Minimal global auth store — only session/identity state lives here.
 * Everything else (listings, rentals, favourites) lives in TanStack Query cache.
 *
 * The actual session is the httpOnly cookie — this store just mirrors the
 * known-user state for UI purposes (show name, show logout button, etc.).
 */
export const useAuthStore = create<AuthState>((set) => ({
  user:          null,
  authenticated: false,

  setUser: (user) => set({ user, authenticated: true }),
  clearUser:     () => set({ user: null, authenticated: false }),
}));
