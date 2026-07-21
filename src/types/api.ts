// ── API Response Types ──────────────────────────────────────────────
// Mirrors the backend's utils.APIResponse / APIError envelope
// (see backend/internal/utils/response.go).

export interface ApiErrorDetail {
  message?: string;
  [key: string]: unknown;
}

export interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages?: number;
}

/** Generic API response envelope returned by every endpoint. */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
  error?: string | ApiErrorDetail | null;
  pagination?: Pagination;
}

/**
 * Admin list endpoints wrap their payload as
 * `data: { data: T[], pagination: {...} }` (see admin/handler.go).
 */
export interface PaginatedData<T> {
  data: T[];
  pagination: Pagination;
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Extract a human-readable error message regardless of backend shape. */
export function getErrorMessage(res: ApiResponse): string {
  if (typeof res.error === 'object' && res.error !== null) {
    const detail = res.error as ApiErrorDetail;
    if (detail.message) return detail.message;
  }
  if (typeof res.error === 'string' && res.error.length > 0) {
    return res.error;
  }
  if (res.message) return res.message;
  return 'Terjadi kesalahan. Silakan coba lagi.';
}

// ── Admin domain types (mirror backend db rows / dtos) ──────────────

export interface DashboardStats {
  overview: {
    total_partners: number;
    pending_partners: number;
    total_customers: number;
    active_orders: number;
    open_disputes: number;
    /** Laporan/CS berstatus OPEN/REVIEWING yang butuh tindakan admin. */
    open_reports: number;
  };
  today: {
    new_orders: number;
    completed_orders: number;
    cancelled_orders: number;
  };
  financial: {
    pending_withdrawals: number;
    /** Jumlah (count) withdrawal berstatus PENDING. */
    pending_withdrawals_count: number;
  };
}
