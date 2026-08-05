'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Download, ShieldAlert } from 'lucide-react';
import { fetchAPI, qs } from '@/lib/api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type { OrderRow, OrdersSummary } from '@/types/admin';
import { formatDateTime, formatIDR, formatNumber } from '@/lib/format';
import { toCSV, downloadCSV } from '@/lib/csv';
import { toast } from '@/lib/store/toastStore';
import {
  ORDER_STATUS_OPTIONS,
  ORDER_STATUS_LABELS,
  ORDER_PAYMENT_OPTIONS,
  ORDER_SORT_OPTIONS,
  orderStatusVariant,
} from '@/lib/enums';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DataTable, type Column } from '@/components/ui/data-table';

const PER_PAGE = 20;

/** Batas baris ekspor. Panel ini menembak API produksi dari laptop . menarik
 *  puluhan ribu baris hanya untuk sebuah CSV membebani server tanpa alasan.
 *  Batasnya DIKATAKAN ke admin saat tercapai, bukan dipotong diam-diam. */
const EXPORT_MAX = 2000;
const EXPORT_PER_PAGE = 200;

export default function TransactionsPage() {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [payment, setPayment] = useState('');
  const [sort, setSort] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  // Pencarian langsung: hasil menyusul 300ms setelah admin berhenti mengetik.
  const search = useDebouncedValue(searchInput.trim(), 300);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const filters = { status, q: search, payment, sort, date_from: dateFrom, date_to: dateTo };

  // Mengubah filter apa pun harus kembali ke halaman 1: halaman 7 dari hasil
  // lama hampir selalu kosong pada hasil baru.
  function updateFilter(set: (v: string) => void) {
    return (value: string) => {
      set(value);
      setPage(1);
    };
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['orders', filters, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<OrderRow>>(
        `/admin/orders${qs({ ...filters, page, per_page: PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  // Ringkasan mengikuti filter yang sama . angkanya menjelaskan apa yang
  // sedang dilihat, bukan seluruh isi tabel orders.
  const { data: summary } = useQuery({
    queryKey: ['orders-summary', filters],
    queryFn: async () => {
      const res = await fetchAPI<OrdersSummary>(`/admin/orders/summary${qs(filters)}`);
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  async function handleExport() {
    setExporting(true);
    try {
      const rows: OrderRow[] = [];
      for (let p = 1; rows.length < EXPORT_MAX; p += 1) {
        const res = await fetchAPI<PaginatedData<OrderRow>>(
          `/admin/orders${qs({ ...filters, page: p, per_page: EXPORT_PER_PAGE })}`,
        );
        if (!res.success || !res.data) throw new Error(getErrorMessage(res));
        const batch = res.data.data ?? [];
        rows.push(...batch);
        // Berhenti pada halaman terakhir . mengandalkan `total` saja
        // membuat loop berputar selamanya bila hitungannya meleset dari isi
        // halaman (mis. baris terhapus di tengah ekspor).
        if (batch.length < EXPORT_PER_PAGE) break;
      }

      if (rows.length === 0) {
        toast.error('Tidak ada data untuk diekspor');
        return;
      }

      const csv = toCSV(
        [
          'No. Order',
          'Status',
          'Pelanggan',
          'Mitra',
          'Jenis mitra',
          'Nilai',
          'Diskon',
          'Komisi platform',
          'Refund',
          'Metode bayar',
          'Dibayar',
          'Jadwal',
          'Dibuat',
          'Selesai',
          'Sengketa',
        ],
        rows.map((o) => [
          o.order_number,
          ORDER_STATUS_LABELS[o.status] || o.status,
          o.customer_name,
          o.partner_name,
          o.partner_type,
          o.agreed_price,
          o.discount_amount,
          o.platform_fee ?? '',
          o.refunded_amount ?? '',
          o.payment_method ?? '',
          o.paid_at ? formatDateTime(o.paid_at) : '',
          formatDateTime(o.scheduled_at),
          formatDateTime(o.created_at),
          o.completed_at ? formatDateTime(o.completed_at) : '',
          o.has_dispute ? 'Ya' : '',
        ]),
      );
      downloadCSV(`transaksi-${new Date().toISOString().slice(0, 10)}.csv`, csv);

      toast.success(
        rows.length >= EXPORT_MAX
          ? `${formatNumber(rows.length)} baris diekspor (dibatasi ${formatNumber(EXPORT_MAX)}) . persempit filter untuk sisanya`
          : `${formatNumber(rows.length)} baris diekspor`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ekspor gagal');
    } finally {
      setExporting(false);
    }
  }

  const columns: Column<OrderRow>[] = [
    {
      key: 'no',
      header: 'No. Order',
      cell: (o) => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-medium">{o.order_number}</span>
          {o.has_dispute && (
            <ShieldAlert className="size-3.5 shrink-0 text-destructive" aria-label="Ada sengketa" />
          )}
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Pelanggan',
      cell: (o) => o.customer_name,
    },
    {
      key: 'partner',
      header: 'Mitra',
      cell: (o) => <span className="text-muted-foreground">{o.partner_name}</span>,
      hideBelow: 'md',
    },
    {
      key: 'schedule',
      header: 'Jadwal kerja',
      cell: (o) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatDateTime(o.scheduled_at)}
        </span>
      ),
      hideBelow: 'lg',
    },
    {
      key: 'amount',
      header: 'Nominal',
      align: 'right',
      cell: (o) => <span className="tabular-nums">{formatIDR(o.agreed_price)}</span>,
    },
    {
      key: 'payment',
      header: 'Pembayaran',
      // Dibedakan dari status order: sebuah order bisa berstatus
      // WAITING_CONFIRMATION tetapi dananya sudah masuk, dan sebaliknya.
      cell: (o) =>
        o.paid_at ? (
          <div className="flex flex-col">
            <Badge variant="success">Lunas</Badge>
            {o.payment_method && (
              <span className="mt-0.5 text-[11px] text-muted-foreground">{o.payment_method}</span>
            )}
          </div>
        ) : (
          <Badge variant="neutral">Belum</Badge>
        ),
      hideBelow: 'md',
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
      hideBelow: 'xl',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Transaksi</h1>
        <p className="text-sm text-muted-foreground">
          Semua pesanan di platform . klik baris untuk item pesanan, rincian biaya, pembayaran,
          riwayat status, dan kontrol admin.
        </p>
      </div>

      {summary && <SummaryBar summary={summary} />}

      <DataTable
        columns={columns}
        rows={data?.data}
        getRowId={(o) => o.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="Tidak ada transaksi"
        emptyNote="Coba ubah filter atau perluas rentang tanggal."
        onRowClick={(o) => router.push(`/dashboard/transactions/${o.id}`)}
        page={page}
        perPage={PER_PAGE}
        total={data?.pagination?.total ?? 0}
        onPageChange={setPage}
        actions={
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="size-4" />
            {exporting ? 'Mengekspor…' : 'Ekspor CSV'}
          </Button>
        }
        toolbar={
          <>
            <div className="min-w-52 flex-1">
              <Input
                value={searchInput}
                placeholder="Cari no. order, nama pelanggan/mitra, atau no. HP…"
                aria-label="Cari transaksi"
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="w-48">
              <Select
                value={status}
                aria-label="Filter status order"
                onChange={(e) => updateFilter(setStatus)(e.target.value)}
              >
                {ORDER_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-44">
              <Select
                value={payment}
                aria-label="Filter status pembayaran"
                onChange={(e) => updateFilter(setPayment)(e.target.value)}
              >
                {ORDER_PAYMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-44">
              <Select
                value={sort}
                aria-label="Urutkan"
                onChange={(e) => updateFilter(setSort)(e.target.value)}
              >
                {ORDER_SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={dateFrom}
                aria-label="Dibuat dari tanggal"
                className="w-[9.5rem]"
                onChange={(e) => updateFilter(setDateFrom)(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">–</span>
              <Input
                type="date"
                value={dateTo}
                aria-label="Dibuat sampai tanggal"
                className="w-[9.5rem]"
                onChange={(e) => updateFilter(setDateTo)(e.target.value)}
              />
            </div>
          </>
        }
      />
    </div>
  );
}

function SummaryBar({ summary }: { summary: OrdersSummary }) {
  const items: { label: string; value: string; hint?: string }[] = [
    { label: 'Transaksi', value: formatNumber(summary.total_orders) },
    { label: 'Nilai total', value: formatIDR(summary.total_value) },
    { label: 'Komisi platform', value: formatIDR(summary.total_platform_fee), hint: 'hanya order selesai' },
    { label: 'Total refund', value: formatIDR(summary.total_refunded) },
    {
      label: 'Selesai / Batal / Sengketa',
      value: `${formatNumber(summary.completed_count)} / ${formatNumber(summary.cancelled_count)} / ${formatNumber(summary.disputed_count)}`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {items.map((it) => (
        <div key={it.label} className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">{it.label}</p>
          <p className="mt-0.5 font-semibold tabular-nums break-words">{it.value}</p>
          {it.hint && <p className="text-[11px] text-muted-foreground">{it.hint}</p>}
        </div>
      ))}
    </div>
  );
}
