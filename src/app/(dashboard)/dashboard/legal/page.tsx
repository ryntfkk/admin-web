'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Send, Trash2, Lock } from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type { LegalDocumentRow, LegalSlug } from '@/types/admin';
import { formatDateTime } from '@/lib/format';
import { toast } from '@/lib/store/toastStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EntitySection } from '@/components/ui/entity-page';
import { CenteredSpinner } from '@/components/ui/feedback';

// Pengelolaan dokumen legal berversi.
//
// Aturan yang menentukan bentuk halaman ini: VERSI YANG SUDAH TERBIT TIDAK BISA
// DIUBAH. Isinya adalah teks yang sudah disetujui pengguna dan menjadi bukti
// persetujuan mereka . mengubahnya sama dengan memalsukan bukti itu. Karena itu
// alurnya selalu: buat versi baru → sunting sebagai draf → terbitkan.

const SLUGS: { slug: LegalSlug; label: string; catatan?: string }[] = [
  { slug: 'terms', label: 'Syarat & Ketentuan', catatan: 'Ditampilkan di /terms dan disetujui saat registrasi.' },
  { slug: 'privacy', label: 'Kebijakan Privasi', catatan: 'Ditampilkan di /privacy dan disetujui saat registrasi.' },
  { slug: 'partner-terms', label: 'S&K Mitra', catatan: 'Belum dipakai di web sampai versi pertamanya diterbitkan.' },
  { slug: 'cancellation', label: 'Kebijakan Pembatalan & Refund', catatan: 'Dirujuk dari alur pemesanan.' },
];

export default function LegalPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<LegalDocumentRow | null>(null);
  const [creatingFor, setCreatingFor] = useState<LegalSlug | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['legal-documents'],
    queryFn: async () => {
      const res = await fetchAPI<LegalDocumentRow[]>('/admin/legal');
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const bySlug = useMemo(() => {
    const map = new Map<LegalSlug, LegalDocumentRow[]>();
    for (const s of SLUGS) map.set(s.slug, []);
    for (const d of data ?? []) map.get(d.slug)?.push(d);
    return map;
  }, [data]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['legal-documents'] });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dokumen Legal</h1>
        <p className="text-sm text-muted-foreground">
          Setiap perubahan diterbitkan sebagai versi baru. Versi yang sudah
          terbit tidak dapat diubah atau dihapus . itu teks yang sudah disetujui
          pengguna dan menjadi bukti persetujuan mereka.
        </p>
      </div>

      {isLoading ? (
        <CenteredSpinner />
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : 'Gagal memuat dokumen.'}
        </div>
      ) : (
        SLUGS.map((s) => {
          const versions = bySlug.get(s.slug) ?? [];
          const active = versions.find((v) => v.published_at);
          return (
            <EntitySection key={s.slug} title={s.label}>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {s.catatan}
                    {active ? (
                      <> Saat ini berlaku: <strong>v{active.version}</strong>.</>
                    ) : (
                      <> <strong>Belum ada versi terbit.</strong></>
                    )}
                  </p>
                  <Button size="sm" variant="outline" onClick={() => setCreatingFor(s.slug)}>
                    <Plus className="mr-1 size-4" /> Versi baru
                  </Button>
                </div>

                {versions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada versi.</p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {versions.map((v) => (
                      <li key={v.id} className="flex flex-wrap items-center gap-2 p-3">
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <span className="text-sm font-medium">v{v.version}</span>
                        <span className="flex-1 truncate text-sm text-muted-foreground">{v.title}</span>
                        {v.published_at ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400">
                            <Lock className="size-3" /> terbit · berlaku {formatDateTime(v.effective_at)}
                          </span>
                        ) : (
                          <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                            draf
                          </span>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setEditing(v)}>
                          {v.published_at ? 'Lihat' : 'Sunting'}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </EntitySection>
          );
        })
      )}

      {creatingFor && (
        <CreateDraftModal
          slug={creatingFor}
          previous={(bySlug.get(creatingFor) ?? [])[0] ?? null}
          onClose={() => setCreatingFor(null)}
          onDone={refresh}
        />
      )}

      {editing && (
        <DocumentModal doc={editing} onClose={() => setEditing(null)} onDone={refresh} />
      )}
    </div>
  );
}

// Versi baru menyalin isi versi terakhir sebagai titik awal . menulis ulang
// dokumen legal dari nol setiap kali revisi kecil adalah undangan salah ketik.
function CreateDraftModal({
  slug,
  previous,
  onClose,
  onDone,
}: {
  slug: LegalSlug;
  previous: LegalDocumentRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(previous?.title ?? '');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [loadingPrev, setLoadingPrev] = useState(false);

  const salinVersiTerakhir = async () => {
    if (!previous) return;
    setLoadingPrev(true);
    const res = await fetchAPI<LegalDocumentRow>(`/admin/legal/${previous.id}`);
    setLoadingPrev(false);
    if (res.success && res.data) {
      setTitle(res.data.title);
      setBody(res.data.body_md ?? '');
      toast.success(`Isi v${res.data.version} disalin`);
    } else {
      toast.error(getErrorMessage(res));
    }
  };

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI('/admin/legal', {
        method: 'POST',
        body: JSON.stringify({ slug, title, body_md: body, summary }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Draf dibuat');
      onDone();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal open onClose={onClose} title="Buat versi baru" className="max-w-3xl">
      <div className="space-y-4">
        {previous && (
          <Button variant="outline" size="sm" onClick={salinVersiTerakhir} disabled={loadingPrev}>
            {loadingPrev ? 'Menyalin…' : `Salin isi v${previous.version}`}
          </Button>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="l-title">Judul</Label>
          <Input id="l-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="l-summary">Ringkasan perubahan</Label>
          <Input
            id="l-summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="mis. menambah pasal masa penyimpanan data"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="l-body">Isi (Markdown)</Label>
          <Textarea
            id="l-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-80 font-mono text-xs"
            placeholder={'## 1. Judul Pasal\n\nIsi paragraf.\n\n- poin\n- poin'}
          />
          <p className="text-xs text-muted-foreground">
            Didukung: heading (##), paragraf, daftar, <strong>tebal</strong>, tautan.
            HTML mentah dibuang saat render.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>Batal</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !title.trim()}>
            {create.isPending ? 'Menyimpan…' : 'Simpan sebagai draf'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function DocumentModal({
  doc,
  onClose,
  onDone,
}: {
  doc: LegalDocumentRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const terbit = !!doc.published_at;
  const [title, setTitle] = useState(doc.title);
  const [summary, setSummary] = useState(doc.summary);
  const [body, setBody] = useState('');
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [effectiveAt, setEffectiveAt] = useState('');

  const { isLoading } = useQuery({
    queryKey: ['legal-document', doc.id],
    queryFn: async () => {
      const res = await fetchAPI<LegalDocumentRow>(`/admin/legal/${doc.id}`);
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      setBody(res.data.body_md ?? '');
      setTitle(res.data.title);
      setSummary(res.data.summary);
      return res.data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI(`/admin/legal/${doc.id}`, {
        method: 'PUT',
        body: JSON.stringify({ title, body_md: body, summary }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => { toast.success('Draf disimpan'); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const publish = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI(`/admin/legal/${doc.id}/publish`, {
        method: 'POST',
        body: JSON.stringify({
          effective_at: effectiveAt ? new Date(effectiveAt).toISOString() : new Date().toISOString(),
        }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => { toast.success('Dokumen diterbitkan'); onDone(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI(`/admin/legal/${doc.id}`, { method: 'DELETE' });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => { toast.success('Draf dihapus'); onDone(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`${doc.title} . v${doc.version}`}
      description={terbit ? 'Versi terbit: hanya bisa dibaca.' : 'Draf: belum tampil di web.'}
      className="max-w-3xl"
    >
      {isLoading ? (
        <CenteredSpinner />
      ) : (
        <div className="space-y-4">
          {terbit && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
              <Lock className="mt-0.5 size-4 shrink-0" />
              <span>
                Versi ini sudah diterbitkan dan <strong>tidak dapat diubah</strong>.
                Pengguna telah menyetujui teks ini, jadi mengubahnya akan
                memalsukan bukti persetujuan mereka. Buat versi baru untuk merevisi.
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="d-title">Judul</Label>
            <Input id="d-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={terbit} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-summary">Ringkasan perubahan</Label>
            <Input id="d-summary" value={summary} onChange={(e) => setSummary(e.target.value)} disabled={terbit} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-body">Isi (Markdown)</Label>
            <Textarea
              id="d-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={terbit}
              className="min-h-96 font-mono text-xs"
            />
          </div>

          {!terbit && (
            <div className="space-y-1.5">
              <Label htmlFor="d-eff">Berlaku sejak</Label>
              <Input
                id="d-eff"
                type="datetime-local"
                value={effectiveAt}
                onChange={(e) => setEffectiveAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Kosongkan untuk berlaku seketika saat diterbitkan.
              </p>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Tutup</Button>
            {!terbit && (
              <>
                <Button variant="destructive" onClick={() => setConfirmDelete(true)} disabled={remove.isPending}>
                  <Trash2 className="mr-1 size-4" /> Hapus draf
                </Button>
                <Button variant="outline" onClick={() => save.mutate()} disabled={save.isPending || !title.trim()}>
                  {save.isPending ? 'Menyimpan…' : 'Simpan draf'}
                </Button>
                <Button onClick={() => setConfirmPublish(true)} disabled={publish.isPending || !body.trim()}>
                  <Send className="mr-1 size-4" /> Terbitkan
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmPublish}
        onClose={() => setConfirmPublish(false)}
        onConfirm={() => publish.mutate()}
        title="Terbitkan versi ini?"
        description="Setelah terbit, isinya TIDAK BISA diubah atau dihapus lagi . versi ini akan menjadi dokumen yang disetujui pengguna. Untuk merevisi, buat versi baru."
        confirmLabel="Terbitkan"
        loading={publish.isPending}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
        variant="danger"
        title="Hapus draf ini?"
        description="Draf belum pernah tayang dan belum disetujui siapa pun, jadi aman dihapus."
        confirmLabel="Hapus draf"
        loading={remove.isPending}
      />
    </Modal>
  );
}
