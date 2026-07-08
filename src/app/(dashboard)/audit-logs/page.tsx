'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAPI, qs } from '@/lib/api';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type { AuditLog } from '@/types/admin';
import { nstr } from '@/lib/sql';
import { formatDateTime } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { CenteredSpinner, EmptyState } from '@/components/ui/feedback';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

const PER_PAGE = 50;

export default function AuditLogsPage() {
  const [adminUsername, setAdminUsername] = useState('');
  const [action, setAction] = useState('');
  const [applied, setApplied] = useState({ admin_username: '', action: '' });
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', applied, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<AuditLog>>(
        `/admin/audit-logs${qs({
          admin_username: applied.admin_username,
          action: applied.action,
          page,
          per_page: PER_PAGE,
        })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  function applyFilters() {
    setApplied({ admin_username: adminUsername.trim(), action: action.trim() });
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground">Riwayat tindakan admin</p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Admin</label>
          <Input
            value={adminUsername}
            onChange={(e) => setAdminUsername(e.target.value)}
            placeholder="username admin"
            className="w-48"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Aksi</label>
          <Input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="VERIFY_PARTNER"
            className="w-56"
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
          />
        </div>
        <button
          onClick={applyFilters}
          className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80"
        >
          Terapkan
        </button>
      </div>

      {isLoading ? (
        <CenteredSpinner />
      ) : rows.length === 0 ? (
        <EmptyState title="Tidak ada log" note="Belum ada aktivitas untuk filter ini." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Aksi</TableHead>
                <TableHead>Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(log.created_at)}
                  </TableCell>
                  <TableCell className="font-medium">{log.admin_username}</TableCell>
                  <TableCell>
                    <Badge variant="neutral">{log.action}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {nstr(log.target_id) || '-'}
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
