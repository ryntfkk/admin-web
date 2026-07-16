'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, ShieldBan, ShieldCheck, Cog, Camera, Pencil, MapPin, Trash2 } from 'lucide-react';
import { fetchAPI, qs } from '@/lib/api';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type { UserRow, UserDetailRow, UserAddressRow } from '@/types/admin';
import { nstr, ntime } from '@/lib/sql';
import { formatDateTime, formatIDR } from '@/lib/format';
import { toast } from '@/lib/store/toastStore';
import { USER_ROLE_OPTIONS, USER_STATUS_OPTIONS } from '@/lib/enums';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { CenteredSpinner, EmptyState } from '@/components/ui/feedback';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { FileUpload, uploadFileToStorage } from '@/components/ui/file-upload';

const PER_PAGE = 20;

const DURATION_OPTIONS = [
  { value: '24', label: '24 jam' },
  { value: '72', label: '3 hari' },
  { value: '168', label: '7 hari' },
  { value: '720', label: '30 hari' },
  { value: '0', label: 'Permanen' },
];

const roleLabel: Record<string, string> = {
  customer: 'Pelanggan',
  partner: 'Mitra',
  admin: 'Admin',
};

export default function UsersPage() {
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users', role, status, search, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<UserRow>>(
        `/admin/users${qs({ role, status, q: search, page, per_page: PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pengguna</h1>
        <p className="text-sm text-muted-foreground">Kelola semua akun pengguna</p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-40">
          <Select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
          >
            {USER_ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-40">
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {USER_STATUS_OPTIONS.map((o) => (
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
            placeholder="Cari nama, username, email, telepon…"
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
        <EmptyState title="Tidak ada pengguna" note="Coba ubah filter pencarian." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Avatar</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Kontak</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    {nstr(u.avatar_url) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={nstr(u.avatar_url)!}
                        alt={u.name}
                        className="size-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {u.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">@{u.username}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {nstr(u.email) || nstr(u.phone) || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral">{roleLabel[u.active_role] || u.active_role}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatIDR(u.balance)}</TableCell>
                  <TableCell>
                    {u.is_suspended ? (
                      <Badge variant="danger">Suspended</Badge>
                    ) : (
                      <Badge variant="success">Aktif</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setSelectedId(u.id)}>
                      <Cog className="size-4" />
                      Kelola
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />
        </>
      )}

      {selectedId && (
        <UserDetailModal
          userId={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function UserDetailModal({
  userId,
  onClose,
  onChanged,
}: {
  userId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<
    'view' | 'suspend' | 'unsuspend' | 'changePhoto' | 'editProfile' | 'editAddress'
  >('view');
  const [duration, setDuration] = useState('24');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  // Edit profil
  const [profileForm, setProfileForm] = useState({ name: '', email: '', phone: '' });
  // Edit alamat
  const [addrForm, setAddrForm] = useState({
    id: '',
    label: '',
    address: '',
    address_detail: '',
    city: '',
    district: '',
    province: '',
    is_default: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['user-detail', userId],
    queryFn: async () => {
      const res = await fetchAPI<UserDetailRow>(`/admin/users/${userId}`);
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const { data: addresses } = useQuery({
    queryKey: ['user-addresses', userId],
    queryFn: async () => {
      const res = await fetchAPI<UserAddressRow[]>(`/admin/users/${userId}/addresses`);
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['users'] });
    qc.invalidateQueries({ queryKey: ['user-detail', userId] });
  }

  function invalidateAddresses() {
    qc.invalidateQueries({ queryKey: ['user-addresses', userId] });
  }

  const changePhoto = useMutation({
    mutationFn: async () => {
      if (!selectedFile) {
        throw new Error('Pilih file foto terlebih dahulu');
      }

      // Upload the file first
      const uploadedUrl = await uploadFileToStorage(selectedFile, 'avatar');
      if (!uploadedUrl) {
        throw new Error('Gagal mengupload foto');
      }

      // Update user profile
      const res = await fetchAPI(`/admin/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ avatar_url: uploadedUrl }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Foto profil berhasil diperbarui');
      setSelectedFile(null);
      setMode('view');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI(`/admin/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: profileForm.name,
          email: profileForm.email,
          phone: profileForm.phone,
        }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Profil pengguna diperbarui');
      setMode('view');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveAddress = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI(`/admin/users/${userId}/addresses/${addrForm.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          label: addrForm.label,
          address: addrForm.address,
          address_detail: addrForm.address_detail,
          city: addrForm.city,
          district: addrForm.district,
          province: addrForm.province,
          is_default: addrForm.is_default,
        }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Alamat diperbarui');
      setMode('view');
      invalidateAddresses();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteAddress = useMutation({
    mutationFn: async (addressId: string) => {
      const res = await fetchAPI(`/admin/users/${userId}/addresses/${addressId}`, {
        method: 'DELETE',
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Alamat dihapus');
      invalidateAddresses();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const suspend = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI(`/admin/users/${userId}/suspend`, {
        method: 'PUT',
        body: JSON.stringify({ duration_hours: Number(duration), reason }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Akun di-suspend');
      invalidate();
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unsuspend = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI(`/admin/users/${userId}/unsuspend`, {
        method: 'PUT',
        body: JSON.stringify({ notes }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Akun diaktifkan kembali');
      invalidate();
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal open onClose={onClose} title="Kelola Pengguna">
      {isLoading || !data ? (
        <CenteredSpinner />
      ) : mode === 'suspend' ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <Label>Durasi</Label>
            <Select value={duration} onChange={(e) => setDuration(e.target.value)}>
              {DURATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Alasan (wajib)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={() => setMode('view')}>
              Kembali
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || suspend.isPending}
              onClick={() => suspend.mutate()}
            >
              Suspend
            </Button>
          </div>
        </div>
      ) : mode === 'unsuspend' ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <Label>Catatan (opsional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={() => setMode('view')}>
              Kembali
            </Button>
            <Button disabled={unsuspend.isPending} onClick={() => unsuspend.mutate()}>
              Aktifkan
            </Button>
          </div>
        </div>
      ) : mode === 'changePhoto' ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Upload foto profil baru untuk {data.name}</p>
          <FileUpload
            fileType="avatar"
            currentUrl={avatarUrl || nstr(data.avatar_url) || undefined}
            onFileSelect={(file) => {
              setSelectedFile(file);
              setAvatarUrl(null);
            }}
            onUploaded={(url) => {
              setAvatarUrl(url);
            }}
            previewWidth={120}
            previewHeight={120}
            label="Foto Profil"
          />
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={() => {
              setMode('view');
              setSelectedFile(null);
              setAvatarUrl(null);
            }}>
              Batal
            </Button>
            <Button
              disabled={!selectedFile || changePhoto.isPending}
              onClick={() => changePhoto.mutate()}
            >
              {changePhoto.isPending ? 'Mengupload...' : 'Simpan'}
            </Button>
          </div>
        </div>
      ) : mode === 'editProfile' ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <Label>Nama</Label>
            <Input
              value={profileForm.name}
              onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Telepon</Label>
            <Input
              value={profileForm.phone}
              onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={() => setMode('view')}>
              Batal
            </Button>
            <Button
              disabled={!profileForm.name.trim() || saveProfile.isPending}
              onClick={() => saveProfile.mutate()}
            >
              {saveProfile.isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </div>
      ) : mode === 'editAddress' ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <Label>Label</Label>
            <Input
              value={addrForm.label}
              onChange={(e) => setAddrForm((f) => ({ ...f, label: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Alamat lengkap</Label>
            <Textarea
              value={addrForm.address}
              onChange={(e) => setAddrForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Detail / Catatan</Label>
            <Input
              value={addrForm.address_detail}
              onChange={(e) => setAddrForm((f) => ({ ...f, address_detail: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label>Provinsi</Label>
              <Input
                value={addrForm.province}
                onChange={(e) => setAddrForm((f) => ({ ...f, province: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Kota</Label>
              <Input
                value={addrForm.city}
                onChange={(e) => setAddrForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Kecamatan</Label>
              <Input
                value={addrForm.district}
                onChange={(e) => setAddrForm((f) => ({ ...f, district: e.target.value }))}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={addrForm.is_default}
              onChange={(e) => setAddrForm((f) => ({ ...f, is_default: e.target.checked }))}
            />
            Jadikan alamat utama
          </label>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={() => setMode('view')}>
              Batal
            </Button>
            <Button disabled={saveAddress.isPending} onClick={() => saveAddress.mutate()}>
              {saveAddress.isPending ? 'Menyimpan...' : 'Simpan Alamat'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="relative">
                {nstr(data.avatar_url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={nstr(data.avatar_url)!}
                    alt={data.name}
                    className="size-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex size-16 items-center justify-center rounded-full bg-muted text-lg font-medium">
                    {data.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <div>
                <p className="font-medium">{data.name}</p>
                <p className="text-sm text-muted-foreground">
                  {nstr(data.email) || nstr(data.phone) || '-'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {data.is_suspended ? (
                <Badge variant="danger">Suspended</Badge>
              ) : (
                <Badge variant="success">Aktif</Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAvatarUrl(nstr(data.avatar_url));
                setSelectedFile(null);
                setMode('changePhoto');
              }}
            >
              <Camera className="size-4" />
              Ganti Foto
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setProfileForm({
                  name: data.name || '',
                  email: nstr(data.email) || '',
                  phone: nstr(data.phone) || '',
                });
                setMode('editProfile');
              }}
            >
              <Pencil className="size-4" />
              Edit Profil
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Username" value={data.username ? `@${data.username}` : '-'} />
            <Field label="Role aktif" value={roleLabel[data.active_role] || data.active_role} />
            <Field label="Email" value={nstr(data.email) || '-'} />
            <Field label="Telepon" value={nstr(data.phone) || '-'} />
            <Field label="Saldo" value={formatIDR(data.balance)} />
            <Field label="Terdaftar" value={formatDateTime(data.created_at)} />
            {data.is_suspended && (
              <Field
                label="Suspend s/d"
                value={
                  ntime(data.suspended_until)
                    ? formatDateTime(ntime(data.suspended_until))
                    : 'Permanen'
                }
              />
            )}
            <Field label="User ID" value={data.id} mono />
          </div>

          {/* Alamat pengguna */}
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-sm font-medium">Alamat</p>
            {!addresses ? (
              <p className="text-xs text-muted-foreground">Memuat alamat…</p>
            ) : addresses.length === 0 ? (
              <p className="text-xs text-muted-foreground">Pengguna belum punya alamat.</p>
            ) : (
              <div className="space-y-2">
                {addresses.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start justify-between gap-2 rounded-md border border-border p-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{a.label || 'Alamat'}</span>
                        {a.is_default && <Badge variant="neutral">Utama</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{a.address}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3 shrink-0" />
                        {[nstr(a.district), nstr(a.city), nstr(a.province)]
                          .filter(Boolean)
                          .join(', ') || '-'}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setAddrForm({
                            id: a.id,
                            label: a.label || '',
                            address: a.address || '',
                            address_detail: nstr(a.address_detail) || '',
                            city: nstr(a.city) || '',
                            district: nstr(a.district) || '',
                            province: nstr(a.province) || '',
                            is_default: a.is_default,
                          });
                          setMode('editAddress');
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deleteAddress.isPending}
                        onClick={() => {
                          if (window.confirm('Hapus alamat ini?')) deleteAddress.mutate(a.id);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            {data.is_suspended ? (
              <Button onClick={() => setMode('unsuspend')}>
                <ShieldCheck className="size-4" />
                Aktifkan Akun
              </Button>
            ) : (
              <Button variant="destructive" onClick={() => setMode('suspend')}>
                <ShieldBan className="size-4" />
                Suspend Akun
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-0.5 ${mono ? 'break-all font-mono text-xs' : ''}`}>{value}</p>
    </div>
  );
}
