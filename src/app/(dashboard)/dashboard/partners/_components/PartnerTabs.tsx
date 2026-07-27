'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type { PartnerDocument, PartnerStrike, WorkingHour } from '@/types/admin';
import { formatDateTime } from '@/lib/format';
import { toast } from '@/lib/store/toastStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EntitySection } from '@/components/ui/entity-page';
import { CenteredSpinner, EmptyState } from '@/components/ui/feedback';

// ── Jam operasional ─────────────────────────────────────────────────

const DAYS: { key: string; label: string }[] = [
  { key: 'monday', label: 'Senin' },
  { key: 'tuesday', label: 'Selasa' },
  { key: 'wednesday', label: 'Rabu' },
  { key: 'thursday', label: 'Kamis' },
  { key: 'friday', label: 'Jumat' },
  { key: 'saturday', label: 'Sabtu' },
  { key: 'sunday', label: 'Minggu' },
];

const DEFAULT_HOUR = { open_time: '08:00', close_time: '17:00', is_open: false };

export function WorkingHoursTab({ partnerId }: { partnerId: string }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['partner-working-hours', partnerId],
    queryFn: async () => {
      const res = await fetchAPI<WorkingHour[]>(`/admin/partners/${partnerId}/working-hours`);
      if (!res.success) throw new Error(getErrorMessage(res));
      return res.data ?? [];
    },
  });

  if (isLoading) return <CenteredSpinner />;
  // `key` mereset form ketika data server berganti, tanpa efek penyalin.
  return <WorkingHoursForm key={data?.length ?? 0} partnerId={partnerId} saved={data ?? []} onSaved={() => qc.invalidateQueries({ queryKey: ['partner-working-hours', partnerId] })} />;
}

function WorkingHoursForm({
  partnerId,
  saved,
  onSaved,
}: {
  partnerId: string;
  saved: WorkingHour[];
  onSaved: () => void;
}) {
  const [rows, setRows] = useState(() =>
    DAYS.map(({ key }) => {
      const existing = saved.find((h) => h.day_of_week === key);
      return {
        day_of_week: key,
        open_time: existing?.open_time ?? DEFAULT_HOUR.open_time,
        close_time: existing?.close_time ?? DEFAULT_HOUR.close_time,
        is_open: existing?.is_open ?? DEFAULT_HOUR.is_open,
      };
    }),
  );

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI(`/admin/partners/${partnerId}/working-hours`, {
        method: 'PUT',
        body: JSON.stringify({ hours: rows }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Jadwal operasional disimpan');
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function patch(day: string, patchValue: Partial<(typeof rows)[number]>) {
    setRows((prev) => prev.map((r) => (r.day_of_week === day ? { ...r, ...patchValue } : r)));
  }

  return (
    <EntitySection
      title="Jam operasional"
      description="Mitra tanpa jadwal sama sekali tidak akan pernah bisa menerima pesanan — validasi jadwal di backend bersifat fail-closed."
    >
      <div className="space-y-2">
        {DAYS.map(({ key, label }) => {
          const row = rows.find((r) => r.day_of_week === key)!;
          return (
            <div
              key={key}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-2.5"
            >
              <label className="flex w-32 items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={row.is_open}
                  onChange={(e) => patch(key, { is_open: e.target.checked })}
                  className="size-4 rounded border-input"
                />
                {label}
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  className="w-32"
                  aria-label={`Jam buka ${label}`}
                  value={row.open_time}
                  disabled={!row.is_open}
                  onChange={(e) => patch(key, { open_time: e.target.value })}
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="time"
                  className="w-32"
                  aria-label={`Jam tutup ${label}`}
                  value={row.close_time}
                  disabled={!row.is_open}
                  onChange={(e) => patch(key, { close_time: e.target.value })}
                />
              </div>
              {!row.is_open && <span className="text-xs text-muted-foreground">Tutup</span>}
            </div>
          );
        })}

        <div className="flex justify-end pt-1">
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Menyimpan…' : 'Simpan jadwal'}
          </Button>
        </div>
      </div>
    </EntitySection>
  );
}

// ── Dokumen KYC ─────────────────────────────────────────────────────

const DOC_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  APPROVED: 'success',
  PENDING: 'warning',
  REJECTED: 'danger',
  EXPIRED: 'neutral',
};

export function DocumentsTab({ partnerId }: { partnerId: string }) {
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState<PartnerDocument | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['partner-documents', partnerId],
    queryFn: async () => {
      const res = await fetchAPI<PartnerDocument[]>(`/admin/partners/${partnerId}/documents`);
      if (!res.success) throw new Error(getErrorMessage(res));
      return res.data ?? [];
    },
  });

  const review = useMutation({
    mutationFn: async (vars: { docId: string; status: string; reason?: string }) => {
      const res = await fetchAPI(`/admin/partners/${partnerId}/documents/${vars.docId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: vars.status, reason: vars.reason ?? '' }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: (_r, vars) => {
      toast.success(vars.status === 'APPROVED' ? 'Dokumen disetujui' : 'Dokumen ditolak');
      setRejecting(null);
      qc.invalidateQueries({ queryKey: ['partner-documents', partnerId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <CenteredSpinner />;
  if (!data || data.length === 0)
    return (
      <EmptyState
        title="Belum ada dokumen tambahan"
        note="KTP & selfie ada di tab Verifikasi. Dokumen lain (SKCK, sertifikat) diunggah mitra dari aplikasi."
      />
    );

  return (
    <>
      <EntitySection
        title="Dokumen pendukung"
        description="Setiap dokumen ditinjau terpisah — menolak satu dokumen tidak membatalkan verifikasi mitra secara keseluruhan."
      >
        <div className="space-y-2">
          {data.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{doc.doc_type}</span>
                  <Badge variant={DOC_STATUS_VARIANT[doc.status] ?? 'neutral'}>{doc.status}</Badge>
                </div>
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  Buka berkas
                  <ExternalLink className="size-3" />
                </a>
                <p className="text-xs text-muted-foreground">
                  Diunggah {formatDateTime(doc.created_at)}
                  {doc.verified_by && ` · ditinjau ${doc.verified_by}`}
                </p>
                {doc.rejection_reason && (
                  <p className="text-xs text-destructive">Ditolak: {doc.rejection_reason}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                {doc.status !== 'APPROVED' && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={review.isPending}
                    onClick={() => review.mutate({ docId: doc.id, status: 'APPROVED' })}
                  >
                    Setujui
                  </Button>
                )}
                {doc.status !== 'REJECTED' && (
                  <Button variant="destructive" size="sm" onClick={() => setRejecting(doc)}>
                    Tolak
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </EntitySection>

      <ConfirmDialog
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        onConfirm={(reason) =>
          rejecting && review.mutate({ docId: rejecting.id, status: 'REJECTED', reason })
        }
        variant="danger"
        title={`Tolak dokumen ${rejecting?.doc_type ?? ''}?`}
        description="Alasan penolakan tersimpan pada dokumen dan di audit log."
        confirmLabel="Tolak dokumen"
        requireReason
        loading={review.isPending}
      />
    </>
  );
}

// ── Strike ──────────────────────────────────────────────────────────

export function StrikesTab({ partnerId }: { partnerId: string }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [toRemove, setToRemove] = useState<PartnerStrike | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['partner-strikes', partnerId],
    queryFn: async () => {
      const res = await fetchAPI<PartnerStrike[]>(`/admin/partners/${partnerId}/strikes`);
      if (!res.success) throw new Error(getErrorMessage(res));
      const strikes = res.data ?? [];
      // Jendela 30 hari dihitung di sini, bukan saat render: Date.now() adalah
      // fungsi impur dan hasilnya bisa berubah tiap render ulang.
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recent = strikes.filter((s) => new Date(s.created_at).getTime() > cutoff).length;
      return { strikes, recent };
    },
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['partner-strikes', partnerId] });
    qc.invalidateQueries({ queryKey: ['partner-detail', partnerId] });
  }

  const remove = useMutation({
    mutationFn: async (vars: { id: string; reason: string }) => {
      const res = await fetchAPI(`/admin/partners/${partnerId}/strikes/${vars.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason: vars.reason }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Strike dihapus');
      setToRemove(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <CenteredSpinner />;

  const strikes = data?.strikes ?? [];
  const recent = data?.recent ?? 0;

  return (
    <>
      <EntitySection
        title="Riwayat strike"
        description={`${recent} strike dalam 30 hari terakhir. Tiga strike dalam jendela ini memicu suspensi otomatis 7 hari (BRD FR-BOOK-05).`}
        actions={
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Tambah strike
          </Button>
        }
      >
        {strikes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Mitra ini belum pernah mendapat strike.</p>
        ) : (
          <div className="space-y-2">
            {strikes.map((s) => (
              <div
                key={s.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-border p-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p>{s.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(s.created_at)}
                    {s.order_number && ` · order ${s.order_number}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Hapus strike"
                  onClick={() => setToRemove(s)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </EntitySection>

      {adding && (
        <AddStrikeDialog
          partnerId={partnerId}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            invalidate();
          }}
        />
      )}

      <ConfirmDialog
        open={!!toRemove}
        onClose={() => setToRemove(null)}
        onConfirm={(reason) => toRemove && remove.mutate({ id: toRemove.id, reason })}
        variant="danger"
        title="Hapus strike ini?"
        description="Menghapus strike menurunkan hitungan 30 hari mitra dan bisa membatalkan ambang suspensi otomatis."
        confirmLabel="Hapus strike"
        requireReason
        reasonLabel="Alasan penghapusan"
        loading={remove.isPending}
      />
    </>
  );
}

function AddStrikeDialog({
  partnerId,
  onClose,
  onSaved,
}: {
  partnerId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState('');
  const [orderId, setOrderId] = useState('');

  const add = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI(`/admin/partners/${partnerId}/strikes`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim(), order_id: orderId.trim() || undefined }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Strike ditambahkan');
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal open onClose={onClose} title="Tambah Strike">
      <div className="space-y-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="strike-reason">Alasan (wajib)</Label>
          <Textarea
            id="strike-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="mis. Membatalkan pesanan sepihak setelah dikonfirmasi"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="strike-order">ID Order terkait (opsional)</Label>
          <Input
            id="strike-order"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="UUID order"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button disabled={!reason.trim() || add.isPending} onClick={() => add.mutate()}>
            {add.isPending ? 'Menyimpan…' : 'Tambah strike'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
