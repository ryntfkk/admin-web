'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type { OrderDetailRow } from '@/types/admin';
import { formatDateTime } from '@/lib/format';
import { ORDER_STATUS_LABELS, orderStatusVariant } from '@/lib/enums';
import { Badge } from '@/components/ui/badge';
import { EntityPage, type EntityTab } from '@/components/ui/entity-page';
import { SummaryTab } from './_components/SummaryTab';
import { ItemsTab } from './_components/ItemsTab';
import { PaymentsTab } from './_components/PaymentsTab';
import { StatusHistoryTab } from './_components/StatusHistoryTab';
import { AdminControlTab } from './_components/AdminControlTab';
import { NotesTab } from './_components/NotesTab';

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
      {
        id: 'item',
        label: 'Item & Biaya',
        count: data.items.length + data.additional_fees.length,
        content: <ItemsTab order={data} />,
      },
      {
        id: 'pembayaran',
        label: 'Pembayaran',
        count: data.payments.length + data.wallet_flow.length,
        content: <PaymentsTab order={data} />,
      },
      { id: 'riwayat', label: 'Riwayat Status', content: <StatusHistoryTab orderId={orderId} /> },
      { id: 'kontrol', label: 'Kontrol Admin', content: <AdminControlTab order={data} /> },
      {
        id: 'catatan',
        label: 'Catatan',
        count: data.relations.note_count,
        content: <NotesTab orderId={orderId} />,
      },
    ]
    : [];

  return (
    <EntityPage
      backHref="/dashboard/transactions"
      backLabel="Semua transaksi"
      isLoading={isLoading}
      error={error}
      title={<span className="font-mono">{data?.order_number ?? '…'}</span>}
      subtitle={
        data && (
          <span>
            {data.customer.name} → {data.partner.name} · dibuat{' '}
            {formatDateTime(data.timestamps.created_at)}
          </span>
        )
      }
      badges={
        data && (
          <>
            <Badge variant={orderStatusVariant(data.status)}>
              {ORDER_STATUS_LABELS[data.status] || data.status}
            </Badge>
            {data.timestamps.paid_at ? (
              <Badge variant="success">Lunas</Badge>
            ) : (
              <Badge variant="neutral">Belum dibayar</Badge>
            )}
            {data.relations.dispute_id && (
              <Badge variant="danger">
                <ShieldAlert className="size-3" />
                Sengketa
              </Badge>
            )}
          </>
        )
      }
      tabs={tabs}
    />
  );
}
