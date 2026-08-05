'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type { RequirementCatalogItem, RequirementKind } from '@/types/admin';
import { REQUIREMENT_KINDS } from '@/types/admin';
import { toast } from '@/lib/store/toastStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { DataTable, type Column } from '@/components/ui/data-table';

// Katalog persyaratan yang bisa dipilih mitra pada layanannya.
//
// Menonaktifkan item TIDAK menghapusnya dari layanan yang sudah memakainya .
// FK-nya ON DELETE RESTRICT, dan itu disengaja: pesanan yang sudah terlanjur
// menyimpan snapshot tidak boleh kehilangan maknanya. Nonaktif hanya
// menyembunyikan item dari pilihan BARU.
const KIND_LABEL: Record<RequirementKind, string> = {
  UTILITY: 'Utilitas',
  ACCESS: 'Akses',
  SPACE: 'Ruang',
  SAFETY: 'Keamanan',
  PRESENCE: 'Kehadiran',
  OTHER: 'Lainnya',
};

type EditorState =
  | { mode: 'create' }
  | { mode: 'edit'; item: RequirementCatalogItem }
  | null;

export default function RequirementsPage() {
  const qc = useQueryClient();
  const [editor, setEditor] = useState<EditorState>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['requirement-catalog'],
    queryFn: async () => {
      const res = await fetchAPI<RequirementCatalogItem[]>('/admin/requirement-catalog');
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const columns: Column<RequirementCatalogItem>[] = [
    {
      key: 'label',
      header: 'Persyaratan',
      cell: (r) => (
        <div className="flex flex-col">
          <span className="font-medium">{r.label}</span>
          <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
        </div>
      ),
    },
    {
      key: 'kind',
      header: 'Jenis',
      cell: (r) => <span className="text-muted-foreground">{KIND_LABEL[r.kind] ?? r.kind}</span>,
      hideBelow: 'sm',
    },
    {
      key: 'used',
      header: 'Dipakai',
      cell: (r) => (
        <span className="text-muted-foreground">
          {r.used_by_count > 0 ? `${r.used_by_count} layanan` : '.'}
        </span>
      ),
      hideBelow: 'md',
    },
    {
      key: 'order',
      header: 'Urutan',
      cell: (r) => <span className="text-muted-foreground">{r.sort_order}</span>,
      hideBelow: 'md',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <Badge variant={r.is_active ? 'success' : 'neutral'}>
          {r.is_active ? 'Aktif' : 'Nonaktif'}
        </Badge>
      ),
    },
    {
      key: 'aksi',
      header: '',
      cell: (r) => (
        <Button variant="ghost" size="sm" onClick={() => setEditor({ mode: 'edit', item: r })}>
          <Pencil className="size-4" />
          Ubah
        </Button>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Persyaratan Pelanggan</h1>
          <p className="text-sm text-muted-foreground">
            Daftar baku yang bisa dipilih mitra pada layanannya . mis. stop kontak, sumber
            air, akses parkir. Menjaga kalimatnya konsisten agar pelanggan tidak membaca
            puluhan variasi untuk hal yang sama.
          </p>
        </div>
        <Button onClick={() => setEditor({ mode: 'create' })}>
          <Plus className="size-4" />
          Tambah
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={data}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="Katalog kosong"
        emptyNote="Tambahkan item pertama agar mitra punya pilihan baku."
      />

      {editor && (
        <RequirementEditorDialog
          state={editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            qc.invalidateQueries({ queryKey: ['requirement-catalog'] });
          }}
        />
      )}
    </div>
  );
}

function RequirementEditorDialog({
  state,
  onClose,
  onSaved,
}: {
  state: NonNullable<EditorState>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isCreate = state.mode === 'create';
  const existing = state.mode === 'edit' ? state.item : null;

  const [form, setForm] = useState({
    code: existing?.code ?? '',
    kind: (existing?.kind ?? 'OTHER') as RequirementKind,
    label: existing?.label ?? '',
    hint: existing?.hint ?? '',
    icon: existing?.icon ?? '',
    sort_order: String(existing?.sort_order ?? 0),
    is_active: existing?.is_active ?? true,
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        code: form.code.trim(),
        kind: form.kind,
        label: form.label.trim(),
        hint: form.hint.trim(),
        icon: form.icon.trim(),
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
      };
      if (!body.label) throw new Error('Label wajib diisi');
      if (isCreate && !body.code) throw new Error('Code wajib diisi');

      const res = await fetchAPI(
        isCreate ? '/admin/requirement-catalog' : `/admin/requirement-catalog/${existing!.id}`,
        { method: isCreate ? 'POST' : 'PUT', body: JSON.stringify(body) },
      );
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success(isCreate ? 'Item katalog ditambahkan' : 'Item katalog disimpan');
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Menonaktifkan item yang masih dipakai layanan hidup perlu diberitahukan .
  // dampaknya tidak terlihat dari halaman ini.
  const willHideFromActiveServices =
    !form.is_active && (existing?.used_by_count ?? 0) > 0;

  return (
    <Modal open onClose={onClose} title={isCreate ? 'Tambah Persyaratan' : 'Ubah Persyaratan'}>
      <div className="space-y-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="req-code">Code</Label>
          <Input
            id="req-code"
            value={form.code}
            disabled={!isCreate}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            placeholder="power_outlet"
          />
          <p className="text-xs text-muted-foreground">
            {isCreate
              ? 'Huruf kecil, angka, dan garis bawah. Dipakai sebagai kunci tetap.'
              : 'Code tidak bisa diubah . ia menjadi rujukan layanan dan kunci pada snapshot pesanan yang sudah terlanjur dibuat.'}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="req-label">Label</Label>
          <Input
            id="req-label"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            placeholder="Sumber listrik / stop kontak"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="req-hint">Penjelasan</Label>
          <Input
            id="req-hint"
            value={form.hint}
            onChange={(e) => setForm((f) => ({ ...f, hint: e.target.value }))}
            placeholder="Mitra membutuhkan stop kontak 220V di dekat area kerja."
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="req-kind">Jenis</Label>
            <select
              id="req-kind"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={form.kind}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as RequirementKind }))}
            >
              {REQUIREMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="req-sort">Urutan</Label>
            <Input
              id="req-sort"
              value={form.sort_order}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
              placeholder="10"
            />
          </div>
        </div>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            className="mt-1 size-4 shrink-0"
          />
          <span className="text-sm">
            <span className="font-medium">Aktif</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Hanya item aktif yang muncul sebagai pilihan saat mitra menyusun layanan.
            </span>
          </span>
        </label>

        {willHideFromActiveServices && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Item ini masih dipakai <strong>{existing!.used_by_count} layanan</strong>.
            Menonaktifkannya <strong>tidak</strong> menghapusnya dari layanan tersebut .
            pelanggan tetap melihatnya. Ia hanya hilang dari pilihan baru.
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Simpan
          </Button>
        </div>
      </div>
    </Modal>
  );
}
