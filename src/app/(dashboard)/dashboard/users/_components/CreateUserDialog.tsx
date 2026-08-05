'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import { toast } from '@/lib/store/toastStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { ROLE_OPTIONS } from './UserAccountDialogs';

/**
 * Pembuatan akun oleh admin.
 *
 * `endpoint` dibedakan supaya pembuatan akun ADMIN punya jalur & audit sendiri
 * (`CREATE_ADMIN`) . menambah pengelola bukan peristiwa yang sama dengan
 * menambah pelanggan biasa.
 */
export default function CreateUserDialog({
  mode = 'user',
  onClose,
  onCreated,
}: {
  mode?: 'user' | 'admin';
  onClose: () => void;
  onCreated: () => void;
}) {
  const isAdmin = mode === 'admin';
  const [form, setForm] = useState({
    username: '',
    name: '',
    phone: '',
    email: '',
    password: '',
    active_role: 'customer',
    is_verified: false,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.phone.trim() && !form.email.trim()) {
        throw new Error('Isi minimal telepon atau email');
      }
      if (form.password.length < 8) throw new Error('Password minimal 8 karakter');

      const body = isAdmin
        ? {
          username: form.username.trim(),
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          password: form.password,
        }
        : {
          username: form.username.trim(),
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          password: form.password,
          roles: [form.active_role],
          active_role: form.active_role,
          is_verified: form.is_verified,
        };

      const res = await fetchAPI(isAdmin ? '/admin/admins' : '/admin/users', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success(isAdmin ? 'Akun admin dibuat' : 'Pengguna dibuat');
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal open onClose={onClose} title={isAdmin ? 'Tambah Akun Admin' : 'Tambah Pengguna'}>
      <div className="space-y-3">
        {isAdmin && (
          <p className="rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-xs text-warning">
            Akun admin punya kuasa penuh atas seluruh data dan saldo platform. Pembuatannya tercatat
            di audit log sebagai CREATE_ADMIN.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cu-name">Nama</Label>
            <Input
              id="cu-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cu-username">Username</Label>
            <Input
              id="cu-username"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cu-phone">Telepon</Label>
            <Input
              id="cu-phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="08xx / 62xx"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cu-email">Email</Label>
            <Input
              id="cu-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Wajib isi minimal salah satu dari telepon atau email. Nomor otomatis disimpan dalam format
          kanonik 62xxx.
        </p>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cu-password">Password awal</Label>
          <Input
            id="cu-password"
            type="text"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="Minimal 8 karakter"
          />
          <p className="text-xs text-muted-foreground">
            Sampaikan ke pemilik akun lewat kanal yang aman . password tidak pernah disimpan di audit
            log.
          </p>
        </div>

        {!isAdmin && (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cu-role">Peran</Label>
              <Select
                id="cu-role"
                value={form.active_role}
                onChange={(e) => setForm((f) => ({ ...f, active_role: e.target.value }))}
              >
                {ROLE_OPTIONS.filter((o) => o.value !== 'admin').map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                Akun admin dibuat lewat halaman Admin agar jejak auditnya terpisah.
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-input"
                checked={form.is_verified}
                onChange={(e) => setForm((f) => ({ ...f, is_verified: e.target.checked }))}
              />
              Tandai sudah terverifikasi
            </label>
          </>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            disabled={!form.name.trim() || !form.username.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? 'Membuat…' : 'Buat akun'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
