'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchAPI, qs } from '@/lib/api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type { OrderRow } from '@/types/admin';
import { formatDateTime, formatIDR } from '@/lib/format';
import { ORDER_STATUS_OPTIONS, ORDER_STATUS_LABELS, orderStatusVariant } from '@/lib/enums';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DataTable, type Column } from '@/components/ui/data-table';

const PER_PAGE = 20;

export default function TransactionsPage() {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  // Pencarian langsung: hasil menyusul 300ms setelah admin berhenti mengetik.
  const search = useDebouncedValue(searchInput.trim(), 300);
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['orders', status, search, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<OrderRow>>(
        `/admin/orders${qs({ status, q: search, page, per_page: PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const columns: Column<OrderRow>[] = [
    {
      key: 'no',
      header: 'No. Order',
      cell: (o) => <span className="font-mono font-medium">{o.order_number}</span>,
    },
    { key: 'customer', header: 'Pelanggan', cell: (o) => o.customer_name },
    {
      key: 'partner',
      header: 'Mitra',
      cell: (o) => <span className="text-muted-foreground">{o.partner_name}</span>,
      hideBelow: 'md',
    },
    {
      key: 'amount',
      header: 'Nominal',
      align: 'right',
      cell: (o) => <span className="tabular-nums">{formatIDR(o.agreed_price)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (o) => (
        <Badge variant={orderStatusVariant(o.status)}>
          {ORDER_STATUS_LABELS[o.status] || o.status}
        </Badge>
      ),
    },
    {
      key: 'created',
      header: 'Dibuat',
      cell: (o) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatDateTime(o.created_at)}
        </span>
      ),
      hideBelow: 'lg',
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Transaksi</h1>
        <p className="text-sm text-muted-foreground">
          Semua pesanan di platform . klik baris untuk rincian biaya, riwayat status, dan kontrol
          admin.
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={data?.data}
        getRowId={(o) => o.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="Tidak ada transaksi"
        emptyNote="Coba ubah filter status atau pencarian."
        onRowClick={(o) => router.push(`/dashboard/transactions/${o.id}`)}
        page={page}
        perPage={PER_PAGE}
        total={data?.pagination?.total ?? 0}
        onPageChange={setPage}
        toolbar={
          <>
            <div className="w-56">
              <Select
                value={status}
                aria-label="Filter status order"
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                {ORDER_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-52 flex-1">
              <Input
                value={searchInput}
                placeholder="Cari no. order…"
                aria-label="Cari transaksi"
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </>
        }
      />
    </div>
  );
}
