'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, Paperclip, MessageSquare } from 'lucide-react';
import { fetchAPI, qs } from '@/lib/api';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type { DisputeRow, DisputeDetailRow } from '@/types/admin';
import { nstr, nint, ntime, nenum } from '@/lib/sql';
import { formatDateTime, formatIDR } from '@/lib/format';
import { toast } from '@/lib/store/toastStore';
import {
  DISPUTE_STATUS_OPTIONS,
  DISPUTE_STATUS_LABELS,
  DISPUTE_TYPE_LABELS,
  RESOLUTION_TYPE_OPTIONS,
  disputeStatusVariant,
} from '@/lib/enums';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { CenteredSpinner, EmptyState } from '@/components/ui/feedback';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

const PER_PAGE = 20;

export default function DisputesPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['disputes', status, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<DisputeRow>>(
        `/admin/disputes${qs({ status, page, per_page: PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sengketa</h1>
          <p className="text-sm text-muted-foreground">Mediasi sengketa pelanggan &amp; mitra</p>
        </div>
        <div className="w-48">
          <Select
            value={status}
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
      </div>

      {isLoading ? (
        <CenteredSpinner />
      ) : rows.length === 0 ? (
        <EmptyState title="Tidak ada sengketa" note="Belum ada sengketa untuk filter ini." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Pihak</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Nominal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dibuat</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1.5">
                      {d.order_number}
                      {d.has_evidence && <Paperclip className="size-3.5 text-muted-foreground" />}
                      {d.has_response && (
                        <MessageSquare className="size-3.5 text-muted-foreground" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.customer_name} <span className="opacity-50">vs</span> {d.partner_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {DISPUTE_TYPE_LABELS[d.dispute_type] || d.dispute_type}
                  </TableCell>
                  <TableCell>{formatIDR(d.order_amount)}</TableCell>
                  <TableCell>
                    <Badge variant={disputeStatusVariant(d.status)}>
                      {DISPUTE_STATUS_LABELS[d.status] || d.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(d.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setSelectedId(d.id)}>
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
        <DisputeDetailModal
          disputeId={selectedId}
          onClose={() => setSelectedId(null)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ['disputes'] });
            qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
          }}
        />
      )}
    </div>
  );
}

function DisputeDetailModal({
  disputeId,
  onClose,
  onDone,
}: {
  disputeId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [resolutionType, setResolutionType] = useState('FULL_REFUND');
  const [refundAmount, setRefundAmount] = useState('');
  const [partnerPayout, setPartnerPayout] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dispute-detail', disputeId],
    queryFn: async () => {
      const res = await fetchAPI<DisputeDetailRow>(`/admin/disputes/${disputeId}`);
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const assign = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI(`/admin/disputes/${disputeId}/assign`, { method: 'PUT' });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Sengketa diambil untuk ditinjau');
      refetch();
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolve = useMutation({
    mutationFn: async () => {
      const body = {
        resolution_type: resolutionType,
        refund_amount: Number(refundAmount) || 0,
        partner_payout: Number(partnerPayout) || 0,
        admin_notes: adminNotes,
      };
      const res = await fetchAPI(`/admin/disputes/${disputeId}/resolve`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Sengketa diselesaikan');
      qc.invalidateQueries({ queryKey: ['dispute-detail', disputeId] });
      onDone();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = data?.status;
  const showRefund = resolutionType === 'FULL_REFUND' || resolutionType === 'PARTIAL_REFUND';
  const showPayout = resolutionType === 'PAY_PARTNER' || resolutionType === 'PARTIAL_REFUND';

  return (
    <Modal open onClose={onClose} title="Detail Sengketa" className="max-w-2xl">
      {isLoading || !data ? (
        <CenteredSpinner />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Order" value={data.order_number} />
            <Field label="Nominal Order" value={formatIDR(data.order_amount)} />
            <Field label="Pelanggan" value={data.customer_name} />
            <Field label="Mitra" value={data.partner_name} />
            <Field
              label="Tipe"
              value={DISPUTE_TYPE_LABELS[data.dispute_type] || data.dispute_type}
            />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Status</p>
              <Badge variant={disputeStatusVariant(data.status)} className="mt-1">
                {DISPUTE_STATUS_LABELS[data.status] || data.status}
              </Badge>
            </div>
          </div>

          {nstr(data.response_content) && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Tanggapan terlapor</p>
              <p className="text-sm">{nstr(data.response_content)}</p>
            </div>
          )}

          {data.evidence_urls && data.evidence_urls.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Bukti pelapor</p>
              <div className="flex flex-wrap gap-2">
                {data.evidence_urls.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="overflow-hidden rounded-lg border border-border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`bukti-${i}`} className="size-20 object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {status === 'RESOLVED' || status === 'CLOSED' ? (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p className="font-medium">Resolusi</p>
              <p className="text-muted-foreground">
                {nenum(data.resolution_type, 'ResolutionType') || '-'} · Refund{' '}
                {formatIDR(nint(data.refund_amount) || 0)} · Payout{' '}
                {formatIDR(nint(data.partner_payout) || 0)}
              </p>
              {nstr(data.admin_resolution) && (
                <p className="mt-1">{nstr(data.admin_resolution)}</p>
              )}
              {ntime(data.responded_at) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Ditanggapi {formatDateTime(ntime(data.responded_at))}
                </p>
              )}
            </div>
          ) : status === 'OPEN' ? (
            <div className="flex justify-end border-t border-border pt-4">
              <Button onClick={() => assign.mutate()} disabled={assign.isPending}>
                Ambil &amp; Tinjau
              </Button>
            </div>
          ) : (
            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-sm font-medium">Form Resolusi</p>
              <div className="flex flex-col gap-1.5">
                <Label>Jenis resolusi</Label>
                <Select
                  value={resolutionType}
                  onChange={(e) => setResolutionType(e.target.value)}
                >
                  {RESOLUTION_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {showRefund && (
                  <div className="flex flex-col gap-1.5">
                    <Label>Refund ke pelanggan (Rp)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                )}
                {showPayout && (
                  <div className="flex flex-col gap-1.5">
                    <Label>Cairkan ke mitra (Rp)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={partnerPayout}
                      onChange={(e) => setPartnerPayout(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Catatan admin (wajib)</Label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Catatan internal & keputusan…"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  disabled={!adminNotes.trim() || resolve.isPending}
                  onClick={() => resolve.mutate()}
                >
                  Tutup Tiket &amp; Selesaikan
                </Button>
              </div>
            </div>
          )}
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
