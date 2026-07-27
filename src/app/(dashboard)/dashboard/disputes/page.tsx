'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchAPI, qs } from '@/lib/api';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type { DisputeRow } from '@/types/admin';
import { formatDateTime, formatIDR } from '@/lib/format';
import {
  DISPUTE_STATUS_OPTIONS,
  DISPUTE_STATUS_LABELS,
  DISPUTE_TYPE_LABELS,
  disputeStatusVariant,
} from '@/lib/enums';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { DataTable, type Column } from '@/components/ui/data-table';

const PER_PAGE = 20;

export default function DisputesPage() {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['disputes', status, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<DisputeRow>>(
        `/admin/disputes${qs({ status, page, per_page: PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const columns: Column<DisputeRow>[] = [
    {
      key: 'order',
      header: 'Order',
      cell: (d) => <span className="font-mono font-medium">{d.order_number}</span>,
    },
    {
      key: 'parties',
      header: 'Pihak',
      cell: (d) => (
        <div className="min-w-0 text-sm">
          <div className="truncate">{d.customer_name}</div>
          <div className="truncate text-xs text-muted-foreground">vs {d.partner_name}</div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Tipe',
      cell: (d) => (
        <span className="text-muted-foreground">
          {DISPUTE_TYPE_LABELS[d.dispute_type] || d.dispute_type}
        </span>
      ),
      hideBelow: 'md',
    },
    {
      key: 'amount',
      header: 'Nominal',
      align: 'right',
      cell: (d) => <span className="tabular-nums">{formatIDR(d.order_amount)}</span>,
      hideBelow: 'sm',
    },
    {
      key: 'evidence',
      header: 'Bukti',
      cell: (d) => (
        <div className="flex gap-1">
          {d.has_evidence && <Badge variant="info">Bukti</Badge>}
          {d.has_response && <Badge variant="neutral">Ditanggapi</Badge>}
        </div>
      ),
      hideBelow: 'lg',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (d) => (
        <Badge variant={disputeStatusVariant(d.status)}>
          {DISPUTE_STATUS_LABELS[d.status] || d.status}
        </Badge>
      ),
    },
    {
      key: 'created',
      header: 'Dibuat',
      cell: (d) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatDateTime(d.created_at)}
        </span>
      ),
      hideBelow: 'lg',
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sengketa</h1>
        <p className="text-sm text-muted-foreground">
          Mediasi sengketa pelanggan &amp; mitra — klik baris untuk membuka ruang sengketa dan form
          resolusi.
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={data?.data}
        getRowId={(d) => d.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="Tidak ada sengketa"
        emptyNote="Belum ada sengketa untuk filter ini."
        onRowClick={(d) => router.push(`/dashboard/disputes/${d.id}`)}
        page={page}
        perPage={PER_PAGE}
        total={data?.pagination?.total ?? 0}
        onPageChange={setPage}
        toolbar={
          <div className="w-48">
            <Select
              value={status}
              aria-label="Filter status sengketa"
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              {DISPUTE_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        }
      />
    </div>
  );
}
