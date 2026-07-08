import { create } from 'zustand';

// Mirrors backend auth.UserResponse (backend/internal/auth/dto.go).
export interface AdminUser {
  id: string;
  username: string;
  name: string;
  phone?: string;
  email?: string;
  avatar_url?: string;
  roles: string[];
  active_role: string;
  partner_id?: string;
  balance: number;
  is_verified: boolean;
  is_suspended: boolean;
}

interface AuthState {
  user: AdminUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  /** True while the initial silent refresh is still pending (app just loaded). */
  isInitializing: boolean;
  login: (user: AdminUser, accessToken: string) => void;
  logout: () => void;
  updateUser: (user: Partial<AdminUser>) => void;
  setAccessToken: (token: string) => void;
  finishInitialization: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isInitializing: true,

  login: (user, accessToken) =>
    set({ user, accessToken, isAuthenticated: true, isInitializing: false }),

  logout: () =>
    set({ user: null, accessToken: null, isAuthenticated: false, isInitializing: false }),

  updateUser: (updatedFields) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...updatedFields } : null,
    })),

  setAccessToken: (token) => set({ accessToken: token }),

  finishInitialization: () => set({ isInitializing: false }),
}));
