'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';

import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type { OrderRow, ReviewRow, WithdrawalRow } from '@/types/admin';
import { formatDateTime, formatIDR } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { EntitySection } from '@/components/ui/entity-page';
import { CenteredSpinner, EmptyState } from '@/components/ui/feedback';

/**
 * Tab aktivitas mitra (§11.1): Pesanan, Ulasan, Pencairan.
 *
 * Ketiganya memakai endpoint GLOBAL yang sudah ada dengan filter `partner_id`
 * / `user_id`, BUKAN service backend baru per tab — §11.1 menyebut itu secara
 * eksplisit. Konsekuensinya: kalau daftar global menambah kolom, tab ini ikut
 * mendapatkannya tanpa pekerjaan tambahan.
 */

const ORDER_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  COMPLETED: 'success',
  PAID: 'success',
  IN_PROGRESS: 'warning',
  WAITING_CONFIRMATION: 'warning',
  WAITING_PAYMENT: 'warning',
  WAITING_ADDITIONAL_PAY: 'warning',
  WAITING_CUSTOMER_CONFIRM: 'warning',
  CANCELLED: 'danger',
  DISPUTED: 'danger',
};

const WITHDRAWAL_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  COMPLETED: 'success',
  PENDING: 'warning',
  PROCESSING: 'warning',
  REJECTED: 'danger',
  FAILED: 'danger',
};

// ── Pesanan ─────────────────────────────────────────────────────────

export function PartnerOrdersTab({ partnerId }: { partnerId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['partner-orders', partnerId],
    queryFn: async () => {
      const res = await fetchAPI<{ data: OrderRow[] }>(
        `/admin/orders?partner_id=${partnerId}&per_page=50`,
      );
      if (!res.success) throw new Error(getErrorMessage(res));
      return res.data?.data ?? [];
    },
  });

  if (isLoading) return <CenteredSpinner />;
  if (error) return <EmptyState title="Gagal memuat pesanan" note={(error as Error).message} />;
  if (!data || data.length === 0) return <EmptyState title="Mitra ini belum punya pesanan" />;

  // Ringkasan dihitung dari baris yang termuat, dan itu DIKATAKAN di UI —
  // angka yang tampak final padahal cuma 50 baris terakhir lebih berbahaya
  // daripada tidak ada angka sama sekali.
  const completed = data.filter((o) => o.status === 'COMPLETED').length;
  const cancelled = data.filter((o) => o.status === 'CANCELLED').length;
  const disputed = data.filter((o) => o.status === 'DISPUTED').length;

  return (
    <EntitySection
      title="Pesanan"
      description={`${data.length} pesanan terakhir · ${completed} selesai · ${cancelled} batal · ${disputed} sengketa. Ringkasan dihitung dari baris yang ditampilkan, bukan seluruh riwayat.`}
    >
      <div className="space-y-2">
        {data.map((o) => (
          <Link
            key={o.id}
            href={`/dashboard/orders/${o.id}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:border-foreground/30"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{o.order_number}</span>
                <Badge variant={ORDER_STATUS_VARIANT[o.status] ?? 'neutral'}>{o.status}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {o.customer_name} · dijadwalkan {formatDateTime(o.scheduled_at)}
              </p>
            </div>
            <div className="flex items-center gap-2 text-right">
              <span className="text-sm font-medium">{formatIDR(o.agreed_price)}</span>
              <ExternalLink className="size-3.5 text-muted-foreground" />
            </div>
          </Link>
        ))}
      </div>
    </EntitySection>
  );
}

// ── Ulasan ──────────────────────────────────────────────────────────

export function PartnerReviewsTab({ partnerId }: { partnerId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['partner-reviews', partnerId],
    queryFn: async () => {
      const res = await fetchAPI<{ data: ReviewRow[] }>(
        `/admin/reviews?partner_id=${partnerId}&per_page=50`,
      );
      if (!res.success) throw new Error(getErrorMessage(res));
      return res.data?.data ?? [];
    },
  });

  if (isLoading) return <CenteredSpinner />;
  if (error) return <EmptyState title="Gagal memuat ulasan" note={(error as Error).message} />;
  if (!data || data.length === 0) return <EmptyState title="Mitra ini belum punya ulasan" />;

  const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
  const hidden = data.filter((r) => r.is_hidden).length;
  const answered = data.filter((r) => r.partner_response?.Valid).length;

  return (
    <EntitySection
      title="Ulasan"
      description={`Rata-rata ${avg.toFixed(2)} dari ${data.length} ulasan terakhir · ${answered} dibalas mitra · ${hidden} disembunyikan.`}
    >
      <div className="space-y-2">
        {data.map((r) => (
          <div key={r.id} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{'★'.repeat(r.rating)}</span>
                <span className="text-xs text-muted-foreground">{r.rating}/5</span>
                {r.is_hidden && <Badge variant="danger">Disembunyikan</Badge>}
                {/* Ulasan yang tidak dibalas dalam 7 hari kehilangan haknya —
                    penandanya membantu admin melihat pola mitra yang diam. */}
                {!r.partner_response?.Valid && <Badge variant="neutral">Belum dibalas</Badge>}
              </div>
              <Link
                href={`/dashboard/reviews/${r.id}`}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Detail
                <ExternalLink className="size-3" />
              </Link>
            </div>
            {r.comment?.Valid && <p className="mt-1.5 text-sm">{r.comment.String}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              {r.customer_name} · order {r.order_number} · {formatDateTime(r.created_at)}
            </p>
            {r.partner_response?.Valid && (
              <p className="mt-2 border-l-2 border-border pl-2.5 text-xs text-muted-foreground">
                <span className="font-medium">Balasan mitra: </span>
                {r.partner_response.String}
              </p>
            )}
          </div>
        ))}
      </div>
    </EntitySection>
  );
}

// ── Pencairan ───────────────────────────────────────────────────────

/**
 * Riwayat pencairan mitra. `status=ALL` dikirim eksplisit: endpoint global
 * memperlakukan status kosong sebagai "hanya PENDING" (perilaku antrean), dan
 * di sini yang dibutuhkan justru riwayat lengkap termasuk yang ditolak.
 */
const WITHDRAWAL_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED', 'FAILED'];

export function PartnerWithdrawalsTab({ userId }: { userId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['partner-withdrawals', userId],
    queryFn: async () => {
      // Satu request per status: endpoint memfilter satu nilai, dan menambah
      // dukungan multi-status di SQL demi satu layar tidak sepadan.
      const results = await Promise.all(
        WITHDRAWAL_STATUSES.map(async (status) => {
          const res = await fetchAPI<{ data: WithdrawalRow[] }>(
            `/admin/withdrawals/pending?status=${status}&user_id=${userId}&per_page=50`,
          );
          if (!res.success) throw new Error(getErrorMessage(res));
          return res.data?.data ?? [];
        }),
      );
      return results
        .flat()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  if (isLoading) return <CenteredSpinner />;
  if (error) return <EmptyState title="Gagal memuat pencairan" note={(error as Error).message} />;
  if (!data || data.length === 0) return <EmptyState title="Mitra ini belum pernah menarik dana" />;

  const failed = data.filter((w) => w.status === 'REJECTED' || w.status === 'FAILED').length;

  return (
    <EntitySection
      title="Pencairan"
      description={`${data.length} penarikan · ${failed} gagal/ditolak. Rekening yang ditampilkan adalah snapshot per-penarikan, bukan rekening mitra saat ini.`}
    >
      <div className="space-y-2">
        {data.map((w) => (
          <div
            key={w.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{formatIDR(w.amount - w.admin_fee)}</span>
                <Badge variant={WITHDRAWAL_STATUS_VARIANT[w.status] ?? 'neutral'}>{w.status}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatIDR(w.amount)} dikurangi biaya admin {formatIDR(w.admin_fee)}
              </p>
              <p className="text-xs text-muted-foreground">
                {w.bank_code?.String ?? '-'} · {w.bank_account_number?.String ?? '-'} ·{' '}
                {w.bank_account_name?.String ?? '-'}
              </p>
              {/* Nama badan hukum penerima dana, bukan nama PIC (§2.3). */}
              {w.partner_legal_name?.Valid && (
                <p className="text-xs text-muted-foreground">
                  Penerima: {w.partner_legal_name.String}
                </p>
              )}
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatDateTime(w.created_at)}
            </span>
          </div>
        ))}
      </div>
    </EntitySection>
  );
}
