'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, Check, X, ExternalLink, Search } from 'lucide-react';
import { fetchAPI, qs } from '@/lib/api';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type { PendingPartnerRow, PartnerDetailRow } from '@/types/admin';
import { nstr } from '@/lib/sql';
import { formatDateTime } from '@/lib/format';
import { toast } from '@/lib/store/toastStore';
import {
  PARTNER_STATUS_OPTIONS,
  PARTNER_STATUS_LABELS,
  partnerStatusVariant,
} from '@/lib/enums';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { CenteredSpinner, EmptyState } from '@/components/ui/feedback';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

const PER_PAGE = 20;

export default function PartnersPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('pending');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['partners', status, search, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<PendingPartnerRow>>(
        `/admin/partners${qs({ status, q: search, page, per_page: PER_PAGE })}`,
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
        <h1 className="text-2xl font-semibold tracking-tight">Mitra</h1>
        <p className="text-sm text-muted-foreground">
          Verifikasi pendaftaran & direktori semua mitra (dokumen KYC tetap dapat diakses)
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-48">
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {PARTNER_STATUS_OPTIONS.map((o) => (
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
            placeholder="Cari nama, telepon, email…"
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
        <EmptyState title="Tidak ada mitra" note="Coba ubah filter status atau pencarian." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Kontak</TableHead>
                <TableHead>Masuk</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.partner_id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {nstr(p.phone) || nstr(p.email) || '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(p.submitted_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={partnerStatusVariant(p.verification_status)}>
                      {PARTNER_STATUS_LABELS[p.verification_status] || p.verification_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setSelectedId(p.partner_id)}>
                      <Eye className="size-4" />
                      Tinjau
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
        <PartnerDetailModal
          partnerId={selectedId}
          onClose={() => setSelectedId(null)}
          onDone={() => {
            setSelectedId(null);
            qc.invalidateQueries({ queryKey: ['partners'] });
            qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
          }}
        />
      )}
    </div>
  );
}

function PartnerDetailModal({
  partnerId,
  onClose,
  onDone,
}: {
  partnerId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['partner-detail', partnerId],
    queryFn: async () => {
      const res = await fetchAPI<PartnerDetailRow>(`/admin/partners/${partnerId}`);
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const verify = useMutation({
    mutationFn: async (payload: { action: 'approve' | 'reject'; reason?: string }) => {
      const res = await fetchAPI(`/admin/partners/${partnerId}/verify`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
      return res;
    },
    onSuccess: (_res, vars) => {
      toast.success(vars.action === 'approve' ? 'Mitra disetujui' : 'Mitra ditolak');
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal open onClose={onClose} title="Detail Verifikasi Mitra" className="max-w-2xl">
      {isLoading || !data ? (
        <CenteredSpinner />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Nama" value={data.name} />
            <Field label="Telepon" value={nstr(data.phone) || '-'} />
            <Field label="Email" value={nstr(data.email) || '-'} />
            <Field label="Terdaftar" value={formatDateTime(data.user_created_at)} />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Status verifikasi</p>
              <p className="mt-0.5">
                <Badge variant={partnerStatusVariant(data.verification_status)}>
                  {PARTNER_STATUS_LABELS[data.verification_status] || data.verification_status}
                </Badge>
              </p>
            </div>
            {nstr(data.rejection_reason) && (
              <Field label="Alasan penolakan" value={nstr(data.rejection_reason)!} />
            )}
          </div>

          {nstr(data.bio) && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Bio</p>
              <p className="text-sm">{nstr(data.bio)}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <DocImage label="Foto KTP" url={nstr(data.ktp_photo_url)} />
            <DocImage label="Selfie dengan KTP" url={nstr(data.selfie_ktp_url)} />
          </div>

          {showReject && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Alasan penolakan (wajib)
              </p>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Jelaskan alasan penolakan yang akan dikirim ke mitra…"
              />
            </div>
          )}

          {data.verification_status === 'pending' && (
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              {!showReject ? (
                <>
                  <Button variant="destructive" onClick={() => setShowReject(true)}>
                    <X className="size-4" />
                    Tolak
                  </Button>
                  <Button
                    onClick={() => {
                      if (
                        window.confirm(
                          'Setujui verifikasi mitra ini? Mitra akan dapat menerima pesanan.',
                        )
                      ) {
                        verify.mutate({ action: 'approve' });
                      }
                    }}
                    disabled={verify.isPending}
                  >
                    <Check className="size-4" />
                    Setujui
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => setShowReject(false)}>
                    Batal
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={!reason.trim() || verify.isPending}
                    onClick={() => verify.mutate({ action: 'reject', reason })}
                  >
                    Konfirmasi Tolak
                  </Button>
                </>
              )}
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

function DocImage({ label, url }: { label: string; url: string | null }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative block overflow-hidden rounded-lg border border-border"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className="h-40 w-full object-cover" />
          <span className="absolute right-1.5 top-1.5 rounded bg-black/60 p-1 text-white">
            <ExternalLink className="size-3.5" />
          </span>
        </a>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
          Tidak ada dokumen
        </div>
      )}
    </div>
  );
}
