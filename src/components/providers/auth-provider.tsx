'use client';

import { useEffect, useRef } from 'react';
import { silentRefresh, fetchAPI } from '@/lib/api';
import { useAuthStore, AdminUser } from '@/lib/store/authStore';

/**
 * AuthProvider — runs ONCE on app start to attempt a silent token refresh
 * using the HttpOnly refresh_token cookie set by the backend.
 *
 * 1. POST /auth/refresh (credentials: include) → new access_token
 * 2. GET /users/me with that token → user profile
 * 3. Both succeed → authenticated (in-memory only)
 * 4. Either fails → stay unauthenticated
 */
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const ran = useRef(false);
  const login = useAuthStore((s) => s.login);
  const finishInitialization = useAuthStore((s) => s.finishInitialization);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    async function init() {
      try {
        const refreshed = await silentRefresh();
        if (!refreshed) {
          finishInitialization();
          return;
        }

        const res = await fetchAPI<{ user: AdminUser } | AdminUser>('/users/me');
        // /users/me may return the user directly or wrapped in { user }.
        const user =
          res.success && res.data
            ? ('user' in (res.data as object)
                ? (res.data as { user: AdminUser }).user
                : (res.data as AdminUser))
            : null;

        const token = useAuthStore.getState().accessToken;
        if (user && token) {
          login(user, token);
          return;
        }
        finishInitialization();
      } catch {
        finishInitialization();
      }
    }

    init();
  }, [finishInitialization, login]);

  return <>{children}</>;
}
