'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { fetchAPI, qs } from '@/lib/api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type { UserRow } from '@/types/admin';
import { nstr, ntime } from '@/lib/sql';
import { formatIDR } from '@/lib/format';
import { USER_ROLE_OPTIONS, USER_STATUS_OPTIONS } from '@/lib/enums';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import CreateUserDialog from './_components/CreateUserDialog';

const PER_PAGE = 20;

const roleLabel: Record<string, string> = {
  customer: 'Pelanggan',
  partner: 'Mitra',
  admin: 'Admin',
};

export default function UsersPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  // Pencarian langsung: hasil menyusul 300ms setelah admin berhenti mengetik.
  const search = useDebouncedValue(searchInput.trim(), 300);
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['users', role, status, search, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<UserRow>>(
        `/admin/users${qs({ role, status, q: search, page, per_page: PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const columns: Column<UserRow>[] = [
    {
      key: 'user',
      header: 'Pengguna',
      cell: (u) => (
        <div className="flex items-center gap-2.5">
          {nstr(u.avatar_url) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={nstr(u.avatar_url)!}
              alt={u.name}
              className="size-8 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
              {u.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate font-medium">{u.name}</div>
            <div className="truncate text-xs text-muted-foreground">@{u.username}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Kontak',
      cell: (u) => (
        <span className="text-muted-foreground">{nstr(u.email) || nstr(u.phone) || '-'}</span>
      ),
      hideBelow: 'md',
    },
    {
      key: 'role',
      header: 'Role',
      cell: (u) => <Badge variant="neutral">{roleLabel[u.active_role] || u.active_role}</Badge>,
      hideBelow: 'sm',
    },
    {
      key: 'balance',
      header: 'Saldo',
      align: 'right',
      cell: (u) => <span className="tabular-nums text-muted-foreground">{formatIDR(u.balance)}</span>,
      hideBelow: 'sm',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (u) =>
        ntime(u.deleted_at) ? (
          <Badge variant="neutral">Dihapus</Badge>
        ) : u.is_suspended ? (
          <Badge variant="danger">Suspended</Badge>
        ) : (
          <Badge variant="success">Aktif</Badge>
        ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pengguna</h1>
        <p className="text-sm text-muted-foreground">
          Klik baris untuk membuka detail, riwayat, dan kontrol akun.
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={data?.data}
        getRowId={(u) => u.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="Tidak ada pengguna"
        emptyNote="Coba ubah filter pencarian."
        onRowClick={(u) => router.push(`/dashboard/users/${u.id}`)}
        page={page}
        perPage={PER_PAGE}
        total={data?.pagination?.total ?? 0}
        onPageChange={setPage}
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Tambah
          </Button>
        }
        toolbar={
          <>
            <div className="w-40">
              <Select
                value={role}
                aria-label="Filter role"
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
                aria-label="Filter status"
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
            <div className="min-w-52 flex-1">
              <Input
                value={searchInput}
                placeholder="Cari nama, username, email, telepon…"
                aria-label="Cari pengguna"
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </>
        }
      />

      {creating && (
        <CreateUserDialog
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ['users'] });
          }}
        />
      )}
    </div>
  );
}
