'use client';

import * as React from 'react';
import { AlertCircle, Rows2, Rows3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CenteredSpinner, EmptyState } from '@/components/ui/feedback';
import { Pagination } from '@/components/ui/pagination';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';

export interface Column<T> {
  /** Kunci unik kolom (dipakai sebagai React key). */
  key: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  /** Sembunyikan kolom di bawah breakpoint ini . tabel admin sering >8 kolom. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  headClassName?: string;
  width?: string;
}

export type TableDensity = 'compact' | 'comfortable';

const DENSITY_STORAGE_KEY = 'admin.table.density';

const HIDE_BELOW: Record<NonNullable<Column<unknown>['hideBelow']>, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
};

const ALIGN: Record<NonNullable<Column<unknown>['align']>, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  getRowId: (row: T, index: number) => string;
  isLoading?: boolean;
  error?: unknown;
  emptyTitle?: string;
  emptyNote?: string;
  /** Baris jadi bisa diklik (mis. menuju halaman detail) + dapat diakses via keyboard. */
  onRowClick?: (row: T) => void;
  /** Filter/pencarian yang tampil di atas tabel. */
  toolbar?: React.ReactNode;
  /** Tombol aksi di kanan toolbar (mis. "Tambah"). */
  actions?: React.ReactNode;
  showDensityToggle?: boolean;
  /** Header menempel saat digulir; butuh maxHeight agar terasa. */
  maxHeight?: string;
  page?: number;
  perPage?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  className?: string;
}

/**
 * Kerangka tabel daftar untuk seluruh panel admin.
 *
 * Menggantikan pola "filter → spinner → EmptyState → Table → Pagination" yang
 * sebelumnya disalin-tempel ke belasan halaman, masing-masing dengan penanganan
 * state kosong/gagal yang sedikit berbeda.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  isLoading = false,
  error,
  emptyTitle = 'Belum ada data',
  emptyNote,
  onRowClick,
  toolbar,
  actions,
  showDensityToggle = true,
  maxHeight,
  page,
  perPage,
  total,
  onPageChange,
  className,
}: DataTableProps<T>) {
  const [stored, setStored] = useLocalStorageState(DENSITY_STORAGE_KEY, 'comfortable');
  const density: TableDensity = stored === 'compact' ? 'compact' : 'comfortable';

  function toggleDensity() {
    setStored(density === 'compact' ? 'comfortable' : 'compact');
  }

  const cellPad = density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-3';
  const headPad = density === 'compact' ? 'h-8 px-3' : 'h-10 px-4';

  const hasPagination =
    page !== undefined && perPage !== undefined && total !== undefined && !!onPageChange;

  return (
    <div className={cn('space-y-3', className)}>
      {(toolbar || actions || showDensityToggle) && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar}</div>
          {showDensityToggle && (
            <Button
              variant="outline"
              size="icon-sm"
              onClick={toggleDensity}
              aria-label={density === 'compact' ? 'Renggangkan baris' : 'Padatkan baris'}
              title={density === 'compact' ? 'Renggangkan baris' : 'Padatkan baris'}
            >
              {density === 'compact' ? <Rows3 className="size-4" /> : <Rows2 className="size-4" />}
            </Button>
          )}
          {actions}
        </div>
      )}

      <div
        className="w-full overflow-auto rounded-xl border border-border bg-card"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <table className="w-full caption-bottom text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    headPad,
                    'align-middle text-xs font-medium text-muted-foreground',
                    ALIGN[col.align ?? 'left'],
                    col.hideBelow && HIDE_BELOW[col.hideBelow],
                    col.headClassName,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="[&_tr:last-child]:border-0">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length}>
                  <CenteredSpinner />
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={columns.length}>
                  <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                      <AlertCircle className="size-5" />
                    </div>
                    <p className="text-sm font-medium">Gagal memuat data</p>
                    <p className="text-sm text-muted-foreground">
                      {error instanceof Error ? error.message : 'Terjadi kesalahan tak terduga.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : !rows || rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState title={emptyTitle} note={emptyNote} />
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={getRowId(row, index)}
                  className={cn(
                    'border-b border-border transition-colors hover:bg-muted/40',
                    onRowClick &&
                    'cursor-pointer focus-visible:bg-muted/60 focus-visible:outline-none',
                  )}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                        // Baris bukan <a>, jadi Enter/Space harus ditangani manual
                        // agar pengguna keyboard bisa membuka detail.
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                      : undefined
                  }
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        cellPad,
                        'align-middle',
                        ALIGN[col.align ?? 'left'],
                        col.hideBelow && HIDE_BELOW[col.hideBelow],
                        col.className,
                      )}
                    >
                      {col.cell(row, index)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {hasPagination && !isLoading && !error && (
        <Pagination page={page} perPage={perPage} total={total} onPageChange={onPageChange} />
      )}
    </div>
  );
}

/**
 * Menghentikan propagasi klik supaya tombol aksi di dalam baris yang bisa
 * diklik tidak ikut membuka halaman detail.
 */
export function stopRowClick(e: React.MouseEvent) {
  e.stopPropagation();
}
