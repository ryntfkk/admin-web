export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://api.poskojasa.com/api/v1';

// Backend requires X-Platform and X-App-Version on every request
// (see backend/internal/middleware/headers.go).
export const PLATFORM_HEADER = 'admin-web';
export const APP_VERSION = '1.0.0';

export const ADMIN_ROLE = 'admin';
