'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Check, CheckCheck, Send } from 'lucide-react';
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
import { DataTable, type Column } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import SendNotificationDialog from './_components/SendNotificationDialog';

const PER_PAGE = 20;

export default function NotificationsPage() {
  const qcNotif = useQueryClient();
  const [composing, setComposing] = useState(false);
  // Filter per-pengguna didukung backend; kontrol UI-nya menyusul bersama
  // pencarian pengguna di halaman ini.
  const [userId] = useState('');
  const [notifType, setNotifType] = useState('');
  const [readStatus, setReadStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['notifications', userId, notifType, readStatus, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<NotificationRow>>(
        `/admin/notifications${qs({ user_id: userId || undefined, type: notifType || undefined, read_status: readStatus || undefined, page, per_page: PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const columns: Column<NotificationRow>[] = [
    { key: 'user', header: 'User', cell: (n) => <span className="font-medium">{n.user_name}</span> },
    { key: 'type', header: 'Tipe', cell: (n) => <Badge variant="info">{n.type}</Badge>, hideBelow: 'sm' },
    { key: 'title', header: 'Judul', cell: (n) => <span className="font-medium">{n.title}</span> },
    {
      key: 'body',
      header: 'Isi',
      cell: (n) => (
        <span className="block max-w-[220px] truncate text-muted-foreground">{nstr(n.body) || '-'}</span>
      ),
      hideBelow: 'md',
    },
    {
      key: 'read',
      header: 'Status',
      cell: (n) =>
        n.is_read ? (
          <Badge variant="neutral">
            <CheckCheck className="mr-1 size-3" />
            Baca
          </Badge>
        ) : (
          <Badge variant="warning">
            <Check className="mr-1 size-3" />
            Baru
          </Badge>
        ),
    },
    {
      key: 'created',
      header: 'Tanggal',
      cell: (n) => (
        <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(n.created_at)}</span>
      ),
      hideBelow: 'lg',
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (n) => <DeleteNotificationButton notificationId={n.id} />,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifikasi</h1>
          <p className="text-sm text-muted-foreground">
            Riwayat notifikasi platform, sekaligus tempat mengirim pengumuman ke pengguna.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setComposing(true)}>
            <Send className="size-4" />
            Kirim notifikasi
          </Button>
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

      <DataTable
        columns={columns}
        rows={data?.data}
        getRowId={(n) => n.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="Tidak ada notifikasi"
        emptyNote="Belum ada notifikasi untuk filter ini."
        page={page}
        perPage={PER_PAGE}
        total={data?.pagination?.total ?? 0}
        onPageChange={setPage}
      />

      {composing && (
        <SendNotificationDialog
          onClose={() => setComposing(false)}
          onSent={() => {
            setComposing(false);
            qcNotif.invalidateQueries({ queryKey: ['notifications'] });
          }}
        />
      )}
    </div>
  );
}

function DeleteNotificationButton({ notificationId }: { notificationId: string }) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);

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
      setConfirming(false);
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Hapus notifikasi"
        onClick={() => setConfirming(true)}
        disabled={del.isPending}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => del.mutate()}
        variant="danger"
        title="Hapus notifikasi ini?"
        description="Notifikasi hilang dari daftar pengguna. Salinannya diarsipkan ke audit log."
        confirmLabel="Hapus"
        loading={del.isPending}
      />
    </>
  );
}
