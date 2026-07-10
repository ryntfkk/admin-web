'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, TrendingUp, TrendingDown, ArrowUpDown, Wallet } from 'lucide-react';
import { fetchAPI, qs } from '@/lib/api';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type { FinancialSummary, WalletRow, AllTransactionRow } from '@/types/admin';
import { nstr } from '@/lib/sql';
import { formatDateTime } from '@/lib/format';
import {
  WALLET_TX_CATEGORY_LABELS,
  WALLET_TX_TYPE_LABELS,
  WALLET_TX_STATUS_LABELS,
  walletTxTypeVariant,
  walletTxStatusVariant,
} from '@/lib/enums';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { CenteredSpinner, EmptyState } from '@/components/ui/feedback';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const PER_PAGE = 20;

export default function FinancialPage() {
  const [category, setCategory] = useState('');
  const [txType, setTxType] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Fetch summary
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['financial-summary'],
    queryFn: async () => {
      const res = await fetchAPI<FinancialSummary>('/admin/financial/summary');
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  // Fetch transactions
  const { data, isLoading } = useQuery({
    queryKey: ['financial-transactions', category, txType, status, search, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<AllTransactionRow>>(
        `/admin/financial/transactions${qs({ category, type: txType, status, search, page, per_page: PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  const formatIDR = (amount: number | null | undefined) => {
    if (!amount && amount !== 0) return '-';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Keuangan</h1>
        <p className="text-sm text-muted-foreground">Overview finansial platform</p>
      </div>

      {/* Summary Cards */}
      {summaryLoading ? (
        <CenteredSpinner />
      ) : summary ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <SummaryCard
            title="Total Pendapatan"
            value={formatIDR(summary.total_earnings)}
            icon={<TrendingUp className="size-5 text-emerald-500" />}
            variant="success"
          />
          <SummaryCard
            title="Total Refund"
            value={formatIDR(summary.total_refunds)}
            icon={<TrendingDown className="size-5 text-rose-500" />}
            variant="danger"
          />
          <SummaryCard
            title="Total Penarikan"
            value={formatIDR(summary.total_withdrawals)}
            icon={<ArrowUpDown className="size-5 text-amber-500" />}
            variant="warning"
          />
          <SummaryCard
            title="Total Pembayaran"
            value={formatIDR(summary.total_payments)}
            icon={<Wallet className="size-5 text-blue-500" />}
            variant="info"
          />
          <SummaryCard
            title="Total Top-up"
            value={formatIDR(summary.total_topups)}
            icon={<DollarSign className="size-5 text-purple-500" />}
            variant="default"
          />
        </div>
      ) : null}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Filter:</span>
          <div className="w-36">
            <Select
              value={category}
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
          <div className="w-48">
            <Input
              placeholder="Cari nama user..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      {isLoading ? (
        <CenteredSpinner />
      ) : rows.length === 0 ? (
        <EmptyState title="Tidak ada transaksi" note="Belum ada transaksi untuk filter ini." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Jumlah</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Deskripsi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(tx.created_at)}
                  </TableCell>
                  <TableCell className="font-medium">{tx.user_name}</TableCell>
                  <TableCell>
                    <Badge variant="info">
                      {WALLET_TX_CATEGORY_LABELS[tx.category] || tx.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={walletTxTypeVariant(tx.type)}>
                      {WALLET_TX_TYPE_LABELS[tx.type] || tx.type}
                    </Badge>
                  </TableCell>
                  <TableCell className={tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'}>
                    {tx.type === 'CREDIT' ? '+' : '-'}
                    {formatIDR(tx.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={walletTxStatusVariant(tx.status)}>
                      {WALLET_TX_STATUS_LABELS[tx.status] || tx.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {nstr(tx.description) || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />
        </>
      )}
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
    success: 'border-emerald-200 bg-emerald-50/50',
    danger: 'border-rose-200 bg-rose-50/50',
    warning: 'border-amber-200 bg-amber-50/50',
    info: 'border-blue-200 bg-blue-50/50',
  };

  return (
    <div className={`rounded-lg border p-4 ${variantStyles[variant]}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        {icon}
      </div>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
