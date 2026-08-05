'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpDown, DollarSign, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { fetchAPI, qs } from '@/lib/api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type { AllTransactionRow, FinancialSummary, WalletRow } from '@/types/admin';
import { nstr } from '@/lib/sql';
import { formatDateTime, formatIDRorDash as formatIDR } from '@/lib/format';
import {
  WALLET_TX_CATEGORY_LABELS,
  WALLET_TX_TYPE_LABELS,
  WALLET_TX_STATUS_LABELS,
  walletTxTypeVariant,
  walletTxStatusVariant,
} from '@/lib/enums';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EntityPage, EntitySection, type EntityTab } from '@/components/ui/entity-page';
import { CenteredSpinner } from '@/components/ui/feedback';

const PER_PAGE = 20;

export default function FinancialPage() {
  const tabs: EntityTab[] = [
    { id: 'ringkasan', label: 'Ringkasan', content: <SummaryTab /> },
    { id: 'ledger', label: 'Ledger', content: <LedgerTab /> },
    { id: 'saldo', label: 'Saldo Pengguna', content: <WalletsTab /> },
  ];

  return (
    <EntityPage
      title="Keuangan"
      subtitle="Ringkasan finansial, ledger transaksi dompet, dan saldo per pengguna."
      tabs={tabs}
      className="max-w-7xl"
    />
  );
}

function SummaryTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['financial-summary'],
    queryFn: async () => {
      const res = await fetchAPI<FinancialSummary>('/admin/financial/summary');
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  if (isLoading) return <CenteredSpinner />;
  if (!data) return null;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
      <SummaryCard
        title="Total Pendapatan"
        value={formatIDR(data.total_earnings)}
        icon={<TrendingUp className="size-5 text-success" />}
        variant="success"
      />
      <SummaryCard
        title="Total Refund"
        value={formatIDR(data.total_refunds)}
        icon={<TrendingDown className="size-5 text-destructive" />}
        variant="danger"
      />
      <SummaryCard
        title="Total Penarikan"
        value={formatIDR(data.total_withdrawals)}
        icon={<ArrowUpDown className="size-5 text-warning" />}
        variant="warning"
      />
      <SummaryCard
        title="Total Pembayaran"
        value={formatIDR(data.total_payments)}
        icon={<Wallet className="size-5 text-info" />}
        variant="info"
      />
      <SummaryCard
        title="Total Top-up"
        value={formatIDR(data.total_topups)}
        icon={<DollarSign className="size-5 text-muted-foreground" />}
        variant="default"
      />
    </div>
  );
}

function LedgerTab() {
  const [category, setCategory] = useState('');
  const [txType, setTxType] = useState('');
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 300);
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['financial-transactions', category, txType, status, search, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<AllTransactionRow>>(
        `/admin/financial/transactions${qs({ category, type: txType, status, search, page, per_page: PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const columns: Column<AllTransactionRow>[] = [
    {
      key: 'time',
      header: 'Tanggal',
      cell: (t) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatDateTime(t.created_at)}
        </span>
      ),
    },
    { key: 'user', header: 'User', cell: (t) => <span className="font-medium">{t.user_name}</span> },
    {
      key: 'category',
      header: 'Kategori',
      cell: (t) => (
        <Badge variant="info">{WALLET_TX_CATEGORY_LABELS[t.category] || t.category}</Badge>
      ),
      hideBelow: 'md',
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
      align: 'right',
      cell: (t) => (
        <span
          className={`tabular-nums ${t.type === 'CREDIT' ? 'text-success' : 'text-destructive'}`}
        >
          {t.type === 'CREDIT' ? '+' : '-'}
          {formatIDR(t.amount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (t) => (
        <Badge variant={walletTxStatusVariant(t.status)}>
          {WALLET_TX_STATUS_LABELS[t.status] || t.status}
        </Badge>
      ),
      hideBelow: 'sm',
    },
    {
      key: 'desc',
      header: 'Deskripsi',
      cell: (t) => (
        <span className="block max-w-[200px] truncate text-muted-foreground">
          {nstr(t.description) || '-'}
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
      emptyNote="Belum ada transaksi untuk filter ini."
      page={page}
      perPage={PER_PAGE}
      total={data?.pagination?.total ?? 0}
      onPageChange={setPage}
      toolbar={
        <>
          <div className="w-36">
            <Select
              value={category}
              aria-label="Filter kategori"
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua kategori</option>
              <option value="EARNING">Pendapatan</option>
              <option value="REFUND">Refund</option>
              <option value="WITHDRAWAL">Penarikan</option>
              <option value="TOPUP">Top-up</option>
              <option value="PAYMENT">Pembayaran</option>
            </Select>
          </div>
          <div className="w-32">
            <Select
              value={txType}
              aria-label="Filter tipe"
              onChange={(e) => {
                setTxType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua tipe</option>
              <option value="CREDIT">Masuk</option>
              <option value="DEBIT">Keluar</option>
            </Select>
          </div>
          <div className="w-32">
            <Select
              value={status}
              aria-label="Filter status"
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua status</option>
              <option value="PENDING">Pending</option>
              <option value="COMPLETED">Selesai</option>
              <option value="FAILED">Gagal</option>
            </Select>
          </div>
          <div className="min-w-48 flex-1">
            <Input
              placeholder="Cari nama user…"
              aria-label="Cari transaksi"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </>
      }
    />
  );
}

/**
 * Saldo per pengguna.
 *
 * Memakai `GET /admin/financial/wallets` yang sudah lama ada di backend tapi
 * TIDAK pernah dipanggil UI mana pun . sehingga admin bisa menyesuaikan saldo
 * seseorang tanpa pernah bisa melihat daftar saldo seluruh platform.
 */
function WalletsTab() {
  const router = useRouter();
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['financial-wallets', page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<WalletRow>>(
        `/admin/financial/wallets${qs({ page, per_page: PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const columns: Column<WalletRow>[] = [
    {
      key: 'user',
      header: 'Pengguna',
      cell: (w) => <span className="font-medium">{w.user_name}</span>,
    },
    {
      key: 'credits',
      header: 'Total masuk',
      align: 'right',
      cell: (w) => <span className="tabular-nums text-success">{formatIDR(w.total_credits)}</span>,
      hideBelow: 'sm',
    },
    {
      key: 'debits',
      header: 'Total keluar',
      align: 'right',
      cell: (w) => (
        <span className="tabular-nums text-destructive">{formatIDR(w.total_debits)}</span>
      ),
      hideBelow: 'sm',
    },
    {
      key: 'balance',
      header: 'Saldo (ledger)',
      align: 'right',
      cell: (w) => <span className="font-medium tabular-nums">{formatIDR(w.balance)}</span>,
    },
  ];

  return (
    <div className="space-y-3">
      <EntitySection>
        <p className="text-sm text-muted-foreground">
          Angka di sini dihitung dari <strong>ledger</strong> (<code>wallet_transactions</code>):
          total masuk dikurangi total keluar. Itu <em>bukan</em> otomatis sama dengan saldo yang bisa
          dibelanjakan pengguna . bila keduanya berbeda, berarti ada perpindahan uang yang tak
          tercatat di ledger dan perlu ditelusuri. Klik baris untuk melihat saldo aktual beserta
          riwayat transaksinya.
        </p>
      </EntitySection>

      <DataTable
        columns={columns}
        rows={data?.data}
        getRowId={(w) => w.user_id}
        isLoading={isLoading}
        error={error}
        emptyTitle="Belum ada data saldo"
        onRowClick={(w) => router.push(`/dashboard/users/${w.user_id}?tab=transaksi`)}
        page={page}
        perPage={PER_PAGE}
        total={data?.pagination?.total ?? 0}
        onPageChange={setPage}
      />
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  variant,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  variant: 'default' | 'success' | 'danger' | 'warning' | 'info';
}) {
  const variantStyles: Record<string, string> = {
    default: 'border-border',
    success: 'border-success/30 bg-success/8',
    danger: 'border-destructive/30 bg-destructive/8',
    warning: 'border-warning/30 bg-warning/8',
    info: 'border-info/30 bg-info/8',
  };

  return (
    <div className={`rounded-xl border p-4 ${variantStyles[variant]}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        {icon}
      </div>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
