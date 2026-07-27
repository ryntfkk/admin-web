'use client';

import * as React from 'react';
import { THEME_STORAGE_KEY, type Theme } from '@/lib/theme';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';

export type { Theme };

interface ThemeContextValue {
  theme: Theme;
  /** Tema yang benar-benar dipakai setelah 'system' diselesaikan. */
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

const MEDIA_QUERY = '(prefers-color-scheme: dark)';

function subscribeSystemTheme(onChange: () => void) {
  const mq = window.matchMedia(MEDIA_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/** Preferensi tema OS, dibaca sebagai external store (tanpa efek + setState). */
function useSystemPrefersDark(): boolean {
  return React.useSyncExternalStore(
    subscribeSystemTheme,
    () => window.matchMedia(MEDIA_QUERY).matches,
    () => false,
  );
}

function isTheme(value: string): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [stored, setStored] = useLocalStorageState(THEME_STORAGE_KEY, 'system');
  const systemPrefersDark = useSystemPrefersDark();

  const theme: Theme = isTheme(stored) ? stored : 'system';
  const resolvedTheme: 'light' | 'dark' =
    theme === 'dark' || (theme === 'system' && systemPrefersDark) ? 'dark' : 'light';

  // Satu-satunya efek di sini: menyelaraskan DOM (sistem eksternal) dengan state
  // React. THEME_INIT_SCRIPT sudah memasang kelas yang sama sebelum hidrasi,
  // jadi baris ini biasanya tidak mengubah apa pun saat pertama kali jalan.
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [resolvedTheme]);

  const setTheme = React.useCallback((next: Theme) => setStored(next), [setStored]);

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme harus dipakai di dalam <ThemeProvider>');
  return ctx;
}
