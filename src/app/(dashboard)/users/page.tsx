'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, ShieldBan, ShieldCheck, UserRound } from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type { UserDetailRow } from '@/types/admin';
import { nstr, ntime } from '@/lib/sql';
import { formatDateTime } from '@/lib/format';
import { toast } from '@/lib/store/toastStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { Card, CardContent } from '@/components/ui/card';
import { CenteredSpinner } from '@/components/ui/feedback';

const DURATION_OPTIONS = [
  { value: '24', label: '24 jam' },
  { value: '72', label: '3 hari' },
  { value: '168', label: '7 hari' },
  { value: '720', label: '30 hari' },
  { value: '0', label: 'Permanen' },
];

export default function UsersPage() {
  const qc = useQueryClient();
  const [input, setInput] = useState('');
  const [userId, setUserId] = useState('');
  const [modal, setModal] = useState<'suspend' | 'unsuspend' | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['user-detail', userId],
    enabled: !!userId,
    queryFn: async () => {
      const res = await fetchAPI<UserDetailRow>(`/admin/users/${userId}`);
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pengguna</h1>
        <p className="text-sm text-muted-foreground">
          Cari pengguna berdasarkan ID untuk melihat detail &amp; mengelola akun
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tempel User ID (UUID)…"
          onKeyDown={(e) => e.key === 'Enter' && setUserId(input.trim())}
          className="font-mono"
        />
        <Button onClick={() => setUserId(input.trim())} disabled={!input.trim()}>
          <Search className="size-4" />
          Cari
        </Button>
      </div>

      {userId && isLoading && <CenteredSpinner />}
      {userId && isError && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {(error as Error).message}
        </p>
      )}

      {data && (
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserRound className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="font-medium">{data.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {nstr(data.email) || nstr(data.phone) || '-'}
                </p>
              </div>
              <div className="ml-auto">
                {data.is_suspended ? (
                  <Badge variant="danger">Suspended</Badge>
                ) : (
                  <Badge variant="success">Aktif</Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Role aktif" value={data.active_role} />
              <Field label="Terdaftar" value={formatDateTime(data.created_at)} />
              {data.is_suspended && (
                <Field
                  label="Suspend s/d"
                  value={ntime(data.suspended_until) ? formatDateTime(ntime(data.suspended_until)) : 'Permanen'}
                />
              )}
              <Field label="User ID" value={data.id} mono />
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              {data.is_suspended ? (
                <Button onClick={() => setModal('unsuspend')}>
                  <ShieldCheck className="size-4" />
                  Aktifkan Akun
                </Button>
              ) : (
                <Button variant="destructive" onClick={() => setModal('suspend')}>
                  <ShieldBan className="size-4" />
                  Suspend Akun
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {modal === 'suspend' && data && (
        <SuspendModal
          userId={data.id}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            qc.invalidateQueries({ queryKey: ['user-detail', userId] });
          }}
        />
      )}
      {modal === 'unsuspend' && data && (
        <UnsuspendModal
          userId={data.id}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            qc.invalidateQueries({ queryKey: ['user-detail', userId] });
          }}
        />
      )}
    </div>
  );
}

function SuspendModal({
  userId,
  onClose,
  onDone,
}: {
  userId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [duration, setDuration] = useState('24');
  const [reason, setReason] = useState('');

  const mut = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI(`/admin/users/${userId}/suspend`, {
        method: 'PUT',
        body: JSON.stringify({ duration_hours: Number(duration), reason }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Akun di-suspend');
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Alasan suspend…"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim() || mut.isPending}
            onClick={() => mut.mutate()}
          >
            Suspend
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function UnsuspendModal({
  userId,
  onClose,
  onDone,
}: {
  userId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [notes, setNotes] = useState('');

  const mut = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI(`/admin/users/${userId}/unsuspend`, {
        method: 'PUT',
        body: JSON.stringify({ notes }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Akun diaktifkan kembali');
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal open onClose={onClose} title="Aktifkan Akun">
      <div className="space-y-3">
        <div className="flex flex-col gap-1.5">
          <Label>Catatan (opsional)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Catatan…"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button disabled={mut.isPending} onClick={() => mut.mutate()}>
            Aktifkan
          </Button>
        </div>
      </div>
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
