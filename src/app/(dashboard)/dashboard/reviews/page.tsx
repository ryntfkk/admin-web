'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Trash2, Star } from 'lucide-react';
import { fetchAPI, qs } from '@/lib/api';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type { ReviewRow, ReviewDetailRow } from '@/types/admin';
import { nstr, nint, ntime } from '@/lib/sql';
import { formatDateTime, formatIDRorDash as formatIDR } from '@/lib/format';
import { toast } from '@/lib/store/toastStore';
import { REVIEW_STATUS_OPTIONS } from '@/lib/enums';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CenteredSpinner } from '@/components/ui/feedback';
import { DataTable, type Column } from '@/components/ui/data-table';

const PER_PAGE = 20;

export default function ReviewsPage() {
  const qc = useQueryClient();
  const [hidden, setHidden] = useState('');
  const [rating, setRating] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['reviews', hidden, rating, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<ReviewRow>>(
        `/admin/reviews${qs({ hidden, rating: rating || undefined, page, per_page: PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const columns: Column<ReviewRow>[] = [
    { key: 'order', header: 'Order', cell: (r) => <span className="font-mono text-xs">{r.order_number}</span> },
    { key: 'customer', header: 'Pelanggan', cell: (r) => <span className="font-medium">{r.customer_name}</span> },
    {
      key: 'partner',
      header: 'Mitra',
      cell: (r) => <span className="text-muted-foreground">{r.partner_name}</span>,
      hideBelow: 'md',
    },
    {
      key: 'rating',
      header: 'Rating',
      cell: (r) => (
        <span className="flex items-center gap-1">
          <Star className="size-4 fill-warning text-warning" />
          <span className="font-medium tabular-nums">{r.rating}</span>
        </span>
      ),
    },
    {
      key: 'hidden',
      header: 'Tampil',
      cell: (r) =>
        r.is_hidden ? <Badge variant="neutral">Disembunyikan</Badge> : <Badge variant="success">Tampil</Badge>,
    },
    {
      key: 'created',
      header: 'Dibuat',
      cell: (r) => (
        <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.created_at)}</span>
      ),
      hideBelow: 'lg',
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Review</h1>
          <p className="text-sm text-muted-foreground">Moderasi review pengguna</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-32">
            <Select
              value={rating}
              onChange={(e) => {
                setRating(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua rating</option>
              <option value="5">5 Bintang</option>
              <option value="4">4 Bintang</option>
              <option value="3">3 Bintang</option>
              <option value="2">2 Bintang</option>
              <option value="1">1 Bintang</option>
            </Select>
          </div>
          <div className="w-36">
            <Select
              value={hidden}
              onChange={(e) => {
                setHidden(e.target.value);
                setPage(1);
              }}
            >
              {REVIEW_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={data?.data}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="Tidak ada review"
        emptyNote="Belum ada review untuk filter ini."
        onRowClick={(r) => setSelectedId(r.id)}
        page={page}
        perPage={PER_PAGE}
        total={data?.pagination?.total ?? 0}
        onPageChange={setPage}
      />

      {selectedId && (
        <ReviewDetailModal
          reviewId={selectedId}
          onClose={() => setSelectedId(null)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ['reviews'] });
          }}
        />
      )}
    </div>
  );
}

function ReviewDetailModal({
  reviewId,
  onClose,
  onDone,
}: {
  reviewId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['review-detail', reviewId],
    queryFn: async () => {
      const res = await fetchAPI<ReviewDetailRow>(`/admin/reviews/${reviewId}`);
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const hide = useMutation({
    mutationFn: async (isHidden: boolean) => {
      const res = await fetchAPI(`/admin/reviews/${reviewId}/hide`, {
        method: 'PUT',
        body: JSON.stringify({ is_hidden: isHidden }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
      return res;
    },
    onSuccess: (_, isHidden) => {
      toast.success(isHidden ? 'Review disembunyikan' : 'Review ditampilkan');
      qc.invalidateQueries({ queryKey: ['review-detail', reviewId] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI(`/admin/reviews/${reviewId}`, {
        method: 'DELETE',
      });
      if (!res.success) throw new Error(getErrorMessage(res));
      return res;
    },
    onSuccess: () => {
      toast.success('Review dihapus');
      onDone();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal open onClose={onClose} title="Detail Review" className="max-w-2xl">
      {isLoading || !data ? (
        <CenteredSpinner />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Order" value={data.order_number} />
            <Field label="Nominal Order" value={formatIDR(data.order_amount)} />
            <Field label="Pelanggan" value={data.customer_name} />
            <Field label="No. HP" value={nstr(data.customer_phone) || '-'} />
            <Field label="Mitra" value={data.partner_name} />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Status</p>
              <div className="mt-0.5">
                {data.is_hidden ? (
                  <Badge variant="neutral">Hidden</Badge>
                ) : (
                  <Badge variant="success">Visible</Badge>
                )}
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground">Rating</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`size-5 ${
                      star <= data.rating
                        ? 'fill-warning text-warning'
                        : 'fill-muted text-muted'
                    }`}
                  />
                ))}
              </div>
              <span className="font-semibold">{data.rating}/5</span>
            </div>
            {(() => {
              // Backend mengirim sub-rating sebagai sql.NullInt16 mentah
              // ({Int16,Valid}) — WAJIB di-unwrap via nint, kalau tidak objeknya
              // ter-render sebagai React child (crash) & guard-nya selalu truthy.
              const q = nint(data.rating_quality);
              const p = nint(data.rating_punctuality);
              const c = nint(data.rating_communication);
              return q !== null || p !== null || c !== null ? (
                <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                  <span>Kualitas: {q ?? '-'}</span>
                  <span>Ketepatan: {p ?? '-'}</span>
                  <span>Komunikasi: {c ?? '-'}</span>
                </div>
              ) : null;
            })()}
          </div>

          {nstr(data.comment) && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Komentar</p>
              <p className="mt-1 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                {nstr(data.comment)}
              </p>
            </div>
          )}

          {nstr(data.partner_response) && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Tanggapan Mitra</p>
              <p className="mt-1 rounded-lg border border-success/30 bg-success/8 p-3 text-sm">
                {nstr(data.partner_response)}
              </p>
              {ntime(data.partner_response_at) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(ntime(data.partner_response_at))}
                </p>
              )}
            </div>
          )}

          <div className="border-t border-border pt-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {formatDateTime(data.created_at)}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => hide.mutate(!data.is_hidden)}
                disabled={hide.isPending}
              >
                {data.is_hidden ? (
                  <>
                    <Eye className="mr-1 size-4" />
                    Tampilkan
                  </>
                ) : (
                  <>
                    <EyeOff className="mr-1 size-4" />
                    Sembunyikan
                  </>
                )}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmingDelete(true)}
                disabled={del.isPending}
              >
                <Trash2 className="mr-1 size-4" />
                Hapus
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hapus review = HARD DELETE di backend (barisnya diarsipkan ke audit
          log, tapi tidak bisa dikembalikan lewat UI). "Sembunyikan" hampir
          selalu jawaban yang benar, jadi jalur hapus dibuat lebih berfriksi. */}
      <ConfirmDialog
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={() => del.mutate()}
        variant="danger"
        title="Hapus review ini permanen?"
        description="Review dihapus dari database dan rating mitra dihitung ulang tanpa review ini. Bila hanya ingin menyembunyikannya dari publik, pakai tombol Sembunyikan."
        confirmLabel="Hapus permanen"
        requireReason
        reasonLabel="Alasan penghapusan"
        confirmPhrase="HAPUS"
        loading={del.isPending}
      />
    </Modal>
  );
}

