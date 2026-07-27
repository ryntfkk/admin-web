'use client';

import * as React from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Mengurung fokus keyboard di dalam sebuah overlay (dialog/sheet) selama aktif,
 * lalu MENGEMBALIKAN fokus ke elemen pemicu saat ditutup.
 *
 * Tanpa ini, Tab bocor ke halaman di belakang overlay dan saat dialog ditutup
 * fokus terlempar ke awal dokumen — pengguna keyboard harus menelusuri ulang
 * seluruh sidebar untuk kembali ke tombol yang baru saja ditekan.
 *
 * Elemen container WAJIB punya `tabIndex={-1}` agar bisa menerima fokus awal
 * ketika di dalamnya belum ada elemen yang fokusable.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = React.useRef<T>(null);

  React.useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    const trigger = document.activeElement as HTMLElement | null;

    // Dihitung ulang tiap kali karena isi dialog bisa berubah (mis. tombol
    // konfirmasi baru aktif setelah alasan diisi).
    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement,
      );

    (focusables()[0] ?? container).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;

      if (e.shiftKey && (current === first || current === container)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      // Elemen pemicu bisa saja sudah lepas dari DOM (mis. baris tabel yang
      // hilang setelah dihapus) — abaikan diam-diam bila begitu.
      if (trigger && document.contains(trigger)) trigger.focus();
    };
  }, [active]);

  return ref;
}
