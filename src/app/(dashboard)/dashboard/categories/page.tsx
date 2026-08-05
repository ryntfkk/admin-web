'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CornerDownRight } from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type { Category } from '@/types/admin';
import { nstr, nuuid } from '@/lib/sql';
import { toast } from '@/lib/store/toastStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { DataTable, type Column } from '@/components/ui/data-table';
import { FileUpload } from '@/components/ui/file-upload';

export default function CategoriesPage() {
  const qc = useQueryClient();
  const [editor, setEditor] = useState<{ open: boolean; cat: Category | null }>({
    open: false,
    cat: null,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetchAPI<Category[]>('/admin/categories');
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const rows = data ?? [];
  // Kategori utama (parent_id null) . dipakai untuk dropdown "induk" di editor.
  const mainCategories = rows.filter((c) => !nuuid(c.parent_id));

  const columns: Column<Category>[] = [
    {
      key: 'icon',
      header: 'Ikon',
      width: '64px',
      // Ikon hanya milik kategori utama; baris subkategori sengaja dikosongkan.
      cell: (c) =>
        nuuid(c.parent_id) ? (
          <div className="size-8" />
        ) : nstr(c.icon_url) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={nstr(c.icon_url)!} alt={c.name} className="size-8 rounded object-cover" />
        ) : (
          <div className="size-8 rounded bg-muted" />
        ),
    },
    {
      key: 'name',
      header: 'Nama',
      cell: (c) => {
        const isSub = !!nuuid(c.parent_id);
        return (
          <div className="min-w-0">
            <div className={isSub ? 'flex items-center gap-1.5 pl-4' : ''}>
              {isSub && <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground" />}
              <span className="font-medium">{c.name}</span>
            </div>
            {nstr(c.slug) && (
              <p className={`text-xs text-muted-foreground ${isSub ? 'pl-9' : ''}`}>/{nstr(c.slug)}</p>
            )}
          </div>
        );
      },
    },
    {
      key: 'type',
      header: 'Jenis',
      cell: (c) =>
        nuuid(c.parent_id) ? (
          <Badge variant="neutral">Sub · {nstr(c.parent_name) ?? '.'}</Badge>
        ) : (
          <Badge variant="info">Utama</Badge>
        ),
      hideBelow: 'sm',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (c) =>
        c.is_active ? <Badge variant="success">Aktif</Badge> : <Badge variant="neutral">Nonaktif</Badge>,
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kategori</h1>
          <p className="text-sm text-muted-foreground">
            Kelola kategori &amp; subkategori layanan (2 level) . klik baris untuk mengedit.
          </p>
        </div>
        <Button onClick={() => setEditor({ open: true, cat: null })}>
          <Plus className="size-4" />
          Tambah Kategori
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={data}
        getRowId={(c) => c.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="Belum ada kategori"
        emptyNote="Tambahkan kategori layanan pertama."
        onRowClick={(c) => setEditor({ open: true, cat: c })}
        showDensityToggle={false}
      />

      {editor.open && (
        <CategoryEditor
          cat={editor.cat}
          mains={mainCategories}
          onClose={() => setEditor({ open: false, cat: null })}
          onSaved={() => {
            setEditor({ open: false, cat: null });
            qc.invalidateQueries({ queryKey: ['categories'] });
          }}
        />
      )}
    </div>
  );
}

function CategoryEditor({
  cat,
  mains,
  onClose,
  onSaved,
}: {
  cat: Category | null;
  mains: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!cat;
  const [name, setName] = useState(cat?.name ?? '');
  const [iconUrl, setIconUrl] = useState(cat ? nstr(cat.icon_url) ?? '' : '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isActive, setIsActive] = useState(cat?.is_active ?? true);
  const [parentId, setParentId] = useState(cat ? nuuid(cat.parent_id) ?? '' : '');
  const [slug, setSlug] = useState(cat ? nstr(cat.slug) ?? '' : '');
  const [sortOrder, setSortOrder] = useState<string>(cat ? String(cat.sort_order ?? 0) : '0');

  // Saat mengedit, jangan tawarkan diri sendiri sebagai induk (cegah siklus).
  const parentOptions = mains.filter((m) => m.id !== cat?.id);

  // Subkategori tidak punya ikon di web publik (hanya chip teks), jadi editornya
  // tidak menawarkan upload . dan ikon lama ikut dibuang saat jadi subkategori.
  const isSub = !!parentId;

  const save = useMutation({
    mutationFn: async () => {
      let finalIconUrl = isSub ? '' : iconUrl;

      // If a new file is selected, upload it first
      if (selectedFile && !isSub) {
        const { uploadFileToStorage } = await import('@/components/ui/file-upload');
        const uploadedUrl = await uploadFileToStorage(selectedFile, 'category');
        if (uploadedUrl) {
          finalIconUrl = uploadedUrl;
        } else {
          throw new Error('Gagal mengupload ikon');
        }
      }

      const body = {
        name,
        icon_url: finalIconUrl || null,
        is_active: isActive,
        parent_id: parentId || null,
        slug: slug.trim() || undefined, // kosong → backend generate dari nama
        sort_order: Number.parseInt(sortOrder, 10) || 0,
      };
      const res = isEdit
        ? await fetchAPI(`/admin/categories/${cat!.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
        : await fetchAPI('/admin/categories', { method: 'POST', body: JSON.stringify(body) });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Kategori diperbarui' : 'Kategori dibuat');
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit Kategori' : 'Tambah Kategori'}>
      <div className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <Label>Nama</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kebersihan" />
        </div>

        {/* Kategori induk: kosong = kategori utama, pilih = subkategori. */}
        <div className="flex flex-col gap-1.5">
          <Label>Kategori Induk</Label>
          <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">. Kategori Utama (tanpa induk) .</option>
            {parentOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            Pilih induk untuk menjadikannya subkategori (mis. induk “Events” untuk “Fotografi”).
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Slug (opsional)</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="otomatis dari nama"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Urutan Tampil</Label>
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        {isSub ? (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Subkategori tidak memakai ikon . di web publik subkategori tampil sebagai chip teks.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label>Ikon Kategori</Label>
            <div className="flex items-center gap-4">
              <FileUpload
                currentUrl={iconUrl || undefined}
                onFileSelect={(file) => setSelectedFile(file)}
                onRemove={() => setIconUrl('')}
                previewWidth={80}
                previewHeight={80}
                optional={true}
              />
              <div className="text-xs text-muted-foreground">
                {iconUrl ? (
                  <p className="max-w-48 truncate">{iconUrl}</p>
                ) : selectedFile ? (
                  <p>{selectedFile.name}</p>
                ) : (
                  <p>Upload file atau biarkan kosong</p>
                )}
              </div>
            </div>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="size-4 rounded border-input"
          />
          Aktif (tampil di aplikasi publik)
        </label>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Menyimpan...' : isEdit ? 'Simpan' : 'Tambah'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
