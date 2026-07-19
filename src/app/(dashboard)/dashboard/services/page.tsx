'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Eye, EyeOff, Trash2, ImageIcon, Pencil, Plus, Star, X } from 'lucide-react';
import { fetchAPI, qs } from '@/lib/api';
import { FileUpload, uploadFileToStorage } from '@/components/ui/file-upload';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type { ServiceRow, ServiceDetail, ServicePhoto, Category } from '@/types/admin';
import { nstr } from '@/lib/sql';
import { formatDateTime, formatIDR } from '@/lib/format';
import { toast } from '@/lib/store/toastStore';
import { SERVICE_STATUS_OPTIONS } from '@/lib/enums';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { CenteredSpinner, EmptyState } from '@/components/ui/feedback';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

const PER_PAGE = 20;

export default function ServicesPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<ServiceRow | null>(null);
  const [toEdit, setToEdit] = useState<ServiceRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['services', status, search, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<ServiceRow>>(
        `/admin/services${qs({ status, q: search, page, per_page: PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const setActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetchAPI(`/admin/services/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: isActive }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: (_r, vars) => {
      toast.success(vars.isActive ? 'Layanan diaktifkan' : 'Layanan dinonaktifkan');
      qc.invalidateQueries({ queryKey: ['services'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchAPI(`/admin/services/${id}`, { method: 'DELETE' });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Layanan dihapus');
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ['services'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Produk Jasa</h1>
        <p className="text-sm text-muted-foreground">
          Moderasi layanan yang ditawarkan mitra — aktif/nonaktifkan atau hapus
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-44">
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {SERVICE_STATUS_OPTIONS.map((o) => (
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
            placeholder="Cari nama layanan, mitra, kategori…"
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
        <EmptyState title="Tidak ada layanan" note="Coba ubah filter pencarian." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Layanan</TableHead>
                <TableHead>Mitra</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Harga</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-medium">{s.name}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ImageIcon className="size-3" />
                      {s.photo_count} foto · {s.estimated_duration} mnt
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.partner_name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.category_name}</TableCell>
                  <TableCell>
                    {formatIDR(s.price)}
                    <span className="text-xs text-muted-foreground">{' '}/{s.unit === 'per_hour' ? 'jam' : s.unit === 'per_unit' ? 'unit' : 'jasa'}</span>
                  </TableCell>
                  <TableCell>
                    {s.is_active ? (
                      <Badge variant="success">Aktif</Badge>
                    ) : (
                      <Badge variant="neutral">Nonaktif</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setToEdit(s)}
                      >
                        <Pencil className="size-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={setActive.isPending}
                        onClick={() => setActive.mutate({ id: s.id, isActive: !s.is_active })}
                      >
                        {s.is_active ? (
                          <>
                            <EyeOff className="size-4" />
                            Nonaktifkan
                          </>
                        ) : (
                          <>
                            <Eye className="size-4" />
                            Aktifkan
                          </>
                        )}
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => setToDelete(s)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />
        </>
      )}

      {toDelete && (
        <Modal open onClose={() => setToDelete(null)} title="Hapus Layanan">
          <div className="space-y-4">
            <p className="text-sm">
              Yakin ingin menghapus layanan{' '}
              <span className="font-medium">{toDelete.name}</span> milik{' '}
              <span className="font-medium">{toDelete.partner_name}</span>? Tindakan ini
              menyembunyikan layanan dari aplikasi (soft delete).
            </p>
            {nstr(toDelete.description) && (
              <p className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {nstr(toDelete.description)}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Dibuat {formatDateTime(toDelete.created_at)}
            </p>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="ghost" onClick={() => setToDelete(null)}>
                Batal
              </Button>
              <Button
                variant="destructive"
                disabled={remove.isPending}
                onClick={() => remove.mutate(toDelete.id)}
              >
                Hapus
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {toEdit && (
        <ServiceEditor
          service={toEdit}
          onClose={() => setToEdit(null)}
          onSaved={() => {
            setToEdit(null);
            qc.invalidateQueries({ queryKey: ['services'] });
          }}
        />
      )}
    </div>
  );
}

function ServiceEditor({
  service,
  onClose,
  onSaved,
}: {
  service: ServiceRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(nstr(service.description) ?? '');
  const [price, setPrice] = useState(service.price.toString());
  const [unit, setUnit] = useState(service.unit || 'per_service');
  const [estimatedDuration, setEstimatedDuration] = useState(service.estimated_duration.toString());
  const [isActive, setIsActive] = useState(service.is_active);
  const [categoryId, setCategoryId] = useState(service.category_id);
  const [includedItems, setIncludedItems] = useState<string>('');
  const [excludedItems, setExcludedItems] = useState<string>('');
  const [isAddingPhoto, setIsAddingPhoto] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Daftar kategori untuk dropdown pemindah kategori
  const { data: categories } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const res = await fetchAPI<Category[]>('/admin/categories');
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  // Fetch service detail with photos
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['service-detail', service.id],
    queryFn: async () => {
      const res = await fetchAPI<ServiceDetail>(`/admin/services/${service.id}`);
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  useEffect(() => {
    if (detail) {
      setIncludedItems((detail.included_items || []).join('\n'));
      setExcludedItems((detail.excluded_items || []).join('\n'));
    }
  }, [detail]);

  const save = useMutation({
    mutationFn: async () => {
      const priceNum = parseInt(price, 10);
      // per_hour: estimasi dikunci ke 60 menit (1 jam); selain itu dari input admin.
      const durationNum = unit === 'per_hour' ? 60 : parseInt(estimatedDuration, 10);

      if (isNaN(priceNum) || priceNum < 0) {
        throw new Error('Harga harus angka positif');
      }
      if (unit !== 'per_hour' && (isNaN(durationNum) || durationNum < 15)) {
        throw new Error('Durasi estimasi minimal 15 menit');
      }

      const res = await fetchAPI(`/admin/services/${service.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          price: priceNum,
          unit,
          estimated_duration: durationNum,
          is_active: isActive,
          category_id: categoryId,
          included_items: includedItems.split('\n').map(i => i.trim()).filter(Boolean),
          excluded_items: excludedItems.split('\n').map(i => i.trim()).filter(Boolean),
        }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Layanan berhasil diperbarui');
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPhoto = useMutation({
    mutationFn: async () => {
      let url: string;

      if (selectedFile) {
        // Upload file first
        const uploadedUrl = await uploadFileToStorage(selectedFile, 'service_photo');
        if (!uploadedUrl) {
          throw new Error('Gagal mengupload foto');
        }
        url = uploadedUrl;
      } else {
        throw new Error('Pilih file foto terlebih dahulu');
      }

      const res = await fetchAPI(`/admin/services/${service.id}/photos`, {
        method: 'POST',
        body: JSON.stringify({
          photo_url: url,
          is_primary: !detail?.photos?.length,
        }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Foto ditambahkan');
      setSelectedFile(null);
      setIsAddingPhoto(false);
      qc.invalidateQueries({ queryKey: ['service-detail', service.id] });
      qc.invalidateQueries({ queryKey: ['services'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePhoto = useMutation({
    mutationFn: async (photoId: string) => {
      const res = await fetchAPI(`/admin/services/${service.id}/photos/${photoId}`, {
        method: 'DELETE',
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Foto dihapus');
      qc.invalidateQueries({ queryKey: ['service-detail', service.id] });
      qc.invalidateQueries({ queryKey: ['services'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setPrimaryPhoto = useMutation({
    mutationFn: async (photoId: string) => {
      const res = await fetchAPI(`/admin/services/${service.id}/photos/${photoId}/primary`, {
        method: 'PUT',
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Foto utama diperbarui');
      qc.invalidateQueries({ queryKey: ['service-detail', service.id] });
      qc.invalidateQueries({ queryKey: ['services'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const priceNum = parseInt(price, 10);
  const durationNum = parseInt(estimatedDuration, 10);
  const isValid =
    name.trim().length > 0 &&
    !isNaN(priceNum) &&
    priceNum >= 0 &&
    !isNaN(durationNum) &&
    durationNum > 0;

  const photos = detail?.photos ?? [];

  return (
    <Modal open onClose={onClose} title="Edit Layanan" className="max-w-2xl">
      <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
        {/* Mitra info (read-only) */}
        <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
          <p className="text-xs text-muted-foreground">Mitra</p>
          <p className="font-medium">{service.partner_name}</p>
        </div>

        {/* Nama */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Nama Layanan</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Cuci AC Standar"
          />
        </div>

        {/* Deskripsi */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Deskripsi</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Jelaskan layanan yang diberikan…"
            rows={3}
            className="flex min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {/* Satuan Harga */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Satuan Harga</label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <option value="per_service">Per Jasa (borongan)</option>
            <option value="per_hour">Per Jam</option>
            <option value="per_unit">Per Unit</option>
          </select>
        </div>

        {/* Harga & Durasi */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Harga (Rp)</label>
            <Input
              type="number"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="150000"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Durasi (menit)</label>
            <Input
              type="number"
              min="15"
              value={unit === 'per_hour' ? 60 : estimatedDuration}
              disabled={unit === 'per_hour'}
              onChange={(e) => setEstimatedDuration(e.target.value)}
              placeholder="60"
            />
            {unit === 'per_hour' && (
              <p className="text-xs text-muted-foreground">Otomatis 1 jam / satuan</p>
            )}
          </div>
        </div>

        {/* Termasuk & Tidak Termasuk */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-green-600">Termasuk (Include)</label>
            <textarea
              value={includedItems}
              onChange={(e) => setIncludedItems(e.target.value)}
              placeholder="Pisahkan dengan baris baru (enter)..."
              rows={4}
              className="flex min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-red-600">Tidak Termasuk (Exclude)</label>
            <textarea
              value={excludedItems}
              onChange={(e) => setExcludedItems(e.target.value)}
              placeholder="Pisahkan dengan baris baru (enter)..."
              rows={4}
              className="flex min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
            />
          </div>
        </div>

        {/* Status aktif */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="size-4 rounded border-input"
          />
          Aktif (tampil di aplikasi publik)
        </label>

        {/* Kategori */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Kategori</label>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {/* Pastikan kategori saat ini tetap ada di opsi walau sudah nonaktif */}
            {!categories?.some((c) => c.id === service.category_id) && (
              <option value={service.category_id}>{service.category_name}</option>
            )}
            {categories?.map((c) => (
              <option key={c.id} value={c.id} disabled={!c.is_active && c.id !== service.category_id}>
                {c.name}{!c.is_active ? ' (nonaktif)' : ''}
              </option>
            ))}
          </Select>
        </div>

        {/* Photos Section */}
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Foto Layanan</label>
            <span className="text-xs text-muted-foreground">{photos.length} foto</span>
          </div>

          {detailLoading ? (
            <div className="flex justify-center py-4">
              <CenteredSpinner />
            </div>
          ) : (
            <>
              {/* Photo grid */}
              {photos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((photo: ServicePhoto) => (
                    <div key={photo.id} className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.photo_url}
                        alt="Service photo"
                        className="h-24 w-full rounded-lg object-cover border border-border"
                      />
                      {/* Primary badge */}
                      {photo.is_primary && (
                        <div className="absolute left-1 top-1 rounded bg-yellow-500 px-1.5 py-0.5 text-xs font-medium text-white flex items-center gap-0.5">
                          <Star className="size-2.5" />
                          Utama
                        </div>
                      )}
                      {/* Actions overlay */}
                      <div className="absolute inset-0 flex items-center justify-center gap-1 rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!photo.is_primary && (
                          <button
                            type="button"
                            onClick={() => setPrimaryPhoto.mutate(photo.id)}
                            className="rounded bg-white/20 p-1.5 text-white hover:bg-white/30"
                            title="Jadikan foto utama"
                          >
                            <Star className="size-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deletePhoto.mutate(photo.id)}
                          className="rounded bg-red-500/80 p-1.5 text-white hover:bg-red-500"
                          title="Hapus foto"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                  Belum ada foto
                </div>
              )}

              {/* Add photo form */}
              {!isAddingPhoto ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddingPhoto(true)}
                >
                  <Plus className="size-4" />
                  Tambah Foto
                </Button>
              ) : (
                <div className="flex gap-4 items-start">
                  <FileUpload
                    fileType="service_photo"
                    maxSizeMB={10}
                    onFileSelect={(file) => setSelectedFile(file)}
                    previewWidth={80}
                    previewHeight={80}
                    label="Pilih File"
                  />
                  <div className="flex flex-col gap-2 pt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsAddingPhoto(false);
                        setSelectedFile(null);
                      }}
                    >
                      Batal
                    </Button>
                    <Button
                      size="sm"
                      disabled={!selectedFile || addPhoto.isPending}
                      onClick={() => addPhoto.mutate()}
                    >
                      {addPhoto.isPending ? 'Mengupload...' : 'Simpan'}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            disabled={!isValid || save.isPending}
            onClick={() => save.mutate()}
          >
            Simpan Perubahan
          </Button>
        </div>
      </div>
    </Modal>
  );
}
