'use client';

import { useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};

/**
 * `false` saat render di server / hidrasi pertama, `true` setelahnya.
 *
 * Dipakai oleh komponen ber-portal (Modal, Sheet, drawer) yang butuh
 * `document.body`. Pola lama `useEffect(() => setMounted(true), [])` memicu
 * render berantai dan dilarang aturan react-hooks/set-state-in-effect;
 * useSyncExternalStore memberi hasil yang sama tanpa setState sama sekali.
 */
export function useIsMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
