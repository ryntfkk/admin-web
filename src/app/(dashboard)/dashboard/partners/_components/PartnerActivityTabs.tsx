'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';

import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type {
  DisputeRow,
  OrderRow,
  PartnerPerformance,
  ReviewRow,
  WithdrawalRow,
} from '@/types/admin';
import { formatDateTime, formatIDR } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { EntitySection } from '@/components/ui/entity-page';
import { CenteredSpinner, EmptyState } from '@/components/ui/feedback';

/**
 * Tab aktivitas mitra (§11.1): Pesanan, Ulasan, Pencairan.
 *
 * Ketiganya memakai endpoint GLOBAL yang sudah ada dengan filter `partner_id`
 * / `user_id`, BUKAN service backend baru per tab . §11.1 menyebut itu secara
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

  // Ringkasan dihitung dari baris yang termuat, dan itu DIKATAKAN di UI .
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
            // /dashboard/orders TIDAK ADA . rute detail transaksi berada di
            // /dashboard/transactions/[id]. Tautan lama selalu berujung 404.
            href={`/dashboard/transactions/${o.id}`}
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
                {/* Ulasan yang tidak dibalas dalam 7 hari kehilangan haknya .
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

// ── Sengketa ────────────────────────────────────────────────────────

const DISPUTE_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  RESOLVED: 'success',
  REVIEWING: 'warning',
  OPEN: 'danger',
};

export function PartnerDisputesTab({ partnerId }: { partnerId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['partner-disputes', partnerId],
    queryFn: async () => {
      const res = await fetchAPI<{ data: DisputeRow[] }>(
        `/admin/disputes?partner_id=${partnerId}&per_page=50`,
      );
      if (!res.success) throw new Error(getErrorMessage(res));
      return res.data?.data ?? [];
    },
  });

  if (isLoading) return <CenteredSpinner />;
  if (error) return <EmptyState title="Gagal memuat sengketa" note={(error as Error).message} />;
  if (!data || data.length === 0) return <EmptyState title="Mitra ini belum pernah tersengketa" />;

  // Pola berulang = alasan paling kuat untuk menindak. Dihitung per JENIS,
  // bukan total: lima sengketa "no show" berarti hal yang sangat berbeda dari
  // lima sengketa dengan jenis berbeda-beda.
  const byType = data.reduce<Record<string, number>>((acc, d) => {
    acc[d.dispute_type] = (acc[d.dispute_type] ?? 0) + 1;
    return acc;
  }, {});
  const recurring = Object.entries(byType)
    .filter(([, n]) => n > 1)
    .map(([t, n]) => `${t} x${n}`);

  return (
    <EntitySection
      title="Sengketa"
      description={
        recurring.length > 0
          ? `${data.length} sengketa. Pola berulang: ${recurring.join(', ')}.`
          : `${data.length} sengketa, tidak ada jenis yang berulang.`
      }
    >
      <div className="space-y-2">
        {data.map((d) => (
          <Link
            key={d.id}
            href={`/dashboard/disputes/${d.id}`}
            className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:border-foreground/30"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{d.dispute_type}</span>
                <Badge variant={DISPUTE_STATUS_VARIANT[d.status] ?? 'neutral'}>{d.status}</Badge>
                {d.has_evidence && <Badge variant="neutral">Ada bukti</Badge>}
                {/* Sengketa tanpa tanggapan mitra adalah sinyal tersendiri .
                    bukan soal siapa benar, tapi mitra yang tidak menjawab. */}
                {!d.has_response && <Badge variant="warning">Belum ditanggapi</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {d.customer_name} · order {d.order_number} · {formatDateTime(d.created_at)}
              </p>
              {d.resolution_type?.Valid && (
                <p className="text-xs text-muted-foreground">
                  Putusan: {d.resolution_type.ResolutionType}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-sm font-medium">{formatIDR(d.order_amount)}</span>
              <ExternalLink className="size-3.5 text-muted-foreground" />
            </div>
          </Link>
        ))}
      </div>
    </EntitySection>
  );
}

// ── Performa ────────────────────────────────────────────────────────

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '-';
  if (seconds < 60) return `${Math.round(seconds)} detik`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} menit`;
  return `${(seconds / 3600).toFixed(1)} jam`;
}

export function PartnerPerformanceTab({ partnerId }: { partnerId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['partner-performance', partnerId],
    queryFn: async () => {
      const res = await fetchAPI<PartnerPerformance>(`/admin/partners/${partnerId}/performance`);
      if (!res.success) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  if (isLoading) return <CenteredSpinner />;
  if (error) return <EmptyState title="Gagal memuat performa" note={(error as Error).message} />;
  if (!data) return <EmptyState title="Belum ada data performa" />;

  // Persentase hanya bermakna bila ada penyebutnya. Menampilkan "0%" untuk
  // mitra tanpa pesanan sama sekali membuatnya terlihat buruk padahal ia baru.
  const pct = (n: number) =>
    data.total_orders > 0 ? `${((n / data.total_orders) * 100).toFixed(1)}%` : '-';

  return (
    <EntitySection
      title="Performa"
      description="Dihitung server atas SELURUH riwayat mitra, bukan dari baris yang ditampilkan di tab lain."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Total pesanan" value={String(data.total_orders)} />
        <Stat label="Selesai" value={String(data.completed_orders)} note={pct(data.completed_orders)} />
        <Stat label="Dibatalkan" value={String(data.cancelled_orders)} note={pct(data.cancelled_orders)} />
        <Stat label="Sengketa" value={String(data.disputed_orders)} note={pct(data.disputed_orders)} />
        <Stat
          label="Rating"
          value={data.total_reviews > 0 ? data.avg_rating.toFixed(2) : '-'}
          note={`${data.total_reviews} ulasan`}
        />
        <Stat
          label="Median konfirmasi"
          value={formatDuration(data.median_confirm_seconds)}
          note="median, bukan rata-rata"
        />
        <Stat
          label="Nilai jasa bruto"
          value={formatIDR(data.gross_gmv)}
          note="pesanan selesai, termasuk biaya tambahan"
        />
        <Stat
          label="Payout bersih"
          value={formatIDR(data.net_payout)}
          note={`setelah komisi ${formatIDR(data.gross_gmv - data.net_payout)}`}
        />
      </div>
    </EntitySection>
  );
}
