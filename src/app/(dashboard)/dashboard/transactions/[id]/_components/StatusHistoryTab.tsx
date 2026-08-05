'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type { OrderStatusHistoryRow } from '@/types/admin';
import { formatDateTime } from '@/lib/format';
import {
  ORDER_STATUS_LABELS,
  orderStatusVariant,
  ACTOR_ROLE_LABELS,
  actorRoleVariant,
} from '@/lib/enums';
import { Badge } from '@/components/ui/badge';
import { EntitySection } from '@/components/ui/entity-page';
import { CenteredSpinner, EmptyState } from '@/components/ui/feedback';
import { formatDuration } from './shared';

/**
 * Riwayat transisi status.
 *
 * Versi sebelum audit 2026-08-05 membaca field `status` dan `actor_name` yang
 * TIDAK PERNAH dikirim backend (query-nya mengirim `from_status`/`to_status`),
 * jadi setiap baris tampil sebagai badge kosong bertuliskan "System (system)".
 * Aktornya juga memang belum pernah direkam sampai migrasi 000074 . baris lama
 * karena itu tetap tanpa nama, dan itu DIKATAKAN di bawah alih-alih dikarang.
 */
export function StatusHistoryTab({ orderId }: { orderId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['order-status-history', orderId],
    queryFn: async () => {
      const res = await fetchAPI<OrderStatusHistoryRow[]>(
        `/admin/orders/${orderId}/status-history`,
      );
      if (!res.success) throw new Error(getErrorMessage(res));
      return res.data ?? [];
    },
  });

  if (isLoading) return <CenteredSpinner />;
  if (error)
    return <EmptyState title="Gagal memuat riwayat" note={(error as Error).message} />;
  if (!data || data.length === 0)
    return <EmptyState title="Belum ada riwayat" note="Perubahan status akan tercatat di sini." />;

  return (
    <EntitySection
      title="Riwayat status"
      description="Setiap perubahan status pesanan, siapa yang melakukannya, dan berapa lama pesanan tertahan di status sebelumnya."
    >
      <ol className="space-y-1">
        {data.map((h, i) => (
          <li key={h.id} className="flex gap-3 text-sm">
            <div className="flex flex-col items-center">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">
                {i + 1}
              </span>
              {i < data.length - 1 && <span className="w-px flex-1 bg-border" />}
            </div>

            <div className="min-w-0 flex-1 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                {h.from_status && (
                  <>
                    <Badge variant={orderStatusVariant(h.from_status)}>
                      {ORDER_STATUS_LABELS[h.from_status] || h.from_status}
                    </Badge>
                    <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                  </>
                )}
                <Badge variant={orderStatusVariant(h.to_status)}>
                  {ORDER_STATUS_LABELS[h.to_status] || h.to_status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(h.created_at)}
                </span>
                {h.duration_from_prev_seconds !== null && (
                  <span className="text-xs text-muted-foreground/70">
                    +{formatDuration(h.duration_from_prev_seconds)}
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant={actorRoleVariant(h.actor_role)}>
                  {ACTOR_ROLE_LABELS[h.actor_role] ?? h.actor_role}
                </Badge>
                {h.actor_name ? (
                  <span className="text-xs text-muted-foreground">{h.actor_name}</span>
                ) : h.actor_role === 'system' ? (
                  <span className="text-xs text-muted-foreground">transisi otomatis</span>
                ) : (
                  <span className="text-xs text-muted-foreground/70">nama pelaku tidak tercatat</span>
                )}
              </div>

              {h.reason && (
                <p className="mt-1 rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
                  {h.reason}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </EntitySection>
  );
}
