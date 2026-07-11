'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, Search, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchAPI, qs } from '@/lib/api';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type { OrderRow, OrderDetailRow, OrderStatusHistoryRow } from '@/types/admin';
import { nstr, ntime } from '@/lib/sql';
import { formatDateTime, formatIDR } from '@/lib/format';
import { ORDER_STATUS_OPTIONS, ORDER_STATUS_LABELS, orderStatusVariant } from '@/lib/enums';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { CenteredSpinner, EmptyState } from '@/components/ui/feedback';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

const PER_PAGE = 20;

export default function TransactionsPage() {
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', status, search, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<OrderRow>>(
        `/admin/orders${qs({ status, q: search, page, per_page: PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Transaksi</h1>
        <p className="text-sm text-muted-foreground">Semua pesanan di platform</p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-56">
          <Select
            value={status}
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
        <div className="flex flex-1 gap-2">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari no. order…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSearch(searchInput.trim());
                setPage(1);
              }
            }}
          />
          <Button
            variant="outline"
            onClick={() => {
              setSearch(searchInput.trim());
              setPage(1);
            }}
          >
            <Search className="size-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <CenteredSpinner />
      ) : rows.length === 0 ? (
        <EmptyState title="Tidak ada transaksi" />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Order</TableHead>
                <TableHead>Pelanggan</TableHead>
                <TableHead>Mitra</TableHead>
                <TableHead>Nominal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dibuat</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono font-medium">{o.order_number}</TableCell>
                  <TableCell>{o.customer_name}</TableCell>
                  <TableCell className="text-muted-foreground">{o.partner_name}</TableCell>
                  <TableCell>{formatIDR(o.agreed_price)}</TableCell>
                  <TableCell>
                    <Badge variant={orderStatusVariant(o.status)}>
                      {ORDER_STATUS_LABELS[o.status] || o.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(o.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setSelectedId(o.id)}>
                      <Eye className="size-4" />
                      Detail
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />
        </>
      )}

      {selectedId && (
        <OrderDetailModal orderId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

function OrderDetailModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [showHistory, setShowHistory] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['order-detail', orderId],
    queryFn: async () => {
      const res = await fetchAPI<OrderDetailRow>(`/admin/orders/${orderId}`);
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const { data: historyData } = useQuery({
    queryKey: ['order-status-history', orderId],
    queryFn: async () => {
      const res = await fetchAPI<OrderStatusHistoryRow[]>(`/admin/orders/${orderId}/status-history`);
      if (!res.success) return [];
      return res.data || [];
    },
    enabled: showHistory,
  });

  return (
    <Modal open onClose={onClose} title="Detail Transaksi" className="max-w-2xl">
      {isLoading || !data ? (
        <CenteredSpinner />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono font-medium">{data.order_number}</span>
            <Badge variant={orderStatusVariant(data.status)}>
              {ORDER_STATUS_LABELS[data.status] || data.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Pelanggan" value={data.customer_name} />
            <Field label="Telepon pelanggan" value={nstr(data.customer_phone) || '-'} />
            <Field label="Mitra" value={data.partner_name} />
            <Field label="Telepon mitra" value={nstr(data.partner_phone) || '-'} />
            <Field label="Jadwal" value={formatDateTime(data.scheduled_at)} />
            <Field label="Dibuat" value={formatDateTime(data.created_at)} />
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground">Alamat</p>
            <p className="mt-0.5 text-sm">{data.address}</p>
            {nstr(data.notes) && (
              <p className="mt-1 text-sm text-muted-foreground">Catatan: {nstr(data.notes)}</p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <Row label="Harga layanan" value={formatIDR(data.total_service_price)} />
            <Row label="Biaya transport" value={formatIDR(data.transport_fee)} />
            <Row label="Biaya admin" value={formatIDR(data.admin_fee_customer)} />
            <Row label="Diskon" value={`- ${formatIDR(data.discount_amount)}`} />
            <div className="mt-2 border-t border-border pt-2">
              <Row label="Total disepakati" value={formatIDR(data.agreed_price)} bold />
            </div>
          </div>

          {nstr(data.cancellation_reason) && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Dibatalkan: {nstr(data.cancellation_reason)}
            </p>
          )}
          {ntime(data.completed_at) && (
            <p className="text-xs text-muted-foreground">
              Selesai pada {formatDateTime(ntime(data.completed_at))}
            </p>
          )}

          {/* Status History Section */}
          <div className="border-t border-border pt-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex w-full items-center justify-between text-sm font-medium"
            >
              <span className="flex items-center gap-2">
                <Clock className="size-4" />
                Riwayat Status
              </span>
              {showHistory ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>

            {showHistory && (
              <div className="mt-3 space-y-2">
                {historyData && historyData.length > 0 ? (
                  historyData.map((h, i) => (
                    <div key={h.id} className="flex gap-3 text-sm">
                      <div className="flex flex-col items-center">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                          {i + 1}
                        </div>
                        {i < historyData.length - 1 && <div className="h-4 w-px bg-border" />}
                      </div>
                      <div className="flex-1 pb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={orderStatusVariant(h.status)} className="text-xs">
                            {ORDER_STATUS_LABELS[h.status] || h.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(h.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {nstr(h.actor_name) || 'System'} ({nstr(h.actor_role) || 'system'})
                        </p>
                        {nstr(h.reason) && (
                          <p className="mt-1 text-xs text-muted-foreground">{nstr(h.reason)}</p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Memuat riwayat...</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? 'font-semibold' : ''}>{value}</span>
    </div>
  );
}
