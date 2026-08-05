'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, FileText, Maximize2, Plus, Trash2 } from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type { PartnerDocument, PartnerStrike, PartnerPortfolioPhoto, PartnerServiceRow, PartnerActionLog, VerificationChecklist, WorkingHour } from '@/types/admin';
import { DocumentLightbox, type LightboxItem } from './DocumentLightbox';
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
      description="Mitra tanpa jadwal sama sekali tidak akan pernah bisa menerima pesanan . validasi jadwal di backend bersifat fail-closed."
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

const isImageUrl = (url: string) => /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url);

export function DocumentsTab({ partnerId }: { partnerId: string }) {
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState<PartnerDocument | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  // Per-id, bukan satu `review.isPending` global. Flag global mematikan tombol
  // Setujui di SEMUA baris selama satu request berjalan, sehingga admin
  // terpaksa menunggu bolak-balik untuk tiap dokumen.
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['partner-documents', partnerId],
    queryFn: async () => {
      const res = await fetchAPI<PartnerDocument[]>(`/admin/partners/${partnerId}/documents`);
      if (!res.success) throw new Error(getErrorMessage(res));
      return res.data ?? [];
    },
  });

  // Daftar dokumen WAJIB datang dari checklist backend, tidak disalin ke sini.
  // Aturannya hidup di `admin/service.go` (requiredDocsFor) dan salinan di
  // frontend akan melenceng diam-diam begitu backend menambah jenis dokumen.
  // Query key-nya sama dengan halaman detail, jadi ini memakai cache yang ada.
  const { data: checklist } = useQuery({
    queryKey: ['partner-checklist', partnerId],
    queryFn: async () => {
      const res = await fetchAPI<VerificationChecklist>(
        `/admin/partners/${partnerId}/verification-checklist`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const requiredTypes = new Set((checklist?.items ?? []).map((i) => i.doc_type.toUpperCase()));
  const docLabel = (docType: string) =>
    checklist?.items.find((i) => i.doc_type.toUpperCase() === docType.toUpperCase())?.label ?? docType;

  const reviewOne = async (docId: string, status: string, reason = '') => {
    const res = await fetchAPI(`/admin/partners/${partnerId}/documents/${docId}`, {
      method: 'PUT',
      body: JSON.stringify({ status, reason }),
    });
    if (!res.success) throw new Error(getErrorMessage(res));
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['partner-documents', partnerId] });
    // Checklist menentukan aktif/tidaknya tombol "Setujui & Verifikasi Mitra"
    // di halaman induk; tanpa ini admin menyetujui semua dokumen lalu melihat
    // tombol verifikasi tetap mati sampai halaman dimuat ulang.
    qc.invalidateQueries({ queryKey: ['partner-checklist', partnerId] });
  };

  const review = useMutation({
    mutationFn: async (vars: { docId: string; status: string; reason?: string }) => {
      setPendingIds((prev) => [...prev, vars.docId]);
      try {
        await reviewOne(vars.docId, vars.status, vars.reason ?? '');
      } finally {
        setPendingIds((prev) => prev.filter((id) => id !== vars.docId));
      }
    },
    onSuccess: (_r, vars) => {
      toast.success(vars.status === 'APPROVED' ? 'Dokumen disetujui' : 'Dokumen ditolak');
      setRejecting(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pendingRequired = (data ?? []).filter(
    (d) => requiredTypes.has(d.doc_type.toUpperCase()) && d.status !== 'APPROVED',
  );

  /**
   * Menyetujui seluruh dokumen wajib yang belum disetujui.
   *
   * Berurutan, bukan `Promise.all`: tiap panggilan menulis audit log dan
   * menyentuh baris mitra yang sama. Kegagalan per dokumen dikumpulkan lalu
   * dilaporkan sekaligus . satu NIB yang gagal tidak boleh menyembunyikan
   * bahwa empat dokumen lain sudah lolos.
   */
  const runBulkApprove = async () => {
    setConfirmBulk(false);
    setBulkRunning(true);
    const failed: string[] = [];
    let ok = 0;
    for (const doc of pendingRequired) {
      try {
        await reviewOne(doc.id, 'APPROVED');
        ok += 1;
      } catch {
        failed.push(docLabel(doc.doc_type));
      }
    }
    setBulkRunning(false);
    refresh();
    if (failed.length === 0) {
      toast.success(`${ok} dokumen wajib disetujui`);
    } else {
      toast.error(`${ok} disetujui, ${failed.length} gagal: ${failed.join(', ')}`);
    }
  };

  const lightboxItems: LightboxItem[] = (data ?? []).map((d) => ({
    id: d.id,
    label: docLabel(d.doc_type),
    url: d.file_url,
    isImage: isImageUrl(d.file_url),
  }));

  if (isLoading) return <CenteredSpinner />;
  if (!data || data.length === 0)
    return (
      <EmptyState
        title="Belum ada dokumen"
        note="Dokumen wajib (KTP, selfie, dan berkas badan usaha) dibuat saat mitra mengirim pendaftaran. Kosong di sini berarti mitra belum pernah mengajukan."
      />
    );

  return (
    <>
      <EntitySection
        title="Dokumen KYC"
        description="Termasuk KTP & selfie. Klik gambar untuk melihat ukuran penuh. Setiap dokumen ditinjau terpisah . menolak satu dokumen tidak membatalkan verifikasi mitra secara keseluruhan."
        actions={
          pendingRequired.length > 0 ? (
            <Button size="sm" disabled={bulkRunning} onClick={() => setConfirmBulk(true)}>
              {bulkRunning
                ? 'Memproses…'
                : `Setujui semua dokumen wajib (${pendingRequired.length})`}
            </Button>
          ) : undefined
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((doc, i) => {
            const isRequired = requiredTypes.has(doc.doc_type.toUpperCase());
            const busy = pendingIds.includes(doc.id) || bulkRunning;
            return (
              <div
                key={doc.id}
                className="flex flex-col overflow-hidden rounded-lg border border-border"
              >
                <button
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  aria-label={`Lihat ${docLabel(doc.doc_type)} ukuran penuh`}
                  className="group relative block aspect-[4/3] w-full bg-muted"
                >
                  {isImageUrl(doc.file_url) ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={doc.file_url}
                      alt={docLabel(doc.doc_type)}
                      className="size-full object-cover transition-opacity group-hover:opacity-90"
                    />
                  ) : (
                    <span className="flex size-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                      <FileText className="size-7" />
                      Berkas PDF
                    </span>
                  )}
                  <span className="absolute right-1.5 top-1.5 rounded bg-black/60 p-1 text-white">
                    <Maximize2 className="size-3.5" />
                  </span>
                </button>

                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium">{docLabel(doc.doc_type)}</span>
                    {isRequired && <Badge variant="neutral">wajib</Badge>}
                    <Badge variant={DOC_STATUS_VARIANT[doc.status] ?? 'neutral'}>{doc.status}</Badge>
                  </div>

                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    {doc.expires_at && <p>Berlaku sampai: {formatDateTime(doc.expires_at)}</p>}
                    <p>
                      Diunggah {formatDateTime(doc.created_at)}
                      {doc.verified_by && ` · ditinjau ${doc.verified_by}`}
                    </p>
                  </div>
                  {doc.rejection_reason && (
                    <p className="text-xs text-destructive">Ditolak: {doc.rejection_reason}</p>
                  )}

                  <div className="mt-auto flex items-center gap-2 pt-1">
                    {doc.status !== 'APPROVED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => review.mutate({ docId: doc.id, status: 'APPROVED' })}
                      >
                        Setujui
                      </Button>
                    )}
                    {doc.status !== 'REJECTED' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={busy}
                        onClick={() => setRejecting(doc)}
                      >
                        Tolak
                      </Button>
                    )}
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                      Asli
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </EntitySection>

      {lightboxIndex !== null && (
        <DocumentLightbox
          items={lightboxItems}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      <ConfirmDialog
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        onConfirm={runBulkApprove}
        title={`Setujui ${pendingRequired.length} dokumen wajib?`}
        description="Pastikan setiap berkas sudah dilihat. Persetujuan tercatat atas namamu di audit log, satu entri per dokumen."
        confirmLabel="Setujui semua"
        loading={bulkRunning}
      />

      <ConfirmDialog
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        onConfirm={(reason) =>
          rejecting && review.mutate({ docId: rejecting.id, status: 'REJECTED', reason })
        }
        variant="danger"
        title={`Tolak dokumen ${rejecting ? docLabel(rejecting.doc_type) : ''}?`}
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

// ── F4: Portfolio (admin lihat semua, hapus permanen) ───────────────

export function PortfolioTab({ partnerId }: { partnerId: string }) {
  const qc = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['partner-portfolio', partnerId],
    queryFn: async () => {
      const res = await fetchAPI<PartnerPortfolioPhoto[]>(`/admin/partners/${partnerId}/portfolio`);
      if (!res.success) throw new Error(getErrorMessage(res));
      return res.data ?? [];
    },
  });

  const remove = useMutation({
    mutationFn: async (photoId: string) => {
      const res = await fetchAPI(`/admin/partners/${partnerId}/portfolio/${photoId}`, { method: 'DELETE' });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Foto portfolio dihapus permanen');
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ['partner-portfolio', partnerId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <CenteredSpinner />;
  if (!data || data.length === 0) return <EmptyState title="Belum ada foto portfolio" />;

  return (
    <EntitySection title="Portfolio Mitra" description="Admin dapat melihat semua foto (termasuk yang di-soft-delete mitra) dan menghapus permanen konten yang melanggar.">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {data.map((photo) => (
          <div key={photo.id} className="relative overflow-hidden rounded-lg border">
            <img src={photo.photo_url} alt={photo.caption?.String || ''} className="aspect-square w-full object-cover" />
            {photo.deleted_at?.Valid && (
              <span className="absolute left-1 top-1 rounded bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-white">
                Dihapus mitra
              </span>
            )}
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-black/60 px-2 py-1">
              <span className="text-[10px] text-white">{formatDateTime(photo.created_at)}</span>
              <button
                onClick={() => setDeleteId(photo.id)}
                className="text-white hover:text-destructive"
                aria-label="Hapus permanen"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && remove.mutate(deleteId)}
        variant="danger"
        title="Hapus foto portfolio permanen?"
        description="Foto dihapus dari database (hard delete). Tidak bisa dikembalikan. Dipakai untuk konten yang melanggar (SARA, pornografi, dll)."
        confirmLabel="Hapus permanen"
        loading={remove.isPending}
      />
    </EntitySection>
  );
}

// ── F4: Layanan mitra (admin review) ────────────────────────────────

export function ServicesTab({ partnerId }: { partnerId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['partner-services', partnerId],
    queryFn: async () => {
      const res = await fetchAPI<PartnerServiceRow[]>(`/admin/partners/${partnerId}/services`);
      if (!res.success) throw new Error(getErrorMessage(res));
      return res.data ?? [];
    },
  });

  if (isLoading) return <CenteredSpinner />;
  if (!data || data.length === 0) return <EmptyState title="Belum ada layanan" />;

  return (
    <EntitySection title="Layanan Mitra" description="Daftar layanan aktif & non-aktif. Admin dapat review konten sebelum/sesudah verifikasi.">
      <div className="space-y-2">
        {data.map((svc) => (
          <div key={svc.id} className="flex items-center justify-between rounded-lg border p-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm">{svc.name}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">{svc.description}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Rp {svc.price.toLocaleString('id-ID')} • Dibuat {formatDateTime(svc.created_at)}
              </p>
            </div>
            <Badge variant={svc.is_active ? 'success' : 'neutral'}>
              {svc.is_active ? 'Aktif' : 'Nonaktif'}
            </Badge>
          </div>
        ))}
      </div>
    </EntitySection>
  );
}

// ── F5: Riwayat Aksi mitra (audit log) ──────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  ONBOARD_SUBMIT: 'Submit onboarding',
  UPDATE_PROFILE: 'Update profil',
  UPDATE_BANK_ACCOUNT: 'Update rekening bank',
  DELETE_DOCUMENT: 'Hapus dokumen',
  DELETE_PORTFOLIO: 'Hapus portfolio',
  ADD_DOCUMENT: 'Tambah dokumen',
  ADD_PORTFOLIO: 'Tambah portfolio',
};

export function ActionLogsTab({ partnerId }: { partnerId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['partner-action-logs', partnerId],
    queryFn: async () => {
      const res = await fetchAPI<PartnerActionLog[]>(`/admin/partners/${partnerId}/action-logs?limit=100`);
      if (!res.success) throw new Error(getErrorMessage(res));
      return res.data ?? [];
    },
  });

  if (isLoading) return <CenteredSpinner />;
  if (!data || data.length === 0) return <EmptyState title="Belum ada riwayat aksi" />;

  return (
    <EntitySection
      title="Riwayat Aksi Mitra"
      description="Audit trail semua aksi mitra (delete dokumen, update profil/rekening, submit onboarding). Dipakai untuk investigasi saat ada sengketa."
    >
      <div className="space-y-2">
        {data.map((log) => (
          <div key={log.id} className="flex items-start gap-3 rounded-lg border p-3">
            <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              {log.action.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  {ACTION_LABELS[log.action] || log.action}
                </p>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDateTime(log.created_at)}
                </span>
              </div>
              {log.payload && Object.keys(log.payload).length > 0 && (
                <pre className="mt-1 overflow-x-auto rounded bg-muted/50 p-2 text-[11px] text-muted-foreground">
                  {JSON.stringify(log.payload, null, 0)}
                </pre>
              )}
              {log.ip_address?.Valid && (
                <p className="mt-1 text-[11px] text-muted-foreground">IP: {log.ip_address.String}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </EntitySection>
  );
}
