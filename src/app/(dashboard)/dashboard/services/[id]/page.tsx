'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Plus, Star, Trash2, X } from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type { Category, ServiceDetail, ServicePhoto } from '@/types/admin';
import { nstr } from '@/lib/sql';
import { formatDateTime, formatIDR } from '@/lib/format';
import { toast } from '@/lib/store/toastStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EntityPage, EntitySection, type EntityTab } from '@/components/ui/entity-page';
import { FileUpload, uploadFileToStorage } from '@/components/ui/file-upload';

export default function ServiceDetailPage() {
  const { id: serviceId } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['service-detail', serviceId],
    queryFn: async () => {
      const res = await fetchAPI<ServiceDetail>(`/admin/services/${serviceId}`);
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['service-detail', serviceId] });
    qc.invalidateQueries({ queryKey: ['services'] });
  }

  const setActive = useMutation({
    mutationFn: async (isActive: boolean) => {
      const res = await fetchAPI(`/admin/services/${serviceId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: isActive }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: (_r, isActive) => {
      toast.success(isActive ? 'Layanan diaktifkan' : 'Layanan dinonaktifkan');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI(`/admin/services/${serviceId}`, { method: 'DELETE' });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Layanan dihapus');
      qc.invalidateQueries({ queryKey: ['services'] });
      router.push('/dashboard/services');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tabs: EntityTab[] = data
    ? [
      {
        id: 'detail',
        label: 'Detail',
        // `key` membuat state form ter-inisialisasi ulang saat layanan berganti,
        // tanpa efek penyalin yang bisa menimpa suntingan yang belum disimpan.
        content: <ServiceForm key={data.id} detail={data} onSaved={invalidate} />,
      },
      {
        id: 'foto',
        label: 'Foto',
        count: data.photos?.length ?? 0,
        content: <PhotosTab serviceId={serviceId} photos={data.photos ?? []} onChanged={invalidate} />,
      },
      {
        id: 'variasi',
        label: 'Variasi',
        count: data.variations?.length ?? 0,
        content: <VariationsTab serviceId={serviceId} detail={data} onChanged={invalidate} />,
      },
    ]
    : [];

  return (
    <>
      <EntityPage
        backHref="/dashboard/services"
        backLabel="Semua layanan"
        isLoading={isLoading}
        error={error}
        title={data?.name ?? '.'}
        subtitle={
          data && (
            <span>
              Mitra{' '}
              <Link
                href={`/dashboard/partners/${data.partner_id}`}
                className="underline underline-offset-4"
              >
                {data.partner_name}
              </Link>{' '}
              · {data.category_name} · dibuat {formatDateTime(data.created_at)}
            </span>
          )
        }
        badges={
          data &&
          (data.is_active ? (
            <Badge variant="success">Aktif</Badge>
          ) : (
            <Badge variant="neutral">Nonaktif</Badge>
          ))
        }
        actions={
          data && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={setActive.isPending}
                onClick={() => setActive.mutate(!data.is_active)}
              >
                {data.is_active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                {data.is_active ? 'Nonaktifkan' : 'Aktifkan'}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" />
                Hapus
              </Button>
            </>
          )
        }
        tabs={tabs}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
        variant="danger"
        title="Hapus layanan ini?"
        description={
          <>
            <span className="font-medium text-foreground">{data?.name}</span> milik{' '}
            {data?.partner_name} akan disembunyikan dari aplikasi (soft delete). Order yang sudah
            berjalan tidak terpengaruh.
          </>
        }
        confirmLabel="Hapus layanan"
        loading={remove.isPending}
      />
    </>
  );
}

function ServiceForm({ detail, onSaved }: { detail: ServiceDetail; onSaved: () => void }) {
  const [name, setName] = useState(detail.name);
  const [description, setDescription] = useState(nstr(detail.description) ?? '');
  const [price, setPrice] = useState(detail.price.toString());
  const [unit, setUnit] = useState(detail.unit || 'per_service');
  const [estimatedDuration, setEstimatedDuration] = useState(detail.estimated_duration.toString());
  const [isActive, setIsActive] = useState(detail.is_active);
  const [categoryId, setCategoryId] = useState(detail.category_id);
  const [includedItems, setIncludedItems] = useState((detail.included_items || []).join('\n'));
  const [excludedItems, setExcludedItems] = useState((detail.excluded_items || []).join('\n'));

  const { data: categories } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const res = await fetchAPI<Category[]>('/admin/categories');
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const variations = detail.variations ?? [];
  const hasVariations = variations.length > 0;
  const minVariationPrice = hasVariations ? Math.min(...variations.map((v) => v.price)) : 0;

  const save = useMutation({
    mutationFn: async () => {
      // Layanan bervariasi: services.price diturunkan dari variasi TERMURAH,
      // bukan input admin . cegah "harga mulai dari" desync dari variasi.
      const priceNum = hasVariations ? minVariationPrice : parseInt(price, 10);
      // per_hour: estimasi dikunci ke 60 menit (1 jam); selain itu dari input admin.
      const durationNum = unit === 'per_hour' ? 60 : parseInt(estimatedDuration, 10);

      if (isNaN(priceNum) || priceNum < 0) throw new Error('Harga harus angka positif');
      if (unit !== 'per_hour' && (isNaN(durationNum) || durationNum < 15))
        throw new Error('Durasi estimasi minimal 15 menit');

      const res = await fetchAPI(`/admin/services/${detail.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          price: priceNum,
          unit,
          estimated_duration: durationNum,
          is_active: isActive,
          category_id: categoryId,
          included_items: includedItems.split('\n').map((i) => i.trim()).filter(Boolean),
          excluded_items: excludedItems.split('\n').map((i) => i.trim()).filter(Boolean),
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

  return (
    <div className="space-y-4">
      <EntitySection title="Informasi layanan">
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="svc-name">Nama layanan</Label>
            <Input
              id="svc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Cuci AC Standar"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="svc-desc">Deskripsi</Label>
            <Textarea
              id="svc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan layanan yang diberikan…"
              rows={3}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="svc-unit">Satuan harga</Label>
              <Select id="svc-unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="per_service">Per Jasa (borongan)</option>
                <option value="per_hour">Per Jam</option>
                <option value="per_unit">Per Unit</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="svc-price">Harga (Rp)</Label>
              <Input
                id="svc-price"
                type="number"
                min="0"
                value={hasVariations ? minVariationPrice : price}
                disabled={hasVariations}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="150000"
              />
              {hasVariations && (
                <p className="text-xs text-muted-foreground">Mengikuti variasi (harga termurah)</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="svc-duration">Durasi (menit)</Label>
              <Input
                id="svc-duration"
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="svc-category">Kategori</Label>
            <Select
              id="svc-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {/* Pastikan kategori saat ini tetap ada di opsi walau sudah nonaktif */}
              {!categories?.some((c) => c.id === detail.category_id) && (
                <option value={detail.category_id}>{detail.category_name}</option>
              )}
              {categories?.map((c) => (
                <option
                  key={c.id}
                  value={c.id}
                  disabled={!c.is_active && c.id !== detail.category_id}
                >
                  {c.name}
                  {!c.is_active ? ' (nonaktif)' : ''}
                </option>
              ))}
            </Select>
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
        </div>
      </EntitySection>

      <EntitySection
        title="Cakupan layanan"
        description="Satu poin per baris . tampil sebagai daftar di halaman layanan."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="svc-included" className="text-success">
              Termasuk
            </Label>
            <Textarea
              id="svc-included"
              value={includedItems}
              onChange={(e) => setIncludedItems(e.target.value)}
              placeholder="Pisahkan dengan baris baru (enter)…"
              rows={5}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="svc-excluded" className="text-destructive">
              Tidak termasuk
            </Label>
            <Textarea
              id="svc-excluded"
              value={excludedItems}
              onChange={(e) => setExcludedItems(e.target.value)}
              placeholder="Pisahkan dengan baris baru (enter)…"
              rows={5}
            />
          </div>
        </div>
      </EntitySection>

      <div className="flex justify-end">
        <Button disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Menyimpan…' : 'Simpan perubahan'}
        </Button>
      </div>
    </div>
  );
}

function PhotosTab({
  serviceId,
  photos,
  onChanged,
}: {
  serviceId: string;
  photos: ServicePhoto[];
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [toDelete, setToDelete] = useState<ServicePhoto | null>(null);

  const addPhoto = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('Pilih file foto terlebih dahulu');
      const url = await uploadFileToStorage(selectedFile, 'service');
      if (!url) throw new Error('Gagal mengupload foto');

      const res = await fetchAPI(`/admin/services/${serviceId}/photos`, {
        method: 'POST',
        body: JSON.stringify({ photo_url: url, is_primary: photos.length === 0 }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Foto ditambahkan');
      setSelectedFile(null);
      setAdding(false);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePhoto = useMutation({
    mutationFn: async (photoId: string) => {
      const res = await fetchAPI(`/admin/services/${serviceId}/photos/${photoId}`, {
        method: 'DELETE',
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Foto dihapus');
      setToDelete(null);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setPrimary = useMutation({
    mutationFn: async (photoId: string) => {
      const res = await fetchAPI(`/admin/services/${serviceId}/photos/${photoId}/primary`, {
        method: 'PUT',
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Foto utama diperbarui');
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <EntitySection
        title="Foto layanan"
        description={`${photos.length} foto . foto utama dipakai sebagai sampul di aplikasi.`}
        actions={
          !adding && (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              Tambah foto
            </Button>
          )
        }
      >
        <div className="space-y-3">
          {photos.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {photos.map((photo) => (
                <div key={photo.id} className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.photo_url}
                    alt="Foto layanan"
                    className="h-28 w-full rounded-lg border border-border object-cover"
                  />
                  {photo.is_primary && (
                    <div className="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-warning px-1.5 py-0.5 text-xs font-medium text-warning-foreground">
                      <Star className="size-2.5" />
                      Utama
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center gap-1 rounded-lg bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    {!photo.is_primary && (
                      <button
                        type="button"
                        onClick={() => setPrimary.mutate(photo.id)}
                        className="rounded bg-white/20 p-1.5 text-white hover:bg-white/30"
                        aria-label="Jadikan foto utama"
                        title="Jadikan foto utama"
                      >
                        <Star className="size-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setToDelete(photo)}
                      className="rounded bg-destructive/80 p-1.5 text-destructive-foreground hover:bg-destructive"
                      aria-label="Hapus foto"
                      title="Hapus foto"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              Belum ada foto
            </div>
          )}

          {adding && (
            <div className="flex items-start gap-4 rounded-lg border border-border p-3">
              <FileUpload
                maxSizeMB={10}
                onFileSelect={setSelectedFile}
                previewWidth={80}
                previewHeight={80}
                label="Pilih File"
              />
              <div className="flex flex-col gap-2 pt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAdding(false);
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
                  {addPhoto.isPending ? 'Mengupload…' : 'Simpan'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </EntitySection>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && deletePhoto.mutate(toDelete.id)}
        variant="danger"
        title="Hapus foto ini?"
        description="Foto dihapus permanen dari layanan."
        confirmLabel="Hapus foto"
        loading={deletePhoto.isPending}
      />
    </>
  );
}

function VariationsTab({
  serviceId,
  detail,
  onChanged,
}: {
  serviceId: string;
  detail: ServiceDetail;
  onChanged: () => void;
}) {
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
  const variations = detail.variations ?? [];

  const remove = useMutation({
    mutationFn: async (variationId: string) => {
      const res = await fetchAPI(`/admin/services/${serviceId}/variations/${variationId}`, {
        method: 'DELETE',
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Variasi dihapus');
      setToDelete(null);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (variations.length === 0) {
    return (
      <EntitySection title="Variasi harga">
        <p className="text-sm text-muted-foreground">
          Layanan ini memakai harga tunggal ({formatIDR(detail.price)}). Variasi ditambahkan mitra
          dari aplikasi.
        </p>
      </EntitySection>
    );
  }

  return (
    <>
      <EntitySection
        title="Variasi harga"
        description="Diatur mitra dari aplikasi. Admin hanya dapat menghapus variasi bermasalah . harga layanan otomatis mengikuti variasi termurah yang tersisa, dan minimal satu variasi harus ada."
      >
        <div className="divide-y divide-border rounded-lg border border-border">
          {variations.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="truncate">{v.name}</span>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-medium tabular-nums">{formatIDR(v.price)}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Hapus variasi ${v.name}`}
                  title={
                    variations.length <= 1 ? 'Tidak bisa hapus variasi terakhir' : 'Hapus variasi'
                  }
                  disabled={variations.length <= 1}
                  onClick={() => setToDelete({ id: v.id, name: v.name })}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </EntitySection>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        variant="danger"
        title="Hapus variasi ini?"
        description={
          <>
            <span className="font-medium text-foreground">{toDelete?.name}</span> akan dihapus dari
            layanan. Keranjang pelanggan yang masih menunjuk variasi ini akan ditolak saat checkout.
          </>
        }
        confirmLabel="Hapus variasi"
        loading={remove.isPending}
      />
    </>
  );
}
