'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react';

export interface LightboxItem {
  id: string;
  label: string;
  url: string;
  /** Non-gambar (PDF) tetap boleh masuk daftar; ditampilkan sebagai tautan. */
  isImage: boolean;
}

/**
 * Penampil dokumen KYC layar penuh.
 *
 * Ada supaya admin berhenti membuka satu tab browser per dokumen. Untuk vendor
 * itu lima tab, dan setelah dua mitra tidak ada lagi yang tahu tab mana milik
 * siapa . sumber kesalahan verifikasi yang tidak pernah terlihat di log.
 *
 * `object-contain`, bukan `cover`: KTP yang terpotong tepinya justru menutupi
 * bagian yang harus dibaca admin.
 */
export function DocumentLightbox({
  items,
  index,
  onIndexChange,
  onClose,
}: {
  items: LightboxItem[];
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
}) {
  const current = items[index];

  const go = React.useCallback(
    (delta: number) => {
      if (items.length < 2) return;
      onIndexChange((index + delta + items.length) % items.length);
    },
    [index, items.length, onIndexChange],
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [go, onClose]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label={`Pratinjau dokumen ${current.label}`}
      onClick={onClose}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{current.label}</p>
          <p className="text-xs text-white/60">
            {index + 1} dari {items.length}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={current.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1.5 text-xs hover:bg-white/20"
          >
            Buka asli
            <ExternalLink className="size-3.5" />
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pratinjau"
            className="rounded-md bg-white/10 p-2 hover:bg-white/20"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
        {items.length > 1 && (
          <button
            type="button"
            aria-label="Dokumen sebelumnya"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            className="absolute left-3 z-10 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
          >
            <ChevronLeft className="size-5" />
          </button>
        )}

        {current.isImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={current.url}
            alt={current.label}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-lg bg-white p-6 text-center text-sm"
          >
            <p className="mb-3 text-muted-foreground">
              Berkas ini bukan gambar (kemungkinan PDF) dan tidak bisa dipratinjau di sini.
            </p>
            <a
              href={current.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium underline underline-offset-4"
            >
              Buka di tab baru
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        )}

        {items.length > 1 && (
          <button
            type="button"
            aria-label="Dokumen berikutnya"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            className="absolute right-3 z-10 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
          >
            <ChevronRight className="size-5" />
          </button>
        )}
      </div>
    </div>
  );
}
