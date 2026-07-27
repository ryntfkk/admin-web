'use client';

import { useCallback, useSyncExternalStore } from 'react';

// Penulisan di tab yang sama tidak memicu event `storage` (spesifikasi browser:
// event itu hanya dikirim ke tab LAIN), jadi kita simpan daftar listener sendiri.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

/**
 * Preferensi UI yang bertahan di localStorage (kepadatan tabel, sidebar
 * diciutkan, tema) — sinkron antar komponen DAN antar tab.
 *
 * Memakai useSyncExternalStore agar render di server memakai `fallback` lalu
 * React sendiri yang menyelaraskan ke nilai tersimpan setelah hidrasi. Membaca
 * localStorage di useState initializer akan memicu peringatan mismatch hidrasi;
 * membacanya di useEffect + setState melanggar aturan set-state-in-effect.
 */
export function useLocalStorageState(
  key: string,
  fallback: string,
): [string, (value: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key) ?? fallback,
    () => fallback,
  );

  const setValue = useCallback(
    (next: string) => {
      window.localStorage.setItem(key, next);
      listeners.forEach((l) => l());
    },
    [key],
  );

  return [value, setValue];
}
