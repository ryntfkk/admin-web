'use client';

import Link from 'next/link';
import type { OrderDetailRow } from '@/types/admin';
import { formatDateTime, formatIDR } from '@/lib/format';
import {
  ADDITIONAL_FEE_STATUS_LABELS,
  FEE_TYPE_LABELS,
  additionalFeeStatusVariant,
} from '@/lib/enums';
import { Badge } from '@/components/ui/badge';
import { EntitySection } from '@/components/ui/entity-page';
import { EmptyState } from '@/components/ui/feedback';
import { MoneyRow } from './shared';

/**
 * Apa yang sebenarnya dipesan.
 *
 * Tab ini tidak ada sebelum audit 2026-08-05: panel admin menampilkan nominal
 * sebuah transaksi tanpa pernah menyebut layanan apa yang dibeli.
 */
export function ItemsTab({ order }: { order: OrderDetailRow }) {
  const itemsTotal = order.items.reduce((n, it) => n + it.subtotal, 0);

  return (
    <div className="space-y-4">
      <EntitySection title={`Item pesanan (${order.items.length})`}>
        {order.items.length === 0 ? (
          <EmptyState
            title="Tidak ada item tercatat"
            note="Pesanan lama bisa saja dibuat sebelum item disimpan terpisah."
          />
        ) : (
          <div className="space-y-2">
            {order.items.map((it) => (
              <div
                key={it.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/dashboard/services?highlight=${it.service_id}`}
                      className="font-medium underline underline-offset-4"
                    >
                      {it.name}
                    </Link>
                    {it.variation_name && <Badge variant="info">{it.variation_name}</Badge>}
                    {it.service_deleted && (
                      // Penting saat menelusuri keluhan: layanannya sudah tidak
                      // ada, jadi admin tidak akan menemukannya di daftar layanan.
                      <Badge variant="danger">Layanan sudah dihapus</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {it.category_name} · {it.quantity} × {formatIDR(it.price)} · estimasi{' '}
                    {it.duration} menit
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">{formatIDR(it.subtotal)}</span>
              </div>
            ))}
            <div className="border-t border-border pt-2 text-sm">
              <MoneyRow label="Subtotal item" value={formatIDR(itemsTotal)} bold />
              {itemsTotal !== order.cost.total_service_price && (
                <p className="mt-1 text-xs text-warning">
                  Subtotal item berbeda dari harga layanan tercatat (
                  {formatIDR(order.cost.total_service_price)}).
                </p>
              )}
            </div>
          </div>
        )}
      </EntitySection>

      <EntitySection
        title={`Biaya tambahan (${order.additional_fees.length})`}
        description="Diajukan mitra saat pengerjaan. Yang berstatus menunggu persetujuan menahan pesanan di status WAITING_ADDITIONAL_PAY."
      >
        {order.additional_fees.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada biaya tambahan.</p>
        ) : (
          <div className="space-y-2">
            {order.additional_fees.map((f) => (
              <div
                key={f.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{f.name}</span>
                    <Badge variant="neutral">{FEE_TYPE_LABELS[f.fee_type] ?? f.fee_type}</Badge>
                    <Badge variant={additionalFeeStatusVariant(f.status)}>
                      {ADDITIONAL_FEE_STATUS_LABELS[f.status] ?? f.status}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {f.quantity} × {formatIDR(f.price)} · diajukan {formatDateTime(f.created_at)}
                    {f.paid_at && ` · dibayar ${formatDateTime(f.paid_at)}`}
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatIDR(f.total ?? f.price * f.quantity)}
                </span>
              </div>
            ))}
          </div>
        )}
      </EntitySection>
    </div>
  );
}
