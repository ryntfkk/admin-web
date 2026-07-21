import { useAuthStore } from './store/authStore';
import { API_URL, PLATFORM_HEADER, APP_VERSION } from './constants';
import type { ApiResponse } from '@/types/api';

// ── Token refresh state (module-level, outside React) ───────────────
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

function baseHeaders(): Headers {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('X-Platform', PLATFORM_HEADER);
  headers.set('X-App-Version', APP_VERSION);
  return headers;
}

/** POST /auth/refresh using the HttpOnly refresh_token cookie. */
async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: baseHeaders(),
    });
    if (!res.ok) return false;

    const json = await res.json();
    if (json.success && json.data?.access_token) {
      useAuthStore.getState().setAccessToken(json.data.access_token);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Public helper so the AuthProvider can trigger a silent refresh on start-up. */
export async function silentRefresh(): Promise<boolean> {
  return refreshAccessToken();
}

/**
 * Parse a Response into ApiResponse<T> WITHOUT assuming a JSON body exists.
 * A 204 No Content / empty body from a successful mutation (e.g. DELETE) has no
 * envelope; `response.json()` would throw and the outer catch would turn a real
 * success into a fake "Network error". Treat empty/non-JSON bodies by status.
 */
async function parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
  if (response.status === 204) {
    return { success: response.ok };
  }
  const text = await response.text();
  if (!text) {
    return response.ok
      ? { success: true }
      : { success: false, error: `HTTP ${response.status}` };
  }
  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    // Non-JSON body (proxy/HTML error page, etc.).
    return response.ok
      ? { success: true }
      : { success: false, error: `HTTP ${response.status}` };
  }
}

// ── Core fetch helper ───────────────────────────────────────────────
export async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  try {
    const accessToken = useAuthStore.getState().accessToken;
    const headers = baseHeaders();
    // Merge any caller-provided headers.
    new Headers(options.headers).forEach((v, k) => headers.set(k, v));
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      credentials: options.credentials || 'include',
      headers,
    });

    // 401 → attempt token refresh, then retry ONCE.
    if (response.status === 401 && endpoint !== '/auth/refresh') {
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = refreshAccessToken();
      }
      const refreshed = await refreshPromise;
      isRefreshing = false;
      refreshPromise = null;

      if (refreshed) {
        const newToken = useAuthStore.getState().accessToken;
        const retryHeaders = baseHeaders();
        new Headers(options.headers).forEach((v, k) => retryHeaders.set(k, v));
        if (newToken) retryHeaders.set('Authorization', `Bearer ${newToken}`);

        const retry = await fetch(`${API_URL}${endpoint}`, {
          ...options,
          credentials: options.credentials || 'include',
          headers: retryHeaders,
        });
        return parseResponse<T>(retry);
      }

      useAuthStore.getState().logout();
    }

    return parseResponse<T>(response);
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error);
    return { success: false, error: 'Network error or server unreachable' };
  }
}

// ── Convenience wrappers ────────────────────────────────────────────
export const api = {
  get: <T>(endpoint: string) => fetchAPI<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body?: unknown) =>
    fetchAPI<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T>(endpoint: string, body?: unknown) =>
    fetchAPI<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(endpoint: string, body?: unknown) =>
    fetchAPI<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(endpoint: string) => fetchAPI<T>(endpoint, { method: 'DELETE' }),
};

/** Build a querystring from an object, skipping empty values. */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}
