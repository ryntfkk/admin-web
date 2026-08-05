'use client';

import { useState, type DragEvent, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, GripVertical, Check, Loader2, AlertCircle, ChevronRight } from 'lucide-react';
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
import { CenteredSpinner, EmptyState } from '@/components/ui/feedback';
import { FileUpload } from '@/components/ui/file-upload';

/** Satu kategori utama beserta subkategorinya. */
interface CategoryNode {
  cat: Category;
  children: Category[];
}

/** Perintah "kategori ini pindah ke urutan sekian" untuk endpoint reorder. */
interface OrderItem {
  id: string;
  sort_order: number;
}

/**
 * Menyusun daftar datar dari API menjadi pohon 2 level, diurut persis seperti
 * yang dilihat publik (sort_order lalu nama). Pengurutan diulang di klien . tak
 * bergantung pada urutan kiriman backend . supaya hasil geseran terlihat sama
 * di panel dan di aplikasi.
 */
function buildTree(rows: Category[]): CategoryNode[] {
  const byOrder = (a: Category, b: Category) =>
    a.sort_order - b.sort_order || a.name.localeCompare(b.name);

  const mains = rows.filter((c) => !nuuid(c.parent_id)).sort(byOrder);
  return mains.map((cat) => ({
    cat,
    children: rows.filter((c) => nuuid(c.parent_id) === cat.id).sort(byOrder),
  }));
}

/** Memindahkan satu elemen array dari indeks `from` ke `to` (salinan baru). */
function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Selisih antara pohon di layar dan sort_order yang tersimpan di server.
 * Urutan dinormalkan ke 1..N per tingkat, jadi celah lama (1,2,3,10,11…)
 * sekalian dirapikan pada geseran pertama.
 */
function diffOrder(tree: CategoryNode[]): OrderItem[] {
  const changed: OrderItem[] = [];
  tree.forEach((node, i) => {
    if (node.cat.sort_order !== i + 1) changed.push({ id: node.cat.id, sort_order: i + 1 });
    node.children.forEach((child, j) => {
      if (child.sort_order !== j + 1) changed.push({ id: child.id, sort_order: j + 1 });
    });
  });
  return changed;
}

/**
 * Identitas item yang sedang diseret. `parentId` null = kategori utama.
 * Dipakai untuk menolak drop lintas tingkat/induk: memindahkan subkategori ke
 * induk lain adalah perubahan hierarki (slug & ikon ikut berubah), itu tetap
 * lewat editor . bukan efek samping geseran.
 */
interface DragRef {
  id: string;
  parentId: string | null;
}

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

  // Pohon disalin ke state lokal supaya geseran terasa seketika; server menyusul.
  // Disinkronkan saat render (bukan di useEffect) mengikuti pola resmi React
  // untuk state turunan . useEffect menimbulkan render berjenjang dan daftar
  // sempat tampil dengan urutan lama.
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [syncedFrom, setSyncedFrom] = useState<Category[] | undefined>(undefined);
  if (data !== syncedFrom) {
    setSyncedFrom(data);
    setTree(buildTree(data ?? []));
  }

  // Subkategori terlipat secara bawaan: 168 kategori sekaligus membuat daftar
  // ini tak bisa dibaca, padahal yang paling sering disusun adalah tingkat atas.
  // Kunci = id kategori utama yang sedang dibuka.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const expandable = tree.filter((n) => n.children.length > 0);
  const allExpanded = expandable.length > 0 && expandable.every((n) => expanded.has(n.cat.id));

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  const [drag, setDrag] = useState<DragRef | null>(null);
  // Baris hanya boleh diseret lewat gagangnya . tanpa ini, usaha menyeleksi
  // teks di baris ikut memulai drag.
  const [dragArmed, setDragArmed] = useState<string | null>(null);
  const rows = data ?? [];
  const mainCategories = rows.filter((c) => !nuuid(c.parent_id));

  const reorder = useMutation({
    mutationFn: async (items: OrderItem[]) => {
      const res = await fetchAPI('/admin/categories/reorder', {
        method: 'PUT',
        body: JSON.stringify({ items }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
    onError: (e: Error) => {
      toast.error(e.message);
      // Urutan di layar sudah bergeser padahal server menolak . kembalikan ke
      // kebenaran terakhir yang diketahui, jangan biarkan admin percaya urutan
      // yang tidak tersimpan.
      setTree(buildTree(data ?? []));
    },
  });

  /** Terapkan pohon baru ke layar, lalu simpan bagian yang berubah saja. */
  function applyTree(next: CategoryNode[]) {
    setTree(next);
    const changed = diffOrder(next);
    if (changed.length > 0) reorder.mutate(changed);
  }

  /** Pindahkan kategori utama ke posisi `to`. */
  function moveMain(from: number, to: number) {
    if (from === to || to < 0 || to >= tree.length) return;
    applyTree(moveItem(tree, from, to));
  }

  /** Pindahkan subkategori di dalam induknya sendiri. */
  function moveSub(mainIndex: number, from: number, to: number) {
    const node = tree[mainIndex];
    if (!node || from === to || to < 0 || to >= node.children.length) return;
    const next = tree.slice();
    next[mainIndex] = { ...node, children: moveItem(node.children, from, to) };
    applyTree(next);
  }

  /**
   * Menggeser saat kursor melewati baris lain (bukan menunggu drop), sehingga
   * admin melihat hasilnya sambil menyeret.
   */
  function handleDragOver(e: DragEvent, target: DragRef) {
    if (!drag || drag.id === target.id) return;
    // Lintas tingkat / lintas induk: tak ada arti urutannya, tolak.
    if (drag.parentId !== target.parentId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (drag.parentId === null) {
      const from = tree.findIndex((n) => n.cat.id === drag.id);
      const to = tree.findIndex((n) => n.cat.id === target.id);
      if (from === -1 || to === -1 || from === to) return;
      setTree(moveItem(tree, from, to));
      return;
    }

    const mainIndex = tree.findIndex((n) => n.cat.id === drag.parentId);
    if (mainIndex === -1) return;
    const children = tree[mainIndex].children;
    const from = children.findIndex((c) => c.id === drag.id);
    const to = children.findIndex((c) => c.id === target.id);
    if (from === -1 || to === -1 || from === to) return;
    const next = tree.slice();
    next[mainIndex] = { ...tree[mainIndex], children: moveItem(children, from, to) };
    setTree(next);
  }

  /** Penyimpanan terjadi sekali di akhir geseran, bukan tiap kali melewati baris. */
  function handleDragEnd() {
    setDrag(null);
    setDragArmed(null);
    const changed = diffOrder(tree);
    if (changed.length > 0) reorder.mutate(changed);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kategori</h1>
          <p className="text-sm text-muted-foreground">
            Seret gagang{' '}
            <GripVertical className="inline size-3.5 align-text-bottom text-muted-foreground" /> untuk
            mengubah urutan tampil . klik baris untuk mengedit.
          </p>
        </div>
        <Button onClick={() => setEditor({ open: true, cat: null })}>
          <Plus className="size-4" />
          Tambah Kategori
        </Button>
      </div>

      <div className="flex min-h-8 items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {reorder.isPending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Menyimpan urutan.
            </>
          ) : reorder.isSuccess ? (
            <>
              <Check className="size-3.5 text-success" />
              Urutan tersimpan . langsung tampil di aplikasi publik.
            </>
          ) : (
            'Subkategori hanya bisa digeser di dalam induknya. Untuk pindah induk, buka editornya.'
          )}
        </div>
        {expandable.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setExpanded(allExpanded ? new Set() : new Set(expandable.map((n) => n.cat.id)))
            }
          >
            {allExpanded ? 'Tutup semua subkategori' : 'Buka semua subkategori'}
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-2">
        {isLoading ? (
          <CenteredSpinner />
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
            <div className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertCircle className="size-5" />
            </div>
            <p className="text-sm font-medium">Gagal memuat data</p>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : 'Terjadi kesalahan tak terduga.'}
            </p>
          </div>
        ) : tree.length === 0 ? (
          <EmptyState title="Belum ada kategori" note="Tambahkan kategori layanan pertama." />
        ) : (
          <ul className="space-y-1.5">
            {tree.map((node, mainIndex) => (
              <li
                key={node.cat.id}
                draggable={dragArmed === node.cat.id}
                onDragStart={() => setDrag({ id: node.cat.id, parentId: null })}
                onDragOver={(e) => handleDragOver(e, { id: node.cat.id, parentId: null })}
                onDragEnd={handleDragEnd}
                className={`overflow-hidden rounded-lg border border-border bg-card transition-opacity ${drag?.id === node.cat.id ? 'opacity-40' : ''
                  }`}
              >
                <CategoryRow
                  cat={node.cat}
                  position={`${mainIndex + 1} dari ${tree.length}`}
                  onArm={() => setDragArmed(node.cat.id)}
                  onDisarm={() => setDragArmed(null)}
                  onMoveUp={() => moveMain(mainIndex, mainIndex - 1)}
                  onMoveDown={() => moveMain(mainIndex, mainIndex + 1)}
                  onEdit={() => setEditor({ open: true, cat: node.cat })}
                  trailing={
                    node.children.length > 0 ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpanded(node.cat.id);
                        }}
                        aria-expanded={expanded.has(node.cat.id)}
                        aria-controls={`sub-${node.cat.id}`}
                        className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <ChevronRight
                          className={`size-3.5 transition-transform ${expanded.has(node.cat.id) ? 'rotate-90' : ''
                            }`}
                        />
                        {node.children.length} sub
                      </button>
                    ) : (
                      <Badge variant="info">Utama</Badge>
                    )
                  }
                />

                {node.children.length > 0 && expanded.has(node.cat.id) && (
                  <ul
                    id={`sub-${node.cat.id}`}
                    className="space-y-1 border-t border-border/60 bg-muted/20 p-1.5"
                  >
                    {node.children.map((child, subIndex) => (
                      <li
                        key={child.id}
                        draggable={dragArmed === child.id}
                        onDragStart={() => setDrag({ id: child.id, parentId: node.cat.id })}
                        onDragOver={(e) => handleDragOver(e, { id: child.id, parentId: node.cat.id })}
                        onDragEnd={handleDragEnd}
                        className={`rounded-md bg-card transition-opacity ${drag?.id === child.id ? 'opacity-40' : ''
                          }`}
                      >
                        <CategoryRow
                          cat={child}
                          isSub
                          position={`${subIndex + 1} dari ${node.children.length} di ${node.cat.name}`}
                          onArm={() => setDragArmed(child.id)}
                          onDisarm={() => setDragArmed(null)}
                          onMoveUp={() => moveSub(mainIndex, subIndex, subIndex - 1)}
                          onMoveDown={() => moveSub(mainIndex, subIndex, subIndex + 1)}
                          onEdit={() => setEditor({ open: true, cat: child })}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {editor.open && (
        <CategoryEditor
          cat={editor.cat}
          mains={mainCategories}
          tree={tree}
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

/**
 * Satu baris kategori: gagang seret, identitas, status.
 *
 * Gagangnya sekaligus kontrol keyboard (panah atas/bawah) . drag & drop HTML5
 * tidak bisa dipakai tanpa tetikus, dan urutan kategori terlalu penting untuk
 * hanya bisa diubah dengan satu cara.
 */
function CategoryRow({
  cat,
  isSub = false,
  position,
  onArm,
  onDisarm,
  onMoveUp,
  onMoveDown,
  onEdit,
  trailing,
}: {
  cat: Category;
  isSub?: boolean;
  position: string;
  onArm: () => void;
  onDisarm: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  trailing?: ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit();
        }
      }}
      className={`flex cursor-pointer items-center gap-3 px-2.5 hover:bg-muted/40 focus-visible:bg-muted/60 focus-visible:outline-none ${isSub ? 'py-1.5' : 'py-2.5'
        }`}
    >
      <button
        type="button"
        aria-label={`Geser ${cat.name} . posisi ${position}. Panah atas/bawah untuk memindahkan.`}
        title="Seret untuk mengubah urutan (atau panah atas/bawah)"
        onMouseDown={onArm}
        onMouseUp={onDisarm}
        onBlur={onDisarm}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            onMoveUp();
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            onMoveDown();
          }
        }}
        className="shrink-0 cursor-grab rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>

      {/* Ikon hanya milik kategori utama; baris subkategori sengaja dikosongkan. */}
      {isSub ? (
        <div className="w-4 shrink-0" />
      ) : nstr(cat.icon_url) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={nstr(cat.icon_url)!} alt="" className="size-8 shrink-0 rounded object-cover" />
      ) : (
        <div className="size-8 shrink-0 rounded bg-muted" />
      )}

      <div className="min-w-0 flex-1">
        <p className={`truncate ${isSub ? 'text-sm' : 'font-medium'}`}>{cat.name}</p>
        {nstr(cat.slug) && (
          <p className="truncate text-xs text-muted-foreground">/{nstr(cat.slug)}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {trailing}
        {cat.is_active ? (
          <Badge variant="success">Aktif</Badge>
        ) : (
          <Badge variant="neutral">Nonaktif</Badge>
        )}
      </div>
    </div>
  );
}

function CategoryEditor({
  cat,
  mains,
  tree,
  onClose,
  onSaved,
}: {
  cat: Category | null;
  mains: Category[];
  tree: CategoryNode[];
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

  // Saat mengedit, jangan tawarkan diri sendiri sebagai induk (cegah siklus).
  const parentOptions = mains.filter((m) => m.id !== cat?.id);

  // Subkategori tidak punya ikon di web publik (hanya chip teks), jadi editornya
  // tidak menawarkan upload . dan ikon lama ikut dibuang saat jadi subkategori.
  const isSub = !!parentId;

  /**
   * Urutan tidak lagi diketik: yang diedit mempertahankan posisinya, yang baru
   * jatuh ke urutan terakhir tingkatnya. Setelah itu admin menggesernya.
   */
  function nextSortOrder(): number {
    if (cat) return cat.sort_order;
    const siblings = parentId
      ? (tree.find((n) => n.cat.id === parentId)?.children ?? [])
      : tree.map((n) => n.cat);
    return siblings.length + 1;
  }

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
        sort_order: nextSortOrder(),
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

        <div className="flex flex-col gap-1.5">
          <Label>Slug (opsional)</Label>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="otomatis dari nama"
          />
          <p className="text-xs text-muted-foreground">
            {isEdit
              ? 'Urutan tampil diatur dengan menggeser baris di daftar.'
              : 'Kategori baru masuk ke urutan terakhir . geser di daftar untuk memindahkannya.'}
          </p>
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
