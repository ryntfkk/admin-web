'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, ShieldBan, ShieldCheck, Cog, Camera, Pencil, MapPin, Trash2, KeyRound, Wallet } from 'lucide-react';
import { fetchAPI, qs } from '@/lib/api';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type {
  UserRow,
  UserDetailRow,
  UserAddressRow,
  LoginHistoryRow,
  DeletionArchiveRow,
  OrderRow,
  AllTransactionRow,
  ChatRoomRow,
} from '@/types/admin';
import { nstr, ntime } from '@/lib/sql';
import { formatDateTime, formatIDR } from '@/lib/format';
import { toast } from '@/lib/store/toastStore';
import {
  USER_ROLE_OPTIONS,
  USER_STATUS_OPTIONS,
  LOGIN_EVENT_LABELS,
  loginEventVariant,
  ORDER_STATUS_LABELS,
  orderStatusVariant,
  WALLET_TX_CATEGORY_LABELS,
  WALLET_TX_TYPE_LABELS,
  walletTxTypeVariant,
} from '@/lib/enums';
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

type TabKey = 'profil' | 'alamat' | 'login' | 'order' | 'transaksi' | 'chat' | 'arsip';

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
                    {ntime(u.deleted_at) ? (
                      <Badge variant="neutral">Dihapus</Badge>
                    ) : u.is_suspended ? (
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
    'view' | 'suspend' | 'unsuspend' | 'changePhoto' | 'editProfile' | 'editAddress' | 'resetPassword' | 'adjustWallet'
  >('view');
  // Sesuaikan saldo (kontrol transaksi admin)
  const [adjustForm, setAdjustForm] = useState({ type: 'CREDIT', amount: '', reason: '' });
  const [tab, setTab] = useState<TabKey>('profil');
  const [duration, setDuration] = useState('24');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  // Edit profil
  const [profileForm, setProfileForm] = useState({ name: '', email: '', phone: '' });
  // Reset password
  const [pwForm, setPwForm] = useState({ newPassword: '', confirmPassword: '', forceLogout: true });
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

  const {
    data: addresses,
    isLoading: addressesLoading,
    isError: addressesError,
  } = useQuery({
    queryKey: ['user-addresses', userId],
    queryFn: async () => {
      const res = await fetchAPI<UserAddressRow[]>(`/admin/users/${userId}/addresses`);
      // Jangan tolak data null — backend bisa mengirim null saat kosong. Tanpa
      // `?? []` query masuk state error dan tab tersangkut "Memuat alamat…".
      if (!res.success) throw new Error(getErrorMessage(res));
      return res.data ?? [];
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

  const resetPassword = useMutation({
    mutationFn: async () => {
      if (pwForm.newPassword.length < 8) throw new Error('Password minimal 8 karakter');
      if (pwForm.newPassword !== pwForm.confirmPassword)
        throw new Error('Konfirmasi password tidak cocok');
      const res = await fetchAPI(`/admin/users/${userId}/reset-password`, {
        method: 'PUT',
        body: JSON.stringify({
          new_password: pwForm.newPassword,
          force_logout: pwForm.forceLogout,
        }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Password pengguna direset');
      setPwForm({ newPassword: '', confirmPassword: '', forceLogout: true });
      setMode('view');
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

  const adjustWallet = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI(`/admin/users/${userId}/wallet/adjust`, {
        method: 'POST',
        body: JSON.stringify({
          type: adjustForm.type,
          amount: Number(adjustForm.amount) || 0,
          reason: adjustForm.reason.trim(),
        }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Saldo berhasil disesuaikan');
      setAdjustForm({ type: 'CREDIT', amount: '', reason: '' });
      setMode('view');
      invalidate();
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isDeleted = !!(data && ntime(data.deleted_at));

  return (
    <Modal open onClose={onClose} title="Kelola Pengguna" className="max-w-3xl">
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
      ) : mode === 'resetPassword' ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Tetapkan password baru untuk{' '}
            <span className="font-medium text-foreground">{data.name}</span>. Sampaikan password ini
            ke pengguna melalui kanal yang aman.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label>Password baru</Label>
            <Input
              type="text"
              autoComplete="new-password"
              value={pwForm.newPassword}
              onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
              placeholder="Minimal 8 karakter"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Konfirmasi password</Label>
            <Input
              type="text"
              autoComplete="new-password"
              value={pwForm.confirmPassword}
              onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))}
            />
          </div>
          {pwForm.confirmPassword.length > 0 && pwForm.newPassword !== pwForm.confirmPassword && (
            <p className="text-xs text-destructive">Konfirmasi password tidak cocok.</p>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pwForm.forceLogout}
              onChange={(e) => setPwForm((f) => ({ ...f, forceLogout: e.target.checked }))}
            />
            Logout semua sesi (paksa login ulang dengan password baru)
          </label>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={() => setMode('view')}>
              Batal
            </Button>
            <Button
              disabled={
                pwForm.newPassword.length < 8 ||
                pwForm.newPassword !== pwForm.confirmPassword ||
                resetPassword.isPending
              }
              onClick={() => resetPassword.mutate()}
            >
              {resetPassword.isPending ? 'Menyimpan...' : 'Reset Password'}
            </Button>
          </div>
        </div>
      ) : mode === 'adjustWallet' ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            Saldo saat ini: <span className="font-semibold">{formatIDR(data.balance)}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Jenis penyesuaian</Label>
            <Select
              value={adjustForm.type}
              onChange={(e) => setAdjustForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="CREDIT">Tambah saldo (CREDIT)</option>
              <option value="DEBIT">Kurangi saldo (DEBIT)</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Nominal (Rp)</Label>
            <Input
              type="number"
              min="1"
              value={adjustForm.amount}
              onChange={(e) => setAdjustForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="50000"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Alasan (wajib — tercatat di audit log)</Label>
            <Textarea
              value={adjustForm.reason}
              onChange={(e) => setAdjustForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="mis. Kompensasi keluhan / koreksi refund manual"
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={() => setMode('view')}>
              Kembali
            </Button>
            <Button
              disabled={!adjustForm.reason.trim() || !(Number(adjustForm.amount) > 0) || adjustWallet.isPending}
              onClick={() => adjustWallet.mutate()}
            >
              {adjustWallet.isPending ? 'Memproses...' : 'Terapkan'}
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
              {isDeleted ? (
                <Badge variant="neutral">Dihapus</Badge>
              ) : data.is_suspended ? (
                <Badge variant="danger">Suspended</Badge>
              ) : (
                <Badge variant="success">Aktif</Badge>
              )}
            </div>
          </div>

          {/* Tab forensik: semua data user dalam satu tempat */}
          <div className="flex flex-wrap gap-1 border-b border-border">
            {(
              [
                ['profil', 'Profil'],
                ['alamat', 'Alamat'],
                ['login', 'Riwayat Login'],
                ['order', 'Order'],
                ['transaksi', 'Transaksi'],
                ['chat', 'Chat'],
                ...(isDeleted ? [['arsip', 'Arsip Identitas'] as [TabKey, string]] : []),
              ] as [TabKey, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === key
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'profil' && (
            <>
              {!isDeleted && (
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPwForm({ newPassword: '', confirmPassword: '', forceLogout: true });
                      setMode('resetPassword');
                    }}
                  >
                    <KeyRound className="size-4" />
                    Reset Password
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAdjustForm({ type: 'CREDIT', amount: '', reason: '' });
                      setMode('adjustWallet');
                    }}
                  >
                    <Wallet className="size-4" />
                    Sesuaikan Saldo
                  </Button>
                </div>
              )}

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
                {isDeleted && (
                  <Field label="Dihapus pada" value={formatDateTime(ntime(data.deleted_at))} />
                )}
                <Field label="User ID" value={data.id} mono />
              </div>
            </>
          )}

          {tab === 'alamat' && (
            <div className="space-y-2">
              {addressesLoading ? (
                <p className="text-xs text-muted-foreground">Memuat alamat…</p>
              ) : addressesError ? (
                <p className="text-xs text-destructive">Gagal memuat alamat. Coba lagi.</p>
              ) : !addresses || addresses.length === 0 ? (
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
                      {!isDeleted && (
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
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'login' && <LoginHistoryTab userId={userId} />}
          {tab === 'order' && <UserOrdersTab userId={userId} />}
          {tab === 'transaksi' && <UserTransactionsTab userId={userId} />}
          {tab === 'chat' && <UserChatsTab userId={userId} />}
          {tab === 'arsip' && <DeletionArchiveTab userId={userId} />}

          {!isDeleted && (
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
          )}
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

// ── Tab forensik per-user ───────────────────────────────────────────

const TAB_PER_PAGE = 10;

function LoginHistoryTab({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['user-login-history', userId, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<LoginHistoryRow>>(
        `/admin/users/${userId}/login-history${qs({ page, per_page: TAB_PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  if (isLoading) return <CenteredSpinner />;
  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  if (rows.length === 0)
    return <EmptyState title="Belum ada riwayat" note="Login & percobaan login akan tercatat di sini." />;

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Waktu</TableHead>
            <TableHead>Event</TableHead>
            <TableHead>Identifier</TableHead>
            <TableHead>IP</TableHead>
            <TableHead>Perangkat</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatDateTime(r.created_at)}
              </TableCell>
              <TableCell>
                <Badge variant={loginEventVariant(r.event_type)}>
                  {LOGIN_EVENT_LABELS[r.event_type] || r.event_type}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{r.identifier || '-'}</TableCell>
              <TableCell className="font-mono text-xs">{r.ip_address || '-'}</TableCell>
              <TableCell
                className="max-w-[220px] truncate text-xs text-muted-foreground"
                title={r.user_agent || ''}
              >
                {r.user_agent || '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination page={page} perPage={TAB_PER_PAGE} total={total} onPageChange={setPage} />
    </div>
  );
}

function UserOrdersTab({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['user-orders', userId, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<OrderRow>>(
        `/admin/orders${qs({ user_id: userId, page, per_page: TAB_PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  if (isLoading) return <CenteredSpinner />;
  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  if (rows.length === 0) return <EmptyState title="Tidak ada order" note="User ini belum punya order." />;

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>No. Order</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Nilai</TableHead>
            <TableHead>Pelanggan</TableHead>
            <TableHead>Mitra</TableHead>
            <TableHead>Dibuat</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((o) => (
            <TableRow key={o.id}>
              <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
              <TableCell>
                <Badge variant={orderStatusVariant(o.status)}>
                  {ORDER_STATUS_LABELS[o.status] || o.status}
                </Badge>
              </TableCell>
              <TableCell>{formatIDR(o.agreed_price)}</TableCell>
              <TableCell className="text-muted-foreground">{o.customer_name}</TableCell>
              <TableCell className="text-muted-foreground">{o.partner_name}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatDateTime(o.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination page={page} perPage={TAB_PER_PAGE} total={total} onPageChange={setPage} />
    </div>
  );
}

function UserTransactionsTab({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['user-transactions', userId, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<AllTransactionRow>>(
        `/admin/financial/transactions${qs({ user_id: userId, page, per_page: TAB_PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  if (isLoading) return <CenteredSpinner />;
  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  if (rows.length === 0)
    return <EmptyState title="Tidak ada transaksi" note="Belum ada transaksi dompet untuk user ini." />;

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Waktu</TableHead>
            <TableHead>Kategori</TableHead>
            <TableHead>Tipe</TableHead>
            <TableHead>Jumlah</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Referensi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatDateTime(t.created_at)}
              </TableCell>
              <TableCell>{WALLET_TX_CATEGORY_LABELS[t.category] || t.category}</TableCell>
              <TableCell>
                <Badge variant={walletTxTypeVariant(t.type)}>
                  {WALLET_TX_TYPE_LABELS[t.type] || t.type}
                </Badge>
              </TableCell>
              <TableCell>{formatIDR(t.amount)}</TableCell>
              <TableCell className="text-muted-foreground">{t.status}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {t.order_number || nstr(t.bank_account_number) || '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination page={page} perPage={TAB_PER_PAGE} total={total} onPageChange={setPage} />
    </div>
  );
}

function UserChatsTab({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['user-chats', userId, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<ChatRoomRow>>(
        `/admin/chat/rooms${qs({ user_id: userId, page, per_page: TAB_PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  if (isLoading) return <CenteredSpinner />;
  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  if (rows.length === 0)
    return <EmptyState title="Tidak ada chat" note="User ini belum punya percakapan." />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Isi percakapan dapat dibuka di menu Chat. Setiap akses baca chat oleh admin tercatat di
        Audit Log.
      </p>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-md border border-border p-2.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                {r.customer_name} ↔ {r.partner_name}
              </span>
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {ntime(r.last_message_at) ? formatDateTime(ntime(r.last_message_at)) : '-'}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {nstr(r.last_message) || 'Belum ada pesan'}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">Room: {r.id}</p>
          </div>
        ))}
      </div>
      <Pagination page={page} perPage={TAB_PER_PAGE} total={total} onPageChange={setPage} />
    </div>
  );
}

function DeletionArchiveTab({ userId }: { userId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['user-deletion-archive', userId],
    queryFn: async () => {
      const res = await fetchAPI<DeletionArchiveRow>(`/admin/users/${userId}/archive`);
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  if (isLoading) return <CenteredSpinner />;
  if (isError || !data)
    return (
      <EmptyState
        title="Arsip tidak ditemukan"
        note="Akun ini dihapus sebelum sistem arsip identitas aktif."
      />
    );

  return (
    <div className="space-y-3">
      <p className="rounded-md border border-border bg-muted/50 p-2.5 text-xs text-muted-foreground">
        Snapshot identitas yang diambil otomatis sesaat sebelum akun dihapus. Data ini untuk
        kebutuhan hukum/forensik.
      </p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Field label="Nama asli" value={data.name} />
        <Field label="Username" value={`@${data.username}`} />
        <Field label="Telepon" value={nstr(data.phone) || '-'} />
        <Field label="Email" value={nstr(data.email) || '-'} />
        <Field label="Bank" value={nstr(data.bank_code) || '-'} />
        <Field label="No. rekening" value={nstr(data.bank_account_number) || '-'} />
        <Field label="Nama pemilik rekening" value={nstr(data.bank_account_name) || '-'} />
        <Field label="Saldo saat dihapus" value={formatIDR(data.balance)} />
        <Field label="Terdaftar" value={formatDateTime(data.user_created_at)} />
        <Field label="Dihapus" value={formatDateTime(data.deleted_at)} />
        <Field label="Role" value={(data.roles || []).join(', ') || data.active_role} />
        <Field label="User ID" value={data.user_id} mono />
      </div>
    </div>
  );
}
