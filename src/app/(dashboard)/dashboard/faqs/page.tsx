'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ArrowUp, ArrowDown, EyeOff } from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type { FaqRow, FaqAudience } from '@/types/admin';
import { toast } from '@/lib/store/toastStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EntitySection } from '@/components/ui/entity-page';
import { CenteredSpinner } from '@/components/ui/feedback';

// Token yang boleh dipakai di jawaban. Harus sama dengan
// web/src/lib/faq-tokens.ts — token yang tidak dikenal dibiarkan apa adanya
// saat render, jadi salah ketik akan terlihat sebagai "{{typo}}" di halaman,
// bukan hilang diam-diam.
const TOKENS: { token: string; label: string }[] = [
  { token: '{{platform_fee_rate}}', label: 'Komisi platform (mis. 12%)' },
  { token: '{{min_transaction}}', label: 'Minimum transaksi / harga layanan' },
  { token: '{{withdrawal_fee}}', label: 'Biaya penarikan' },
  { token: '{{max_withdrawal}}', label: 'Maksimum penarikan' },
  { token: '{{max_additional_fee}}', label: 'Batas biaya tambahan per item' },
  { token: '{{admin_fee}}', label: 'Biaya admin' },
  { token: '{{transport_fee_per_km}}', label: 'Biaya transport per km' },
  { token: '{{withdrawal_sla}}', label: 'SLA pencairan' },
  { token: '{{support_email}}', label: 'Email dukungan' },
];

const AUDIENCES: { value: FaqAudience; label: string }[] = [
  { value: 'CUSTOMER', label: 'Pelanggan' },
  { value: 'PARTNER', label: 'Mitra' },
];

export default function FaqsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<FaqRow | null>(null);
  const [creatingFor, setCreatingFor] = useState<FaqAudience | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['faqs-admin'],
    queryFn: async () => {
      const res = await fetchAPI<FaqRow[]>('/admin/faqs');
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const byAudience = useMemo(() => {
    const map = new Map<FaqAudience, FaqRow[]>([['CUSTOMER', []], ['PARTNER', []]]);
    for (const f of data ?? []) map.get(f.audience)?.push(f);
    return map;
  }, [data]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['faqs-admin'] });

  const reorder = useMutation({
    mutationFn: async (rows: FaqRow[]) => {
      const res = await fetchAPI('/admin/faqs/reorder', {
        method: 'PUT',
        body: JSON.stringify(rows.map((r, i) => ({ id: r.id, sort_order: (i + 1) * 10 }))),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const pindah = (rows: FaqRow[], index: number, arah: -1 | 1) => {
    const target = index + arah;
    if (target < 0 || target >= rows.length) return;
    const salinan = [...rows];
    [salinan[index], salinan[target]] = [salinan[target], salinan[index]];
    reorder.mutate(salinan);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">FAQ</h1>
        <p className="text-sm text-muted-foreground">
          Ditampilkan di halaman Bantuan pelanggan dan mitra. Perubahan langsung
          berlaku tanpa deploy. Untuk menyebut tarif atau batas,{' '}
          <strong>pakai token</strong> — jangan ketik angkanya.
        </p>
      </div>

      {isLoading ? (
        <CenteredSpinner />
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : 'Gagal memuat FAQ.'}
        </div>
      ) : (
        AUDIENCES.map(({ value, label }) => {
          const rows = byAudience.get(value) ?? [];
          return (
            <EntitySection key={value} title={`FAQ ${label}`}>
              <div className="space-y-3">
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => setCreatingFor(value)}>
                    <Plus className="mr-1 size-4" /> Tambah pertanyaan
                  </Button>
                </div>

                {rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada pertanyaan.</p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {rows.map((f, i) => (
                      <li key={f.id} className="flex flex-wrap items-center gap-2 p-3">
                        <div className="flex flex-col">
                          <button
                            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                            onClick={() => pindah(rows, i, -1)}
                            disabled={i === 0 || reorder.isPending}
                            aria-label="Naikkan"
                          >
                            <ArrowUp className="size-3.5" />
                          </button>
                          <button
                            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                            onClick={() => pindah(rows, i, 1)}
                            disabled={i === rows.length - 1 || reorder.isPending}
                            aria-label="Turunkan"
                          >
                            <ArrowDown className="size-3.5" />
                          </button>
                        </div>
                        <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {f.category}
                        </span>
                        <span className="flex-1 truncate text-sm">{f.question}</span>
                        {!f.is_active && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                            <EyeOff className="size-3" /> nonaktif
                          </span>
                        )}
                        {/\{\{\w+\}\}/.test(f.answer) && (
                          <span className="rounded-md bg-sky-500/10 px-2 py-0.5 text-xs text-sky-700 dark:text-sky-400">
                            token
                          </span>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setEditing(f)}>
                          Sunting
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

      {(creatingFor || editing) && (
        <FaqModal
          faq={editing}
          audience={editing?.audience ?? creatingFor!}
          onClose={() => { setEditing(null); setCreatingFor(null); }}
          onDone={refresh}
        />
      )}
    </div>
  );
}

function FaqModal({
  faq,
  audience,
  onClose,
  onDone,
}: {
  faq: FaqRow | null;
  audience: FaqAudience;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    audience: faq?.audience ?? audience,
    category: faq?.category ?? '',
    question: faq?.question ?? '',
    answer: faq?.answer ?? '',
    sort_order: faq?.sort_order ?? 999,
    is_active: faq?.is_active ?? true,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const simpan = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI(faq ? `/admin/faqs/${faq.id}` : '/admin/faqs', {
        method: faq ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => { toast.success(faq ? 'FAQ disimpan' : 'FAQ ditambahkan'); onDone(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const hapus = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI(`/admin/faqs/${faq!.id}`, { method: 'DELETE' });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => { toast.success('FAQ dihapus'); onDone(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const sisipToken = (t: string) => setForm({ ...form, answer: `${form.answer}${t}` });

  return (
    <Modal open onClose={onClose} title={faq ? 'Sunting FAQ' : 'Tambah FAQ'} className="max-w-2xl">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="f-audience">Untuk</Label>
            <select
              id="f-audience"
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value as FaqAudience })}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              {AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-category">Kategori</Label>
            <Input
              id="f-category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="mis. Pembayaran"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="f-question">Pertanyaan</Label>
          <Input
            id="f-question"
            value={form.question}
            onChange={(e) => setForm({ ...form, question: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="f-answer">Jawaban</Label>
          <Textarea
            id="f-answer"
            value={form.answer}
            onChange={(e) => setForm({ ...form, answer: e.target.value })}
            className="min-h-40"
          />
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="mb-2 text-xs font-medium">
              Sisipkan token — angkanya ikut berubah otomatis saat setelan diubah:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TOKENS.map((t) => (
                <button
                  key={t.token}
                  type="button"
                  onClick={() => sisipToken(t.token)}
                  title={t.label}
                  className="rounded-md border bg-background px-2 py-1 font-mono text-[11px] hover:bg-accent"
                >
                  {t.token}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="size-4 rounded border-input"
          />
          Tampilkan di halaman Bantuan
        </label>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Batal</Button>
          {faq && (
            <Button variant="destructive" onClick={() => setConfirmDelete(true)} disabled={hapus.isPending}>
              <Trash2 className="mr-1 size-4" /> Hapus
            </Button>
          )}
          <Button
            onClick={() => simpan.mutate()}
            disabled={simpan.isPending || !form.category.trim() || !form.question.trim() || !form.answer.trim()}
          >
            {simpan.isPending ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => hapus.mutate()}
        variant="danger"
        title="Hapus FAQ ini?"
        description="FAQ tidak menyimpan bukti apa pun, jadi aman dihapus permanen. Bila hanya ingin menyembunyikannya, matikan centang 'Tampilkan di halaman Bantuan'."
        confirmLabel="Hapus"
        loading={hapus.isPending}
      />
    </Modal>
  );
}
