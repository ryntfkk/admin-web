export type Theme = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'admin.theme';

/**
 * Skrip yang dijalankan di <head> SEBELUM React hidrasi, supaya halaman tidak
 * berkedip putih sesaat saat admin memakai tema gelap (FOUC).
 *
 * Sengaja ditaruh di modul TANPA 'use client' agar bisa diimpor root layout
 * (server component) tanpa menyeret provider tema ikut ke server.
 * Harus tetap sinkron dengan applyTheme() di components/providers/theme-provider.tsx.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(
  THEME_STORAGE_KEY,
)};var t=localStorage.getItem(k)||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;
