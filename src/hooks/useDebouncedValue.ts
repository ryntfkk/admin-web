'use client';

import { useEffect, useState } from 'react';

/**
 * Menunda perubahan nilai sampai user berhenti mengetik `delay` ms.
 *
 * Kotak pencarian admin sebelumnya memanggil refetch pada SETIAP ketukan tombol
 * (mis. financial/reports) . 1 permintaan per huruf. Bungkus state pencarian
 * dengan hook ini lalu pakai nilai debounced sebagai queryKey.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}
