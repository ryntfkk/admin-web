'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban } from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type { OrderDetailRow, OrderStatusHistoryRow } from '@/types/admin';
import { nstr, ntime } from '@/lib/sql';
import { formatDateTime, formatIDR } from '@/lib/format';
import { toast } from '@/lib/store/toastStore';
import { ORDER_STATUS_LABELS, orderStatusVariant } from '@/lib/enums';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldGrid } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EntityPage, EntitySection, type EntityTab } from '@/components/ui/entity-page';
import { CenteredSpinner, EmptyState } from '@/components/ui/feedback';

/**
 * Status PRA-PAYOUT (mitra belum dibayar) yang aman di-force-cancel + refund.
 * COMPLETED (mitra sudah dibayar) → pakai Penyesuaian Saldo; DISPUTED → sengketa.
 * Daftar ini harus sama dengan allowlist di backend AdminForceCancelOrder.
 */
const FORCE_CANCELLABLE = new Set([
  'WAITING_PAYMENT',
  'WAITING_CONFIRMATION',
  'PAID',
  'IN_PROGRESS',
  'WAITING_ADDITIONAL_PAY',
  'WAITING_CUSTOMER_CONFIRM',
]);

export default function OrderDetailPage() {
  const { id: orderId } = useParams<{ id: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['order-detail', orderId],
    queryFn: async () => {
      const res = await fetchAPI<OrderDetailRow>(`/admin/orders/${orderId}`);
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const tabs: EntityTab[] = data
    ? [
        { id: 'ringkasan', label: 'Ringkasan', content: <SummaryTab order={data} /> },
        { id: 'riwayat', label: 'Riwayat Status', content: <StatusHistoryTab orderId={orderId} /> },
        {
          id: 'kontrol',
          label: 'Kontrol Admin',
          content: <AdminControlTab order={data} orderId={orderId} />,
        },
      ]
    : [];

  return (
    <EntityPage
      backHref="/dashboard/transactions"
      backLabel="Semua transaksi"
      isLoading={isLoading}
      error={error}
      title={<span className="font-mono">{data?.order_number ?? '—'}</span>}
      subtitle={
        data && (
          <span>
            {data.customer_name} → {data.partner_name} · dibuat {formatDateTime(data.created_at)}
          </span>
        )
      }
      badges={
        data && (
          <Badge variant={orderStatusVariant(data.status)}>
            {ORDER_STATUS_LABELS[data.status] || data.status}
          </Badge>
        )
      }
      tabs={tabs}
    />
  );
}

function SummaryTab({ order }: { order: OrderDetailRow }) {
  return (
    <div className="space-y-4">
      <EntitySection title="Pihak & jadwal">
        <FieldGrid columns={3}>
          <Field label="Pelanggan" value={order.customer_name} />
          <Field label="Telepon pelanggan" value={nstr(order.customer_phone)} />
          <Field label="Mitra" value={order.partner_name} />
          <Field label="Telepon mitra" value={nstr(order.partner_phone)} />
          <Field label="Jadwal" value={formatDateTime(order.scheduled_at)} />
          <Field label="Dibuat" value={formatDateTime(order.created_at)} />
          {ntime(order.completed_at) && (
            <Field label="Selesai" value={formatDateTime(ntime(order.completed_at))} />
          )}
        </FieldGrid>
      </EntitySection>

      <EntitySection title="Lokasi">
        <p className="text-sm">{order.address}</p>
        {nstr(order.notes) && (
          <p className="mt-1 text-sm text-muted-foreground">Catatan: {nstr(order.notes)}</p>
        )}
      </EntitySection>

      <EntitySection title="Rincian biaya">
        <div className="text-sm">
          <Row label="Harga layanan" value={formatIDR(order.total_service_price)} />
          <Row label="Biaya transport" value={formatIDR(order.transport_fee)} />
          <Row label="Biaya admin" value={formatIDR(order.admin_fee_customer)} />
          <Row label="Diskon" value={`- ${formatIDR(order.discount_amount)}`} />
          <div className="mt-2 border-t border-border pt-2">
            <Row label="Total disepakati" value={formatIDR(order.agreed_price)} bold />
          </div>
        </div>
      </EntitySection>

      {nstr(order.cancellation_reason) && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Dibatalkan: {nstr(order.cancellation_reason)}
        </p>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? 'font-semibold' : ''}>{value}</span>
    </div>
  );
}

function StatusHistoryTab({ orderId }: { orderId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['order-status-history', orderId],
    queryFn: async () => {
      const res = await fetchAPI<OrderStatusHistoryRow[]>(`/admin/orders/${orderId}/status-history`);
      if (!res.success) throw new Error(getErrorMessage(res));
      return res.data ?? [];
    },
  });

  if (isLoading) return <CenteredSpinner />;
  if (!data || data.length === 0)
    return <EmptyState title="Belum ada riwayat" note="Perubahan status akan tercatat di sini." />;

  return (
    <EntitySection>
      <ol className="space-y-2">
        {data.map((h, i) => (
          <li key={h.id} className="flex gap-3 text-sm">
            <div className="flex flex-col items-center">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">
                {i + 1}
              </span>
              {i < data.length - 1 && <span className="w-px flex-1 bg-border" />}
            </div>
            <div className="flex-1 pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={orderStatusVariant(h.status)}>
                  {ORDER_STATUS_LABELS[h.status] || h.status}
                </Badge>
                <span className="text-xs text-muted-foreground">{formatDateTime(h.created_at)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {nstr(h.actor_name) || 'System'} ({nstr(h.actor_role) || 'system'})
              </p>
              {nstr(h.reason) && (
                <p className="mt-1 text-xs text-muted-foreground">{nstr(h.reason)}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </EntitySection>
  );
}

function AdminControlTab({ order, orderId }: { order: OrderDetailRow; orderId: string }) {
  const qc = useQueryClient();
  const [refundOverride, setRefundOverride] = useState('');
  const [confirming, setConfirming] = useState(false);

  const cancel = useMutation({
    mutationFn: async (reason: string) => {
      const body: { reason: string; refund_amount?: number } = { reason };
      if (refundOverride.trim() !== '') {
        const n = Number.parseInt(refundOverride, 10);
        if (Number.isNaN(n) || n < 0) throw new Error('Nominal refund tidak valid');
        body.refund_amount = n;
      }
      const res = await fetchAPI(`/admin/orders/${orderId}/force-cancel`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Pesanan dibatalkan & customer di-refund');
      setConfirming(false);
      setRefundOverride('');
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['order-detail', orderId] });
      qc.invalidateQueries({ queryKey: ['order-status-history', orderId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Kenapa aksi tidak tersedia — sebelumnya panel ini sekadar menghilang tanpa
  // penjelasan, sehingga admin tak tahu harus lewat jalur mana.
  if (!FORCE_CANCELLABLE.has(order.status)) {
    return (
      <EntitySection title="Pembatalan paksa tidak tersedia">
        <p className="text-sm text-muted-foreground">
          {order.status === 'COMPLETED' ? (
            <>
              Order sudah <strong>selesai</strong> dan mitra sudah dibayar. Mengembalikan dana lewat
              jalur ini akan membuat pembayaran ganda. Gunakan{' '}
              <Link
                href={`/dashboard/users/${order.customer_id}?tab=profil`}
                className="underline underline-offset-4"
              >
                Sesuaikan Saldo
              </Link>{' '}
              pada pelanggan dan mitra terkait — dua langkah terpisah yang keduanya teraudit.
            </>
          ) : order.status === 'DISPUTED' ? (
            <>
              Order sedang <strong>disengketakan</strong>. Selesaikan lewat menu{' '}
              <Link href="/dashboard/disputes" className="underline underline-offset-4">
                Sengketa
              </Link>
              , yang sudah menangani refund + payout secara aman dalam satu transaksi.
            </>
          ) : (
            <>
              Status <strong>{ORDER_STATUS_LABELS[order.status] || order.status}</strong> bersifat
              final — tidak ada dana yang perlu dikembalikan.
            </>
          )}
        </p>
      </EntitySection>
    );
  }

  return (
    <>
      <EntitySection
        title="Batalkan paksa & refund"
        description="Hanya untuk order pra-payout (mitra belum dibayar), sehingga tidak mungkin terjadi pembayaran ganda."
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <Row label="Total disepakati" value={formatIDR(order.agreed_price)} bold />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="refund-amount">Nominal refund</Label>
            <Input
              id="refund-amount"
              type="number"
              min="0"
              placeholder={`Kosongkan untuk refund penuh (${formatIDR(order.agreed_price)})`}
              value={refundOverride}
              onChange={(e) => setRefundOverride(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Backend membatasi nominal ke maksimum dana yang benar-benar terkumpul dari pelanggan.
            </p>
          </div>
          <Button variant="destructive" onClick={() => setConfirming(true)}>
            <Ban className="size-4" />
            Batalkan & Refund
          </Button>
        </div>
      </EntitySection>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={(reason) => cancel.mutate(reason)}
        variant="danger"
        title="Batalkan pesanan & kembalikan dana?"
        description={
          <>
            Saldo pelanggan bertambah{' '}
            <strong className="text-foreground">
              {refundOverride.trim() === ''
                ? `penuh (maks. ${formatIDR(order.agreed_price)})`
                : formatIDR(Number(refundOverride) || 0)}
            </strong>
            . Mitra <strong className="text-foreground">tidak</strong> menerima kompensasi. Tindakan
            ini tidak bisa dibatalkan.
          </>
        }
        confirmLabel="Batalkan & Refund"
        requireReason
        reasonLabel="Alasan pembatalan"
        confirmPhrase={order.order_number}
        loading={cancel.isPending}
      />
    </>
  );
}
