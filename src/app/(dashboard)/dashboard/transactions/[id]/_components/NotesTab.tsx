'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type { OrderNote } from '@/types/admin';
import { formatDateTime } from '@/lib/format';
import { toast } from '@/lib/store/toastStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { EntitySection } from '@/components/ui/entity-page';
import { CenteredSpinner } from '@/components/ui/feedback';

/**
 * Catatan internal admin.
 *
 * Terpisah dari `reason` pada riwayat status dengan sengaja: konteks penanganan
 * (hasil telepon ke pelanggan, kesepakatan dengan mitra) perlu bisa dicatat
 * kapan saja, tanpa harus mengubah status pesanan lebih dulu.
 */
export function NotesTab({ orderId }: { orderId: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['order-notes', orderId],
    queryFn: async () => {
      const res = await fetchAPI<OrderNote[]>(`/admin/orders/${orderId}/notes`);
      if (!res.success) throw new Error(getErrorMessage(res));
      return res.data ?? [];
    },
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['order-notes', orderId] });
    // Jumlah catatan tampil sebagai badge pada label tab, yang ikut respons detail.
    qc.invalidateQueries({ queryKey: ['order-detail', orderId] });
  }

  const create = useMutation({
    mutationFn: async (note: string) => {
      const res = await fetchAPI(`/admin/orders/${orderId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      setDraft('');
      invalidate();
      toast.success('Catatan disimpan');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (noteId: string) => {
      const res = await fetchAPI(`/admin/orders/${orderId}/notes/${noteId}`, { method: 'DELETE' });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      invalidate();
      toast.success('Catatan dihapus');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <EntitySection
        title="Tambah catatan"
        description="Hanya terlihat oleh admin. Tidak dikirim ke pelanggan maupun mitra."
      >
        <div className="space-y-2">
          <Textarea
            value={draft}
            rows={3}
            aria-label="Catatan internal"
            placeholder="Mis. sudah dihubungi via WA, pelanggan minta dijadwal ulang pekan depan…"
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex justify-end">
            <Button
              onClick={() => create.mutate(draft.trim())}
              disabled={draft.trim().length === 0 || create.isPending}
            >
              {create.isPending ? 'Menyimpan…' : 'Simpan catatan'}
            </Button>
          </div>
        </div>
      </EntitySection>

      <EntitySection title={`Catatan tersimpan (${data?.length ?? 0})`}>
        {isLoading ? (
          <CenteredSpinner />
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada catatan.</p>
        ) : (
          <div className="space-y-2">
            {data.map((n) => (
              <div key={n.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{n.admin_username}</span> ·{' '}
                    {formatDateTime(n.created_at)}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Hapus catatan"
                    onClick={() => remove.mutate(n.id)}
                    disabled={remove.isPending}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <p className="mt-1 text-sm whitespace-pre-wrap">{n.note}</p>
              </div>
            ))}
          </div>
        )}
      </EntitySection>
    </div>
  );
}
