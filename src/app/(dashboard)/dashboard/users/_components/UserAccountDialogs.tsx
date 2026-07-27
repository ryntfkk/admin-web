'use client';

import { useState } from 'react';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type { UserDetailRow } from '@/types/admin';
import { nstr } from '@/lib/sql';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { useAdminMutation, type DialogProps } from './UserActionDialogs';

/** Dialog yang menyentuh akun (peran, identitas login, rekening). */

export const ROLE_OPTIONS = [
  { value: 'customer', label: 'Pelanggan' },
  { value: 'partner', label: 'Mitra' },
  { value: 'admin', label: 'Admin' },
];

export function EditRolesDialog({
  userId,
  user,
  onDone,
  onClose,
}: DialogProps & { user: UserDetailRow }) {
  const [roles, setRoles] = useState<string[]>(user.roles ?? [user.active_role]);
  const [activeRole, setActiveRole] = useState(user.active_role);

  const save = useAdminMutation(
    async () => {
      const res = await fetchAPI(`/admin/users/${userId}/roles`, {
        method: 'PUT',
        body: JSON.stringify({ roles, active_role: activeRole }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    'Peran diperbarui — sesi pengguna dicabut',
    onDone,
  );

  function toggleRole(value: string) {
    setRoles((prev) => {
      const next = prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value];
      // Peran aktif wajib termasuk daftar peran; backend menolak bila tidak.
      if (!next.includes(activeRole) && next.length > 0) setActiveRole(next[0]);
      return next;
    });
  }

  return (
    <Modal open onClose={onClose} title="Ubah Peran">
      <div className="space-y-3">
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-xs text-warning">
          Peran ikut ditandatangani di token login. Menyimpan perubahan akan mencabut semua sesi
          pengguna ini, supaya peran lama tidak terpakai sampai tokennya kedaluwarsa.
        </p>

        <div className="space-y-1.5">
          <Label>Peran yang dimiliki</Label>
          {ROLE_OPTIONS.map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-input"
                checked={roles.includes(o.value)}
                onChange={() => toggleRole(o.value)}
              />
              {o.label}
            </label>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="active-role">Peran aktif</Label>
          <Select id="active-role" value={activeRole} onChange={(e) => setActiveRole(e.target.value)}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="destructive"
            disabled={roles.length === 0 || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Menyimpan…' : 'Simpan peran'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function EditUsernameDialog({
  userId,
  user,
  onDone,
  onClose,
}: DialogProps & { user: UserDetailRow }) {
  const [username, setUsername] = useState(user.username);

  const save = useAdminMutation(
    async () => {
      const res = await fetchAPI(`/admin/users/${userId}/username`, {
        method: 'PUT',
        body: JSON.stringify({ username: username.trim() }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    'Username diperbarui',
    onDone,
  );

  return (
    <Modal open onClose={onClose} title="Ubah Username">
      <div className="space-y-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-username">Username</Label>
          <Input
            id="new-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Dipakai untuk login. Harus unik di seluruh platform.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            disabled={!username.trim() || username === user.username || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function EditBankDialog({
  userId,
  user,
  onDone,
  onClose,
}: DialogProps & { user: UserDetailRow }) {
  const [form, setForm] = useState({
    bank_code: nstr(user.bank_code) ?? '',
    bank_account_number: nstr(user.bank_account_number) ?? '',
    bank_account_name: nstr(user.bank_account_name) ?? '',
  });

  const save = useAdminMutation(
    async () => {
      const res = await fetchAPI(`/admin/users/${userId}/bank`, {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    'Rekening diperbarui',
    onDone,
  );

  return (
    <Modal open onClose={onClose} title="Rekening Bank">
      <div className="space-y-3">
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-xs text-warning">
          Rekening menentukan tujuan pencairan saldo. Nilai lama tersimpan di audit log setiap kali
          diubah.
        </p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="u-bank-code">Kode bank</Label>
          <Input
            id="u-bank-code"
            value={form.bank_code}
            onChange={(e) => setForm((f) => ({ ...f, bank_code: e.target.value }))}
            placeholder="mis. BCA"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="u-bank-number">Nomor rekening</Label>
          <Input
            id="u-bank-number"
            value={form.bank_account_number}
            onChange={(e) => setForm((f) => ({ ...f, bank_account_number: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="u-bank-name">Atas nama</Label>
          <Input
            id="u-bank-name"
            value={form.bank_account_name}
            onChange={(e) => setForm((f) => ({ ...f, bank_account_name: e.target.value }))}
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Menyimpan…' : 'Simpan rekening'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
