'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ShieldAlert } from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type { AdminAccount } from '@/types/admin';
import { formatDateTime } from '@/lib/format';
import { useAuthStore } from '@/lib/store/authStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import CreateUserDialog from '../users/_components/CreateUserDialog';

export default function AdminsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [creating, setCreating] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admins'],
    queryFn: async () => {
      const res = await fetchAPI<AdminAccount[]>('/admin/admins');
      if (!res.success) throw new Error(getErrorMessage(res));
      return res.data ?? [];
    },
  });

  const columns: Column<AdminAccount>[] = [
    {
      key: 'name',
      header: 'Nama',
      cell: (a) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{a.name}</span>
            {a.id === currentUser?.id && <Badge variant="info">Anda</Badge>}
          </div>
          <div className="truncate text-xs text-muted-foreground">@{a.username}</div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Kontak',
      cell: (a) => <span className="text-muted-foreground">{a.email || a.phone || '-'}</span>,
      hideBelow: 'sm',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (a) =>
        a.is_suspended ? (
          <Badge variant="danger">Suspended</Badge>
        ) : (
          <Badge variant="success">Aktif</Badge>
        ),
    },
    {
      key: 'created',
      header: 'Dibuat',
      cell: (a) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatDateTime(a.created_at)}
        </span>
      ),
      hideBelow: 'md',
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Akun Admin</h1>
        <p className="text-sm text-muted-foreground">
          Siapa saja yang punya akses ke panel ini. Klik baris untuk membuka profilnya.
        </p>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        <p>
          Semua admin punya kuasa yang sama . termasuk mengubah saldo dan membatalkan pesanan. Tidak
          ada tingkatan hak akses, sehingga <strong>audit log</strong> adalah satu-satunya
          pertanggungjawaban. Admin juga sengaja tidak bisa menyuspend, menghapus, atau menurunkan
          peran admin lain lewat panel.
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={data}
        getRowId={(a) => a.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="Belum ada admin"
        onRowClick={(a) => router.push(`/dashboard/users/${a.id}`)}
        showDensityToggle={false}
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Tambah admin
          </Button>
        }
      />

      {creating && (
        <CreateUserDialog
          mode="admin"
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ['admins'] });
          }}
        />
      )}
    </div>
  );
}
