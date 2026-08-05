'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type { OrderDetailRow, OrderPaymentEvent } from '@/types/admin';
import { formatDateTime, formatIDR } from '@/lib/format';
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_STATUS_LABELS,
  transactionStatusVariant,
  WALLET_TX_CATEGORY_LABELS,
  WALLET_TX_TYPE_LABELS,
  WALLET_TX_STATUS_LABELS,
  walletTxTypeVariant,
  walletTxStatusVariant,
  PAYMENT_EVENT_STATUS_LABELS,
  paymentEventStatusVariant,
} from '@/lib/enums';
import { Badge } from '@/components/ui/badge';
import { Field, FieldGrid } from '@/components/ui/field';
import { EntitySection } from '@/components/ui/entity-page';
import { CenteredSpinner } from '@/components/ui/feedback';

/**
 * Sisi uang sebuah transaksi: pembayaran di gateway, aliran dompet internal,
 * dan webhook mentah dari Midtrans.
 *
 * Ketiganya tidak pernah terlihat oleh admin sebelum audit 2026-08-05 . artinya
 * tidak ada cara memverifikasi bahwa uang sebuah pesanan benar-benar masuk,
 * dan webhook yang gagal diproses tidak muncul di mana pun.
 */
export function PaymentsTab({ order }: { order: OrderDetailRow }) {
  return (
    <div className="space-y-4">
      <EntitySection
        title={`Pembayaran gateway (${order.payments.length})`}
        description="Referensi gateway adalah kunci untuk mencocokkan pesanan ini dengan dashboard Midtrans."
      >
        {order.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada percobaan pembayaran tercatat untuk pesanan ini.
          </p>
        ) : (
          <div className="space-y-2">
            {order.payments.map((t) => (
              <div key={t.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">
                      {TRANSACTION_TYPE_LABELS[t.type] ?? t.type}
                    </Badge>
                    <Badge variant={transactionStatusVariant(t.status)}>
                      {TRANSACTION_STATUS_LABELS[t.status] ?? t.status}
                    </Badge>
                    {t.payment_method && (
                      <span className="text-sm text-muted-foreground">{t.payment_method}</span>
                    )}
                  </div>
                  <span className="font-semibold tabular-nums">{formatIDR(t.amount)}</span>
                </div>
                <FieldGrid columns={3} className="mt-2">
                  <Field label="Referensi gateway" value={t.gateway_ref_id} mono />
                  <Field label="Dibayar" value={t.paid_at && formatDateTime(t.paid_at)} />
                  <Field
                    label="Dicairkan ke mitra"
                    value={t.disbursed_at && formatDateTime(t.disbursed_at)}
                  />
                </FieldGrid>
              </div>
            ))}
          </div>
        )}
      </EntitySection>

      <EntitySection
        title={`Aliran dana internal (${order.wallet_flow.length})`}
        description="Pergerakan saldo dompet yang terikat ke pesanan ini: pembayaran, pendapatan mitra, refund, dan penyesuaian admin."
      >
        {order.wallet_flow.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada pergerakan saldo.</p>
        ) : (
          <div className="space-y-2">
            {order.wallet_flow.map((w) => (
              <div
                key={w.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{w.user_name}</span>
                    <Badge variant={walletTxTypeVariant(w.type)}>
                      {WALLET_TX_TYPE_LABELS[w.type] ?? w.type}
                    </Badge>
                    <Badge variant="info">
                      {WALLET_TX_CATEGORY_LABELS[w.category] ?? w.category}
                    </Badge>
                    <Badge variant={walletTxStatusVariant(w.status)}>
                      {WALLET_TX_STATUS_LABELS[w.status] ?? w.status}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {w.description} · {formatDateTime(w.created_at)}
                    {w.admin_fee > 0 && ` · biaya admin ${formatIDR(w.admin_fee)}`}
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">{formatIDR(w.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </EntitySection>

      <PaymentEventsSection orderId={order.id} />
    </div>
  );
}

function PaymentEventsSection({ orderId }: { orderId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['order-payment-events', orderId],
    queryFn: async () => {
      const res = await fetchAPI<OrderPaymentEvent[]>(`/admin/orders/${orderId}/payment-events`);
      if (!res.success) throw new Error(getErrorMessage(res));
      return res.data ?? [];
    },
  });

  const failed = (data ?? []).filter((e) => e.status === 'FAILED');

  return (
    <EntitySection
      title={`Webhook pembayaran (${data?.length ?? 0})`}
      description="Notifikasi mentah dari Midtrans. Yang berstatus gagal berarti pembayaran mungkin sudah masuk di gateway tetapi belum tercermin di pesanan."
    >
      {isLoading ? (
        <CenteredSpinner />
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada webhook untuk pesanan ini.</p>
      ) : (
        <div className="space-y-2">
          {failed.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                {failed.length} webhook gagal diproses. Cocokkan referensi gateway dengan dashboard
                Midtrans sebelum mengambil tindakan pada pesanan ini.
              </span>
            </div>
          )}
          {data.map((e) => (
            <div key={e.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={paymentEventStatusVariant(e.status)}>
                  {PAYMENT_EVENT_STATUS_LABELS[e.status] ?? e.status}
                </Badge>
                {e.event_type && <span className="text-sm">{e.event_type}</span>}
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(e.created_at)}
                </span>
              </div>
              <FieldGrid columns={2} className="mt-2">
                <Field label="Event ID" value={e.event_id} mono />
                <Field
                  label="Diproses"
                  value={e.processed_at && formatDateTime(e.processed_at)}
                />
              </FieldGrid>
              {e.error && (
                <p className="mt-2 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
                  {e.error}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </EntitySection>
  );
}
