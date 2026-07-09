'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, ShieldBan, ShieldCheck, Cog } from 'lucide-react';
import { fetchAPI, qs } from '@/lib/api';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type { UserRow, UserDetailRow } from '@/types/admin';
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
  const [mode, setMode] = useState<'view' | 'suspend' | 'unsuspend'>('view');
  const [duration, setDuration] = useState('24');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['user-detail', userId],
    queryFn: async () => {
      const res = await fetchAPI<UserDetailRow>(`/admin/users/${userId}`);
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['users'] });
    qc.invalidateQueries({ queryKey: ['user-detail', userId] });
  }

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
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{data.name}</p>
              <p className="text-sm text-muted-foreground">
                {nstr(data.email) || nstr(data.phone) || '-'}
              </p>
            </div>
            {data.is_suspended ? (
              <Badge variant="danger">Suspended</Badge>
            ) : (
              <Badge variant="success">Aktif</Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Role aktif" value={roleLabel[data.active_role] || data.active_role} />
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
