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
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

type Target = 'user' | 'customer' | 'partner' | 'all';

const TARGET_LABEL: Record<Target, string> = {
  user: 'Satu pengguna (berdasarkan ID)',
  customer: 'Semua pelanggan',
  partner: 'Semua mitra',
  all: 'Semua pengguna aktif',
};

/**
 * Compose notifikasi keluar.
 *
 * Sebelumnya halaman Notifikasi hanya bisa MENGHAPUS . tidak ada cara mengumumkan
 * apa pun ke pengguna dari dalam sistem.
 */
export default function SendNotificationDialog({
  onClose,
  onSent,
}: {
  onClose: () => void;
  onSent: () => void;
}) {
  const [target, setTarget] = useState<Target>('user');
  const [userId, setUserId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [confirming, setConfirming] = useState(false);

  const isBroadcast = target !== 'user';

  const send = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string> = { title: title.trim(), body: body.trim() };
      if (target === 'user') payload.user_id = userId.trim();
      // role kosong = seluruh pengguna aktif (lihat AdminListUserIDsByRole).
      else if (target !== 'all') payload.role = target;

      const res = await fetchAPI<{ recipients: number }>('/admin/notifications', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
      return res.data?.recipients ?? 0;
    },
    onSuccess: (recipients) => {
      toast.success(`Notifikasi terkirim ke ${recipients} penerima`);
      setConfirming(false);
      onSent();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSend =
    title.trim().length > 0 && body.trim().length > 0 && (target !== 'user' || userId.trim() !== '');

  return (
    <>
      <Modal open onClose={onClose} title="Kirim Notifikasi" className="max-w-xl">
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notif-target">Penerima</Label>
            <Select
              id="notif-target"
              value={target}
              onChange={(e) => setTarget(e.target.value as Target)}
            >
              {(Object.keys(TARGET_LABEL) as Target[]).map((t) => (
                <option key={t} value={t}>
                  {TARGET_LABEL[t]}
                </option>
              ))}
            </Select>
            {isBroadcast && (
              <p className="text-xs text-muted-foreground">
                Pengguna yang di-suspend atau sudah dihapus tidak ikut menerima.
              </p>
            )}
          </div>

          {target === 'user' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notif-user">ID Pengguna</Label>
              <Input
                id="notif-user"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="UUID pengguna"
                className="font-mono text-xs"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notif-title">Judul</Label>
            <Input
              id="notif-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
              placeholder="mis. Pemeliharaan sistem Sabtu malam"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notif-body">Isi pesan</Label>
            <Textarea
              id="notif-body"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Tulis pengumuman yang akan muncul di aplikasi pengguna…"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={onClose}>
              Batal
            </Button>
            <Button
              disabled={!canSend}
              onClick={() => (isBroadcast ? setConfirming(true) : send.mutate())}
            >
              {send.isPending ? 'Mengirim…' : isBroadcast ? 'Tinjau & kirim' : 'Kirim'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Broadcast tidak bisa ditarik kembali setelah terkirim, jadi butuh
          konfirmasi terpisah . beda dari kirim ke satu orang. */}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => send.mutate()}
        variant="danger"
        title="Kirim ke banyak pengguna?"
        description={
          <>
            Pesan <strong className="text-foreground">“{title.trim()}”</strong> akan dikirim ke{' '}
            <strong className="text-foreground">{TARGET_LABEL[target].toLowerCase()}</strong> dan
            tidak bisa ditarik kembali.
          </>
        }
        confirmLabel="Kirim sekarang"
        confirmPhrase="KIRIM"
        loading={send.isPending}
      />
    </>
  );
}
