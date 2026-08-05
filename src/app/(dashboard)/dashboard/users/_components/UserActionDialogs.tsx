'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type { UserDetailRow } from '@/types/admin';
import { nstr } from '@/lib/sql';
import { formatIDR } from '@/lib/format';
import { toast } from '@/lib/store/toastStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { FileUpload, uploadFileToStorage } from '@/components/ui/file-upload';
import { EditBankDialog, EditRolesDialog, EditUsernameDialog } from './UserAccountDialogs';

/** Aksi admin yang butuh formulir sendiri. `null` = tidak ada dialog terbuka. */
export type UserAction =
  | 'suspend'
  | 'unsuspend'
  | 'changePhoto'
  | 'editProfile'
  | 'resetPassword'
  | 'adjustWallet'
  | 'editRoles'
  | 'editUsername'
  | 'editBank';

const DURATION_OPTIONS = [
  { value: '24', label: '24 jam' },
  { value: '72', label: '3 hari' },
  { value: '168', label: '7 hari' },
  { value: '720', label: '30 hari' },
  { value: '0', label: 'Permanen' },
];

/**
 * Semua dialog aksi untuk satu pengguna.
 *
 * Setiap dialog di-mount hanya saat aksinya dipilih (`action === '…'`), sehingga
 * isian formulir selalu mulai bersih tanpa efek pereset . mis. alasan suspend
 * tidak pernah terbawa ke dialog penyesuaian saldo.
 */
export default function UserActionDialogs({
  user,
  action,
  onClose,
}: {
  user: UserDetailRow;
  action: UserAction | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['users'] });
    qc.invalidateQueries({ queryKey: ['user-detail', user.id] });
  }

  const common = { userId: user.id, onDone: () => { invalidate(); onClose(); } };

  if (action === 'suspend') return <SuspendDialog {...common} onClose={onClose} />;
  if (action === 'unsuspend') return <UnsuspendDialog {...common} onClose={onClose} />;
  if (action === 'changePhoto') return <ChangePhotoDialog {...common} user={user} onClose={onClose} />;
  if (action === 'editProfile') return <EditProfileDialog {...common} user={user} onClose={onClose} />;
  if (action === 'resetPassword') return <ResetPasswordDialog {...common} user={user} onClose={onClose} />;
  if (action === 'adjustWallet') return <AdjustWalletDialog {...common} user={user} onClose={onClose} />;
  if (action === 'editRoles') return <EditRolesDialog {...common} user={user} onClose={onClose} />;
  if (action === 'editUsername') return <EditUsernameDialog {...common} user={user} onClose={onClose} />;
  if (action === 'editBank') return <EditBankDialog {...common} user={user} onClose={onClose} />;
  return null;
}

export interface DialogProps {
  userId: string;
  onDone: () => void;
  onClose: () => void;
}

export function useAdminMutation(fn: () => Promise<void>, successMessage: string, onDone: () => void) {
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(successMessage);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

function SuspendDialog({ userId, onDone, onClose }: DialogProps) {
  const [duration, setDuration] = useState('24');
  const [reason, setReason] = useState('');

  const suspend = useAdminMutation(
    async () => {
      const res = await fetchAPI(`/admin/users/${userId}/suspend`, {
        method: 'PUT',
        body: JSON.stringify({ duration_hours: Number(duration), reason }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    'Akun di-suspend',
    onDone,
  );

  return (
    <Modal open onClose={onClose} title="Suspend Akun">
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
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim() || suspend.isPending}
            onClick={() => suspend.mutate()}
          >
            {suspend.isPending ? 'Memproses…' : 'Suspend'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function UnsuspendDialog({ userId, onDone, onClose }: DialogProps) {
  const [notes, setNotes] = useState('');

  const unsuspend = useAdminMutation(
    async () => {
      const res = await fetchAPI(`/admin/users/${userId}/unsuspend`, {
        method: 'PUT',
        body: JSON.stringify({ notes }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    'Akun diaktifkan kembali',
    onDone,
  );

  return (
    <Modal open onClose={onClose} title="Aktifkan Akun">
      <div className="space-y-3">
        <div className="flex flex-col gap-1.5">
          <Label>Catatan (opsional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button disabled={unsuspend.isPending} onClick={() => unsuspend.mutate()}>
            {unsuspend.isPending ? 'Memproses…' : 'Aktifkan'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ChangePhotoDialog({
  userId,
  user,
  onDone,
  onClose,
}: DialogProps & { user: UserDetailRow }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const changePhoto = useAdminMutation(
    async () => {
      if (!selectedFile) throw new Error('Pilih file foto terlebih dahulu');
      const uploadedUrl = await uploadFileToStorage(selectedFile, 'avatar');
      if (!uploadedUrl) throw new Error('Gagal mengupload foto');

      const res = await fetchAPI(`/admin/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ avatar_url: uploadedUrl }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    'Foto profil berhasil diperbarui',
    onDone,
  );

  return (
    <Modal open onClose={onClose} title="Ganti Foto Profil">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Upload foto profil baru untuk {user.name}</p>
        <FileUpload
          currentUrl={nstr(user.avatar_url) || undefined}
          onFileSelect={setSelectedFile}
          previewWidth={120}
          previewHeight={120}
          label="Foto Profil"
        />
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button disabled={!selectedFile || changePhoto.isPending} onClick={() => changePhoto.mutate()}>
            {changePhoto.isPending ? 'Mengupload…' : 'Simpan'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function EditProfileDialog({
  userId,
  user,
  onDone,
  onClose,
}: DialogProps & { user: UserDetailRow }) {
  const [form, setForm] = useState({
    name: user.name || '',
    email: nstr(user.email) || '',
    phone: nstr(user.phone) || '',
  });

  // Backend menolak format yang salah; validasi di sini hanya agar admin tahu
  // sebelum menekan Simpan. 08xx / 62xx / +62xx sama-sama diterima dan
  // dikanonikkan ke 62xxx oleh backend.
  const phoneValid = !form.phone.trim() || /^(\+?62|0)8\d{7,12}$/.test(form.phone.replace(/[\s-]/g, ''));

  const save = useAdminMutation(
    async () => {
      const res = await fetchAPI(`/admin/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    'Profil pengguna diperbarui',
    onDone,
  );

  return (
    <Modal open onClose={onClose} title="Edit Profil">
      <div className="space-y-3">
        <div className="flex flex-col gap-1.5">
          <Label>Nama</Label>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Email</Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Telepon</Label>
          <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <p className={`text-xs ${phoneValid ? 'text-muted-foreground' : 'text-destructive'}`}>
            {phoneValid
              ? 'Disimpan dalam format kanonik 62xxx oleh backend. Mengubah nomor akan mencabut status terverifikasi . admin tidak bisa membuktikan OTP.'
              : 'Format nomor tidak valid (contoh: 08123456789 atau 628123456789).'}
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button disabled={!form.name.trim() || !phoneValid || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ResetPasswordDialog({
  userId,
  user,
  onDone,
  onClose,
}: DialogProps & { user: UserDetailRow }) {
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '', forceLogout: true });

  const reset = useAdminMutation(
    async () => {
      if (form.newPassword.length < 8) throw new Error('Password minimal 8 karakter');
      if (form.newPassword !== form.confirmPassword) throw new Error('Konfirmasi password tidak cocok');
      const res = await fetchAPI(`/admin/users/${userId}/reset-password`, {
        method: 'PUT',
        body: JSON.stringify({ new_password: form.newPassword, force_logout: form.forceLogout }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    'Password pengguna direset',
    onDone,
  );

  const mismatch = form.confirmPassword.length > 0 && form.newPassword !== form.confirmPassword;

  return (
    <Modal open onClose={onClose} title="Reset Password">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Tetapkan password baru untuk <span className="font-medium text-foreground">{user.name}</span>.
          Sampaikan password ini ke pengguna melalui kanal yang aman.
        </p>
        <div className="flex flex-col gap-1.5">
          <Label>Password baru</Label>
          <Input
            type="text"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
            placeholder="Minimal 8 karakter"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Konfirmasi password</Label>
          <Input
            type="text"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
            aria-invalid={mismatch}
          />
        </div>
        {mismatch && <p className="text-xs text-destructive">Konfirmasi password tidak cocok.</p>}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.forceLogout}
            onChange={(e) => setForm((f) => ({ ...f, forceLogout: e.target.checked }))}
            className="size-4 rounded border-input"
          />
          Logout semua sesi (paksa login ulang dengan password baru)
        </label>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            disabled={form.newPassword.length < 8 || mismatch || reset.isPending}
            onClick={() => reset.mutate()}
          >
            {reset.isPending ? 'Menyimpan…' : 'Reset Password'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AdjustWalletDialog({
  userId,
  user,
  onDone,
  onClose,
}: DialogProps & { user: UserDetailRow }) {
  const [form, setForm] = useState({ type: 'CREDIT', amount: '', reason: '' });
  const amount = Number(form.amount) || 0;

  const adjust = useAdminMutation(
    async () => {
      const res = await fetchAPI(`/admin/users/${userId}/wallet/adjust`, {
        method: 'POST',
        body: JSON.stringify({ type: form.type, amount, reason: form.reason.trim() }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    'Saldo berhasil disesuaikan',
    onDone,
  );

  return (
    <Modal open onClose={onClose} title="Sesuaikan Saldo">
      <div className="space-y-3">
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          Saldo saat ini: <span className="font-semibold">{formatIDR(user.balance)}</span>
          {amount > 0 && (
            <span className="ml-1 text-muted-foreground">
              → menjadi{' '}
              <span className="font-semibold text-foreground">
                {formatIDR(form.type === 'CREDIT' ? user.balance + amount : user.balance - amount)}
              </span>
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Jenis penyesuaian</Label>
          <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
            <option value="CREDIT">Tambah saldo (CREDIT)</option>
            <option value="DEBIT">Kurangi saldo (DEBIT)</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Nominal (Rp)</Label>
          <Input
            type="number"
            min="1"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            placeholder="50000"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Alasan (wajib . tercatat di audit log)</Label>
          <Textarea
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            placeholder="mis. Kompensasi keluhan / koreksi refund manual"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="destructive"
            disabled={!form.reason.trim() || amount <= 0 || adjust.isPending}
            onClick={() => adjust.mutate()}
          >
            {adjust.isPending ? 'Memproses…' : 'Terapkan'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
