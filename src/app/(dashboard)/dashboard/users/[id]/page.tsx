'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AtSign,
  BadgeCheck,
  Camera,
  KeyRound,
  Landmark,
  MapPin,
  Pencil,
  RotateCcw,
  ShieldBan,
  ShieldCheck,
  Trash2,
  UserCog,
  Wallet,
} from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type { UserAddressRow, UserDetailRow } from '@/types/admin';
import { nstr, ntime } from '@/lib/sql';
import { formatDateTime, formatIDR } from '@/lib/format';
import { toast } from '@/lib/store/toastStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldGrid } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EntityPage, EntitySection, type EntityTab } from '@/components/ui/entity-page';
import { CenteredSpinner, EmptyState } from '@/components/ui/feedback';
import UserActionDialogs, { type UserAction } from '../_components/UserActionDialogs';
import {
  DeletionArchiveTab,
  LoginHistoryTab,
  UserChatsTab,
  UserOrdersTab,
  UserTransactionsTab,
} from '../_components/UserTabs';

const roleLabel: Record<string, string> = {
  customer: 'Pelanggan',
  partner: 'Mitra',
  admin: 'Admin',
};

export default function UserDetailPage() {
  const { id: userId } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [action, setAction] = useState<UserAction | null>(null);
  const [danger, setDanger] = useState<'delete' | 'restore' | 'verify' | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['user-detail', userId],
    queryFn: async () => {
      const res = await fetchAPI<UserDetailRow>(`/admin/users/${userId}`);
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const isDeleted = !!(data && ntime(data.deleted_at));
  const canEdit = !!data && !isDeleted;

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['users'] });
    qc.invalidateQueries({ queryKey: ['user-detail', userId] });
  }

  const remove = useMutation({
    mutationFn: async (reason: string) => {
      const res = await fetchAPI(`/admin/users/${userId}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Akun dihapus & identitas diarsipkan');
      setDanger(null);
      qc.invalidateQueries({ queryKey: ['users'] });
      router.push('/dashboard/users');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restore = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI(`/admin/users/${userId}/restore`, { method: 'POST' });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Akun dipulihkan dari arsip identitas');
      setDanger(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setVerified = useMutation({
    mutationFn: async (verified: boolean) => {
      const res = await fetchAPI(`/admin/users/${userId}/verify`, {
        method: 'PUT',
        body: JSON.stringify({ is_verified: verified }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Status verifikasi diperbarui');
      setDanger(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tabs: EntityTab[] = data
    ? [
        {
          id: 'profil',
          label: 'Profil',
          content: <ProfileTab user={data} isDeleted={isDeleted} />,
        },
        {
          id: 'alamat',
          label: 'Alamat',
          content: <AddressTab userId={userId} canEdit={canEdit} />,
        },
        { id: 'login', label: 'Riwayat Login', content: <LoginHistoryTab userId={userId} /> },
        { id: 'order', label: 'Order', content: <UserOrdersTab userId={userId} /> },
        { id: 'transaksi', label: 'Transaksi', content: <UserTransactionsTab userId={userId} /> },
        { id: 'chat', label: 'Chat', content: <UserChatsTab userId={userId} /> },
        ...(isDeleted
          ? [
              {
                id: 'arsip',
                label: 'Arsip Identitas',
                content: <DeletionArchiveTab userId={userId} />,
              },
            ]
          : []),
      ]
    : [];

  return (
    <>
      <EntityPage
        backHref="/dashboard/users"
        backLabel="Semua pengguna"
        isLoading={isLoading}
        error={error}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={data?.name} url={data ? nstr(data.avatar_url) : null} />
            {data?.name ?? '—'}
          </span>
        }
        subtitle={
          data && (
            <span>
              @{data.username} · {nstr(data.email) || nstr(data.phone) || 'tanpa kontak'}
            </span>
          )
        }
        badges={
          data && (
            <>
              {isDeleted ? (
                <Badge variant="neutral">Dihapus</Badge>
              ) : data.is_suspended ? (
                <Badge variant="danger">Suspended</Badge>
              ) : (
                <Badge variant="success">Aktif</Badge>
              )}
              {(data.roles ?? [data.active_role]).map((r) => (
                <Badge key={r} variant={r === data.active_role ? 'info' : 'neutral'}>
                  {roleLabel[r] || r}
                </Badge>
              ))}
              {data.is_verified && <Badge variant="success">Terverifikasi</Badge>}
            </>
          )
        }
        actions={
          isDeleted ? (
            <Button size="sm" onClick={() => setDanger('restore')} disabled={restore.isPending}>
              <RotateCcw className="size-4" />
              Pulihkan akun
            </Button>
          ) : (
            canEdit && (
              <>
                <Button variant="outline" size="sm" onClick={() => setAction('changePhoto')}>
                  <Camera className="size-4" />
                  Foto
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAction('editProfile')}>
                  <Pencil className="size-4" />
                  Profil
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAction('editUsername')}>
                  <AtSign className="size-4" />
                  Username
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAction('editRoles')}>
                  <UserCog className="size-4" />
                  Peran
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAction('editBank')}>
                  <Landmark className="size-4" />
                  Rekening
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAction('resetPassword')}>
                  <KeyRound className="size-4" />
                  Password
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAction('adjustWallet')}>
                  <Wallet className="size-4" />
                  Saldo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={setVerified.isPending}
                  onClick={() => setVerified.mutate(!data.is_verified)}
                >
                  <BadgeCheck className="size-4" />
                  {data.is_verified ? 'Cabut verifikasi' : 'Verifikasi'}
                </Button>
                {data.is_suspended ? (
                  <Button size="sm" onClick={() => setAction('unsuspend')}>
                    <ShieldCheck className="size-4" />
                    Aktifkan
                  </Button>
                ) : (
                  <Button variant="destructive" size="sm" onClick={() => setAction('suspend')}>
                    <ShieldBan className="size-4" />
                    Suspend
                  </Button>
                )}
                <Button variant="destructive" size="sm" onClick={() => setDanger('delete')}>
                  <Trash2 className="size-4" />
                  Hapus
                </Button>
              </>
            )
          )
        }
        tabs={tabs}
      />

      {data && (
        <UserActionDialogs user={data} action={action} onClose={() => setAction(null)} />
      )}

      <ConfirmDialog
        open={danger === 'delete'}
        onClose={() => setDanger(null)}
        onConfirm={(reason) => remove.mutate(reason)}
        variant="danger"
        title="Hapus akun ini?"
        description="Identitas lengkap (nama, kontak, rekening) diarsipkan otomatis ke arsip forensik sebelum data pribadi dianonimkan, dan semua sesi dicabut. Akun masih bisa dipulihkan dari arsip itu."
        confirmLabel="Hapus akun"
        requireReason
        confirmPhrase={data?.username}
        loading={remove.isPending}
      />

      <ConfirmDialog
        open={danger === 'restore'}
        onClose={() => setDanger(null)}
        onConfirm={() => restore.mutate()}
        title="Pulihkan akun ini?"
        description="Nama, telepon, dan email dikembalikan dari arsip identitas. Akun kembali bisa login."
        confirmLabel="Pulihkan"
        loading={restore.isPending}
      />
    </>
  );
}

function Avatar({ name, url }: { name?: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name ?? ''} className="size-10 rounded-full object-cover" />;
  }
  return (
    <span className="flex size-10 items-center justify-center rounded-full bg-muted text-base font-medium">
      {name?.charAt(0)?.toUpperCase() || '?'}
    </span>
  );
}

function ProfileTab({ user, isDeleted }: { user: UserDetailRow; isDeleted: boolean }) {
  return (
    <EntitySection title="Identitas & akun">
      <FieldGrid columns={3}>
        <Field label="Nama" value={user.name} />
        <Field label="Username" value={user.username ? `@${user.username}` : null} />
        <Field
          label="Peran"
          value={(user.roles ?? [user.active_role]).map((r) => roleLabel[r] || r).join(', ')}
        />
        <Field label="Peran aktif" value={roleLabel[user.active_role] || user.active_role} />
        <Field label="Email" value={nstr(user.email)} />
        <Field label="Telepon" value={nstr(user.phone)} />
        <Field label="Saldo" value={formatIDR(user.balance)} />
        <Field label="Bank" value={nstr(user.bank_code)} />
        <Field label="No. rekening" value={nstr(user.bank_account_number)} mono />
        <Field label="Atas nama" value={nstr(user.bank_account_name)} />
        <Field label="Terdaftar" value={formatDateTime(user.created_at)} />
        {user.is_suspended && (
          <Field
            label="Suspend s/d"
            value={
              ntime(user.suspended_until) ? formatDateTime(ntime(user.suspended_until)) : 'Permanen'
            }
          />
        )}
        {isDeleted && <Field label="Dihapus pada" value={formatDateTime(ntime(user.deleted_at))} />}
        <Field label="User ID" value={user.id} mono />
      </FieldGrid>
    </EntitySection>
  );
}

function AddressTab({ userId, canEdit }: { userId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<UserAddressRow | null>(null);
  const [toDelete, setToDelete] = useState<UserAddressRow | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['user-addresses', userId],
    queryFn: async () => {
      const res = await fetchAPI<UserAddressRow[]>(`/admin/users/${userId}/addresses`);
      // Jangan tolak data null — backend bisa mengirim null saat kosong. Tanpa
      // `?? []` query masuk state error dan tab tersangkut "Memuat alamat…".
      if (!res.success) throw new Error(getErrorMessage(res));
      return res.data ?? [];
    },
  });

  const remove = useMutation({
    mutationFn: async (addressId: string) => {
      const res = await fetchAPI(`/admin/users/${userId}/addresses/${addressId}`, {
        method: 'DELETE',
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Alamat dihapus');
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ['user-addresses', userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <CenteredSpinner />;
  if (isError) return <EmptyState title="Gagal memuat alamat" note="Coba muat ulang halaman." />;
  if (!data || data.length === 0)
    return <EmptyState title="Belum ada alamat" note="Pengguna ini belum menyimpan alamat." />;

  return (
    <>
      <div className="space-y-2">
        {data.map((a) => (
          <div
            key={a.id}
            className="flex items-start justify-between gap-2 rounded-xl border border-border bg-card p-3 text-sm"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium">{a.label || 'Alamat'}</span>
                {a.is_default && <Badge variant="neutral">Utama</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{a.address}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3 shrink-0" />
                {[nstr(a.district), nstr(a.city), nstr(a.province), nstr(a.postal_code) ? `Kode Pos ${nstr(a.postal_code)}` : null].filter(Boolean).join(', ') || '-'}
              </p>
            </div>
            {canEdit && (
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon-sm" aria-label="Edit alamat" onClick={() => setEditing(a)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Hapus alamat"
                  onClick={() => setToDelete(a)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <EditAddressDialog
          userId={userId}
          address={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ['user-addresses', userId] });
          }}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        variant="danger"
        title="Hapus alamat ini?"
        description={
          <>
            <span className="font-medium text-foreground">{toDelete?.label || 'Alamat'}</span> —{' '}
            {toDelete?.address}. Alamat lama diarsipkan ke audit log sebelum dihapus.
          </>
        }
        confirmLabel="Hapus alamat"
        loading={remove.isPending}
      />
    </>
  );
}

function EditAddressDialog({
  userId,
  address,
  onClose,
  onSaved,
}: {
  userId: string;
  address: UserAddressRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    label: address.label || '',
    address: address.address || '',
    address_detail: nstr(address.address_detail) || '',
    city: nstr(address.city) || '',
    district: nstr(address.district) || '',
    province: nstr(address.province) || '',
    postal_code: nstr(address.postal_code) || '',
    is_default: address.is_default,
  });

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI(`/admin/users/${userId}/addresses/${address.id}`, {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Alamat diperbarui');
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal open onClose={onClose} title="Edit Alamat">
      <div className="space-y-3">
        <div className="flex flex-col gap-1.5">
          <Label>Label</Label>
          <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Alamat lengkap</Label>
          <Textarea
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Detail / Catatan</Label>
          <Input
            value={form.address_detail}
            onChange={(e) => setForm((f) => ({ ...f, address_detail: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label>Provinsi</Label>
            <Input
              value={form.province}
              onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Kota</Label>
            <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Kecamatan</Label>
            <Input
              value={form.district}
              onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Kode Pos</Label>
            <Input
              value={form.postal_code}
              onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value.replace(/\D/g, '') }))}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_default}
            onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
            className="size-4 rounded border-input"
          />
          Jadikan alamat utama
        </label>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Menyimpan…' : 'Simpan Alamat'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
