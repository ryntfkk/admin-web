import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // @ts-ignore
  allowedDevOrigins: ['192.168.0.127', 'localhost'],
  // S5: header keamanan untuk admin-web (jalan di PC lokal, tapi header tetap murah
  // & bermanfaat — cegah clickjacking, MIME-sniff, kebocoran referrer). Tanpa domain
  // Midtrans (admin tak memuat Snap). CSP Report-Only agar tak memblokir sebelum diuji.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=()' },
          {
            key: 'Content-Security-Policy-Report-Only',
            value:
              "default-src 'self'; " +
              "img-src 'self' data: blob: https://*.cloudfront.net https://*.s3.ap-southeast-1.amazonaws.com; " +
              "script-src 'self' 'unsafe-inline'; " +
              "connect-src 'self' https://api.poskojasa.com wss://api.poskojasa.com; " +
              "style-src 'self' 'unsafe-inline'; " +
              "font-src 'self' data:; " +
              "base-uri 'self'; form-action 'self'; frame-ancestors 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
