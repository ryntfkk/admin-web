'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil } from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type { Category } from '@/types/admin';
import { nstr } from '@/lib/sql';
import { toast } from '@/lib/store/toastStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { CenteredSpinner, EmptyState } from '@/components/ui/feedback';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

export default function CategoriesPage() {
  const qc = useQueryClient();
  const [editor, setEditor] = useState<{ open: boolean; cat: Category | null }>({
    open: false,
    cat: null,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetchAPI<Category[]>('/admin/categories');
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const rows = data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kategori</h1>
          <p className="text-sm text-muted-foreground">Kelola kategori layanan</p>
        </div>
        <Button onClick={() => setEditor({ open: true, cat: null })}>
          <Plus className="size-4" />
          Tambah Kategori
        </Button>
      </div>

      {isLoading ? (
        <CenteredSpinner />
      ) : rows.length === 0 ? (
        <EmptyState title="Belum ada kategori" note="Tambahkan kategori layanan pertama." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ikon</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  {nstr(c.icon_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={nstr(c.icon_url)!}
                      alt={c.name}
                      className="size-8 rounded object-cover"
                    />
                  ) : (
                    <div className="size-8 rounded bg-muted" />
                  )}
                </TableCell>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>
                  {c.is_active ? (
                    <Badge variant="success">Aktif</Badge>
                  ) : (
                    <Badge variant="neutral">Nonaktif</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditor({ open: true, cat: c })}
                  >
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {editor.open && (
        <CategoryEditor
          cat={editor.cat}
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
  onClose,
  onSaved,
}: {
  cat: Category | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!cat;
  const [name, setName] = useState(cat?.name ?? '');
  const [iconUrl, setIconUrl] = useState(cat ? nstr(cat.icon_url) ?? '' : '');
  const [isActive, setIsActive] = useState(cat?.is_active ?? true);

  const save = useMutation({
    mutationFn: async () => {
      const body = { name, icon_url: iconUrl, is_active: isActive };
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
      <div className="space-y-3">
        <div className="flex flex-col gap-1.5">
          <Label>Nama</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kebersihan" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>URL Ikon</Label>
          <Input
            value={iconUrl}
            onChange={(e) => setIconUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>
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
            {isEdit ? 'Simpan' : 'Tambah'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
