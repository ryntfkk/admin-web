'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Trash2, Check, CheckCheck } from 'lucide-react';
import { fetchAPI, qs } from '@/lib/api';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type { NotificationRow } from '@/types/admin';
import { nstr } from '@/lib/sql';
import { formatDateTime } from '@/lib/format';
import { toast } from '@/lib/store/toastStore';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { CenteredSpinner, EmptyState } from '@/components/ui/feedback';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

const PER_PAGE = 20;

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState('');
  const [notifType, setNotifType] = useState('');
  const [readStatus, setReadStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', userId, notifType, readStatus, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<NotificationRow>>(
        `/admin/notifications${qs({ user_id: userId || undefined, type: notifType || undefined, read_status: readStatus || undefined, page, per_page: PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifikasi</h1>
          <p className="text-sm text-muted-foreground">Kelola notifikasi platform</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-40">
            <Select
              value={notifType}
              onChange={(e) => {
                setNotifType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua tipe</option>
              <option value="ORDER">Order</option>
              <option value="PAYMENT">Pembayaran</option>
              <option value="DISPUTE">Sengketa</option>
              <option value="REVIEW">Review</option>
              <option value="SYSTEM">Sistem</option>
            </Select>
          </div>
          <div className="w-32">
            <Select
              value={readStatus}
              onChange={(e) => {
                setReadStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua</option>
              <option value="read">Sudah dibaca</option>
              <option value="unread">Belum dibaca</option>
            </Select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <CenteredSpinner />
      ) : rows.length === 0 ? (
        <EmptyState title="Tidak ada notifikasi" note="Belum ada notifikasi untuk filter ini." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Judul</TableHead>
                <TableHead>Isi</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-medium">{n.user_name}</TableCell>
                  <TableCell>
                    <Badge variant="info">{n.type}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{n.title}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {nstr(n.body) || '-'}
                  </TableCell>
                  <TableCell>
                    {n.is_read ? (
                      <Badge variant="neutral">
                        <CheckCheck className="mr-1 size-3" />
                        Baca
                      </Badge>
                    ) : (
                      <Badge variant="warning">
                        <Check className="mr-1 size-3" />
                        Baru
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(n.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DeleteNotificationButton notificationId={n.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

function DeleteNotificationButton({ notificationId }: { notificationId: string }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI(`/admin/notifications/${notificationId}`, {
        method: 'DELETE',
      });
      if (!res.success) throw new Error(getErrorMessage(res));
      return res;
    },
    onSuccess: () => {
      toast.success('Notifikasi dihapus');
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        if (window.confirm('Hapus notifikasi ini?')) del.mutate();
      }}
      disabled={del.isPending}
    >
      <Trash2 className="size-4 text-rose-500" />
    </Button>
  );
}
