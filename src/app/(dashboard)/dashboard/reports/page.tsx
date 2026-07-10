'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, Paperclip } from 'lucide-react';
import { fetchAPI, qs } from '@/lib/api';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type { ReportRow, ReportDetailRow } from '@/types/admin';
import { nstr, ntime } from '@/lib/sql';
import { formatDateTime } from '@/lib/format';
import { toast } from '@/lib/store/toastStore';
import {
  REPORT_STATUS_OPTIONS,
  REPORT_STATUS_LABELS,
  REPORT_TYPE_LABELS,
  reportStatusVariant,
  reportTypeVariant,
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

export default function ReportsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [targetType, setTargetType] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['reports', status, targetType, search, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<ReportRow>>(
        `/admin/reports${qs({ status, target_type: targetType, search, page, per_page: PER_PAGE })}`,
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
          <h1 className="text-2xl font-semibold tracking-tight">Laporan</h1>
          <p className="text-sm text-muted-foreground">Kelola laporan dari pengguna</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-40">
            <Input
              placeholder="Cari..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="w-40">
            <Select
              value={targetType}
              onChange={(e) => {
                setTargetType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua tipe</option>
              <option value="PARTNER">Mitra</option>
              <option value="SERVICE">Layanan</option>
              <option value="REVIEW">Review</option>
              <option value="CHAT_MESSAGE">Pesan Chat</option>
              <option value="USER">Pengguna</option>
            </Select>
          </div>
          <div className="w-40">
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              {REPORT_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <CenteredSpinner />
      ) : rows.length === 0 ? (
        <EmptyState title="Tidak ada laporan" note="Belum ada laporan untuk filter ini." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Pelapor</TableHead>
                <TableHead>Tipe Target</TableHead>
                <TableHead>Alasan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dibuat</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">
                    {r.id.substring(0, 8)}...
                  </TableCell>
                  <TableCell className="font-medium">{r.reporter_name}</TableCell>
                  <TableCell>
                    <Badge variant={reportTypeVariant(r.target_type)}>
                      {REPORT_TYPE_LABELS[r.target_type] || r.target_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {nstr(r.description) || r.reason_category || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={reportStatusVariant(r.status)}>
                      {REPORT_STATUS_LABELS[r.status] || r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(r.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setSelectedId(r.id)}>
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
        <ReportDetailModal
          reportId={selectedId}
          onClose={() => setSelectedId(null)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ['reports'] });
          }}
        />
      )}
    </div>
  );
}

function ReportDetailModal({
  reportId,
  onClose,
  onDone,
}: {
  reportId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [adminNotes, setAdminNotes] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['report-detail', reportId],
    queryFn: async () => {
      const res = await fetchAPI<ReportDetailRow>(`/admin/reports/${reportId}`);
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const resolve = useMutation({
    mutationFn: async (action: 'ACTIONED' | 'DISMISSED') => {
      const body = {
        status: action,
        note: adminNotes,
      };
      const res = await fetchAPI(`/admin/reports/${reportId}/resolve`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
      return res;
    },
    onSuccess: () => {
      toast.success('Laporan berhasil diselesaikan');
      qc.invalidateQueries({ queryKey: ['report-detail', reportId] });
      onDone();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = data?.status;
  const isPending = status === 'OPEN' || status === 'REVIEWING';

  return (
    <Modal open onClose={onClose} title="Detail Laporan" className="max-w-2xl">
      {isLoading || !data ? (
        <CenteredSpinner />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="ID Laporan" value={data.id.substring(0, 18) + '...'} />
            <Field label="Status" value={
              <Badge variant={reportStatusVariant(data.status)}>
                {REPORT_STATUS_LABELS[data.status] || data.status}
              </Badge>
            } />
            <Field label="Pelapor" value={data.reporter_name} />
            <Field label="No. HP Pelapor" value={nstr(data.reporter_phone) || '-'} />
            <Field label="Tipe Target" value={
              <Badge variant={reportTypeVariant(data.target_type)}>
                {REPORT_TYPE_LABELS[data.target_type] || data.target_type}
              </Badge>
            } />
            <Field label="Target" value={nstr(data.target_name) || '-'} />
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground">Alasan / Kategori</p>
            <p className="mt-0.5 text-sm">
              <span className="font-medium">{data.reason_category}</span>
              {nstr(data.description) && `: ${nstr(data.description)}`}
            </p>
          </div>

          {nstr(data.target_details) && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Detail Target</p>
              <p className="mt-0.5 text-sm">{nstr(data.target_details)}</p>
            </div>
          )}

          {data.evidence_urls && data.evidence_urls.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                <Paperclip className="mr-1 inline size-3" />
                Bukti ({data.evidence_urls.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {data.evidence_urls.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="overflow-hidden rounded-lg border border-border hover:border-primary"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`bukti-${i}`} className="size-24 object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {data.status === 'ACTIONED' || data.status === 'DISMISSED' ? (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p className="font-medium">Hasil Penanganan</p>
              <p className="mt-1 text-muted-foreground">
                Status: <span className="font-medium text-foreground">{REPORT_STATUS_LABELS[data.status]}</span>
              </p>
              {nstr(data.resolution_note) && (
                <p className="mt-1 text-muted-foreground">
                  Catatan: {nstr(data.resolution_note)}
                </p>
              )}
              {ntime(data.resolved_at) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Ditangani oleh {nstr(data.resolved_by)} pada {formatDateTime(ntime(data.resolved_at))}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-sm font-medium">Form Penanganan</p>
              <div className="flex flex-col gap-1.5">
                <Label>Catatan admin</Label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Catatan penanganan atau alasan dismiss..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => resolve.mutate('DISMISSED')}
                  disabled={resolve.isPending}
                >
                  Dismiss
                </Button>
                <Button
                  onClick={() => resolve.mutate('ACTIONED')}
                  disabled={resolve.isPending || !adminNotes.trim()}
                >
                  Tindaklanjuti
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}
