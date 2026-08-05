'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchAPI, qs } from '@/lib/api';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type {
  LoginHistoryRow,
  OrderRow,
  AllTransactionRow,
  ChatRoomRow,
  DeletionArchiveRow,
} from '@/types/admin';
import { nstr, ntime } from '@/lib/sql';
import { formatDateTime, formatIDR } from '@/lib/format';
import {
  LOGIN_EVENT_LABELS,
  loginEventVariant,
  ORDER_STATUS_LABELS,
  orderStatusVariant,
  WALLET_TX_CATEGORY_LABELS,
  WALLET_TX_TYPE_LABELS,
  walletTxTypeVariant,
} from '@/lib/enums';
import { Badge } from '@/components/ui/badge';
import { Field, FieldGrid } from '@/components/ui/field';
import { DataTable, type Column } from '@/components/ui/data-table';
import { CenteredSpinner, EmptyState } from '@/components/ui/feedback';
import { Pagination } from '@/components/ui/pagination';

const TAB_PER_PAGE = 10;

/**
 * Tab forensik per-pengguna. Dipisah dari halaman detail supaya masing-masing
 * mengambil datanya sendiri . hanya tab yang sedang dibuka yang memanggil API.
 */

export function LoginHistoryTab({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useQuery({
    queryKey: ['user-login-history', userId, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<LoginHistoryRow>>(
        `/admin/users/${userId}/login-history${qs({ page, per_page: TAB_PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const columns: Column<LoginHistoryRow>[] = [
    {
      key: 'time',
      header: 'Waktu',
      cell: (r) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.created_at)}</span>,
    },
    {
      key: 'event',
      header: 'Event',
      cell: (r) => (
        <Badge variant={loginEventVariant(r.event_type)}>
          {LOGIN_EVENT_LABELS[r.event_type] || r.event_type}
        </Badge>
      ),
    },
    {
      key: 'identifier',
      header: 'Identifier',
      cell: (r) => <span className="text-muted-foreground">{r.identifier || '-'}</span>,
      hideBelow: 'sm',
    },
    {
      key: 'ip',
      header: 'IP',
      cell: (r) => <span className="font-mono text-xs">{r.ip_address || '-'}</span>,
      hideBelow: 'md',
    },
    {
      key: 'ua',
      header: 'Perangkat',
      cell: (r) => (
        <span
          className="block max-w-[220px] truncate text-xs text-muted-foreground"
          title={r.user_agent || ''}
        >
          {r.user_agent || '-'}
        </span>
      ),
      hideBelow: 'lg',
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={data?.data}
      getRowId={(r) => r.id}
      isLoading={isLoading}
      error={error}
      emptyTitle="Belum ada riwayat"
      emptyNote="Login & percobaan login akan tercatat di sini."
      showDensityToggle={false}
      page={page}
      perPage={TAB_PER_PAGE}
      total={data?.pagination?.total ?? 0}
      onPageChange={setPage}
    />
  );
}

export function UserOrdersTab({ userId }: { userId: string }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useQuery({
    queryKey: ['user-orders', userId, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<OrderRow>>(
        `/admin/orders${qs({ user_id: userId, page, per_page: TAB_PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const columns: Column<OrderRow>[] = [
    { key: 'no', header: 'No. Order', cell: (o) => <span className="font-mono text-xs">{o.order_number}</span> },
    {
      key: 'status',
      header: 'Status',
      cell: (o) => (
        <Badge variant={orderStatusVariant(o.status)}>
          {ORDER_STATUS_LABELS[o.status] || o.status}
        </Badge>
      ),
    },
    { key: 'price', header: 'Nilai', cell: (o) => formatIDR(o.agreed_price) },
    {
      key: 'customer',
      header: 'Pelanggan',
      cell: (o) => <span className="text-muted-foreground">{o.customer_name}</span>,
      hideBelow: 'md',
    },
    {
      key: 'partner',
      header: 'Mitra',
      cell: (o) => <span className="text-muted-foreground">{o.partner_name}</span>,
      hideBelow: 'md',
    },
    {
      key: 'created',
      header: 'Dibuat',
      cell: (o) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(o.created_at)}</span>,
      hideBelow: 'lg',
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={data?.data}
      getRowId={(o) => o.id}
      isLoading={isLoading}
      error={error}
      emptyTitle="Tidak ada order"
      emptyNote="User ini belum punya order."
      onRowClick={(o) => router.push(`/dashboard/transactions/${o.id}`)}
      showDensityToggle={false}
      page={page}
      perPage={TAB_PER_PAGE}
      total={data?.pagination?.total ?? 0}
      onPageChange={setPage}
    />
  );
}

export function UserTransactionsTab({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useQuery({
    queryKey: ['user-transactions', userId, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<AllTransactionRow>>(
        `/admin/financial/transactions${qs({ user_id: userId, page, per_page: TAB_PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const columns: Column<AllTransactionRow>[] = [
    {
      key: 'time',
      header: 'Waktu',
      cell: (t) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(t.created_at)}</span>,
    },
    {
      key: 'category',
      header: 'Kategori',
      cell: (t) => WALLET_TX_CATEGORY_LABELS[t.category] || t.category,
      hideBelow: 'sm',
    },
    {
      key: 'type',
      header: 'Tipe',
      cell: (t) => (
        <Badge variant={walletTxTypeVariant(t.type)}>
          {WALLET_TX_TYPE_LABELS[t.type] || t.type}
        </Badge>
      ),
    },
    {
      key: 'amount',
      header: 'Jumlah',
      cell: (t) => (
        <span className={t.type === 'CREDIT' ? 'text-success' : 'text-destructive'}>
          {t.type === 'CREDIT' ? '+' : '-'}
          {formatIDR(t.amount)}
        </span>
      ),
    },
    { key: 'status', header: 'Status', cell: (t) => <span className="text-muted-foreground">{t.status}</span>, hideBelow: 'md' },
    {
      key: 'ref',
      header: 'Referensi',
      cell: (t) => (
        <span className="font-mono text-xs text-muted-foreground">
          {t.order_number || nstr(t.bank_account_number) || '-'}
        </span>
      ),
      hideBelow: 'lg',
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={data?.data}
      getRowId={(t) => t.id}
      isLoading={isLoading}
      error={error}
      emptyTitle="Tidak ada transaksi"
      emptyNote="Belum ada transaksi dompet untuk user ini."
      showDensityToggle={false}
      page={page}
      perPage={TAB_PER_PAGE}
      total={data?.pagination?.total ?? 0}
      onPageChange={setPage}
    />
  );
}

export function UserChatsTab({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['user-chats', userId, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<ChatRoomRow>>(
        `/admin/chat/rooms${qs({ user_id: userId, page, per_page: TAB_PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  if (isLoading) return <CenteredSpinner />;
  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  if (rows.length === 0)
    return <EmptyState title="Tidak ada chat" note="User ini belum punya percakapan." />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Isi percakapan dapat dibuka di menu Chat. Setiap akses baca chat oleh admin tercatat di
        Audit Log.
      </p>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-md border border-border p-2.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                {r.customer_name} ↔ {r.partner_name}
              </span>
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {ntime(r.last_message_at) ? formatDateTime(ntime(r.last_message_at)) : '-'}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {nstr(r.last_message) || 'Belum ada pesan'}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">Room: {r.id}</p>
          </div>
        ))}
      </div>
      <Pagination page={page} perPage={TAB_PER_PAGE} total={total} onPageChange={setPage} />
    </div>
  );
}

export function DeletionArchiveTab({ userId }: { userId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['user-deletion-archive', userId],
    queryFn: async () => {
      const res = await fetchAPI<DeletionArchiveRow>(`/admin/users/${userId}/archive`);
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  if (isLoading) return <CenteredSpinner />;
  if (isError || !data)
    return (
      <EmptyState
        title="Arsip tidak ditemukan"
        note="Akun ini dihapus sebelum sistem arsip identitas aktif."
      />
    );

  return (
    <div className="space-y-3">
      <p className="rounded-md border border-border bg-muted/50 p-2.5 text-xs text-muted-foreground">
        Snapshot identitas yang diambil otomatis sesaat sebelum akun dihapus. Data ini untuk
        kebutuhan hukum/forensik.
      </p>
      <FieldGrid>
        <Field label="Nama asli" value={data.name} />
        <Field label="Username" value={`@${data.username}`} />
        <Field label="Telepon" value={nstr(data.phone)} />
        <Field label="Email" value={nstr(data.email)} />
        <Field label="Bank" value={nstr(data.bank_code)} />
        <Field label="No. rekening" value={nstr(data.bank_account_number)} />
        <Field label="Nama pemilik rekening" value={nstr(data.bank_account_name)} />
        <Field label="Saldo saat dihapus" value={formatIDR(data.balance)} />
        <Field label="Terdaftar" value={formatDateTime(data.user_created_at)} />
        <Field label="Dihapus" value={formatDateTime(data.deleted_at)} />
        <Field label="Role" value={(data.roles || []).join(', ') || data.active_role} />
        <Field label="User ID" value={data.user_id} mono />
      </FieldGrid>
    </div>
  );
}
