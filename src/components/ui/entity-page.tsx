'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CenteredSpinner } from '@/components/ui/feedback';

export interface EntityTab {
  /** Dipakai di URL sebagai ?tab=<id>. */
  id: string;
  label: string;
  /** Angka kecil di sebelah label (mis. jumlah order). */
  count?: number;
  content: React.ReactNode;
}

export interface EntityPageProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Badge status di sebelah judul. */
  badges?: React.ReactNode;
  /** Tombol aksi di kanan header. */
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  tabs?: EntityTab[];
  /** Dipakai bila `tabs` tidak diberikan. */
  children?: React.ReactNode;
  isLoading?: boolean;
  error?: unknown;
  className?: string;
}

/**
 * Kerangka halaman detail entitas: header (kembali, judul, status, aksi) +
 * tab yang tersinkron ke URL lewat `?tab=`.
 *
 * Sinkronisasi ke URL penting untuk kerja operasional: admin bisa menyalin
 * tautan langsung ke tab "Dompet" milik seorang pengguna, dan tombol Kembali
 * browser berperilaku wajar. Ini yang hilang saat detail masih berupa modal.
 */
export function EntityPage(props: EntityPageProps) {
  return (
    <React.Suspense fallback={<CenteredSpinner />}>
      <EntityPageInner {...props} />
    </React.Suspense>
  );
}

function EntityPageInner({
  title,
  subtitle,
  badges,
  actions,
  backHref,
  backLabel = 'Kembali',
  tabs,
  children,
  isLoading = false,
  error,
  className,
}: EntityPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const requestedTab = searchParams.get('tab');
  const activeTab = tabs?.find((t) => t.id === requestedTab) ?? tabs?.[0];

  function selectTab(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', id);
    // replace + scroll:false → pindah tab tidak menumpuk riwayat browser dan
    // tidak melompatkan halaman ke atas.
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className={cn('mx-auto max-w-6xl space-y-5', className)}>
      <div className="space-y-3">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {backLabel}
          </Link>
        )}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight break-words">{title}</h1>
              {badges}
            </div>
            {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </div>

      {isLoading ? (
        <CenteredSpinner />
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : 'Gagal memuat data.'}
        </div>
      ) : tabs && tabs.length > 0 ? (
        <div className="space-y-4">
          <div
            role="tablist"
            aria-label="Bagian detail"
            className="flex gap-1 overflow-x-auto border-b border-border"
          >
            {tabs.map((tab) => {
              const active = tab.id === activeTab?.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => selectTab(tab.id)}
                  className={cn(
                    '-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
                  )}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground tabular-nums">
                      {tab.count > 99 ? '99+' : tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div role="tabpanel">{activeTab?.content}</div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

/**
 * Kartu bagian di dalam tab detail — judul + isi, dengan slot aksi opsional.
 */
export function EntitySection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-xl border border-border bg-card p-4', className)}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {title && <h2 className="font-semibold tracking-tight">{title}</h2>}
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
