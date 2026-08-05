import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Pasangan label→nilai read-only untuk panel detail.
 *
 * Sebelumnya komponen ini didefinisikan ulang di ENAM halaman (partners, users,
 * disputes, transactions, reports, reviews) dengan tipe & gaya yang
 * sedikit-sedikit berbeda. Ini satu-satunya definisi; jangan bikin lokal lagi.
 *
 * Memakai div/p (bukan dl/dt/dd) supaya bisa dipasang di grid mana pun tanpa
 * memaksa pemanggil membungkusnya dengan <dl>.
 */
export function Field({
  label,
  value,
  className,
  mono,
}: {
  label: string;
  /** Nilai kosong (null/undefined/'') otomatis jadi "-". */
  value: React.ReactNode;
  className?: string;
  /** Untuk ID, referensi bank, hash . pakai font monospace + boleh patah. */
  mono?: boolean;
}) {
  const isEmpty = value === null || value === undefined || value === '';

  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div
        className={cn(
          'mt-0.5 break-words',
          mono && 'break-all font-mono text-xs',
          isEmpty && 'text-muted-foreground',
        )}
      >
        {isEmpty ? '-' : value}
      </div>
    </div>
  );
}

/** Grid responsif untuk sekumpulan <Field>. */
export function FieldGrid({
  children,
  columns = 2,
  className,
}: {
  children: React.ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid gap-x-4 gap-y-3',
        columns === 1 && 'grid-cols-1',
        columns === 2 && 'grid-cols-1 sm:grid-cols-2',
        columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {children}
    </div>
  );
}
