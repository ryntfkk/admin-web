'use client';

import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { fetchAPI, qs } from '@/lib/api';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type { AuditLog } from '@/types/admin';
import { formatDateTime } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { CenteredSpinner, EmptyState } from '@/components/ui/feedback';
import { toast } from '@/lib/store/toastStore';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

const PER_PAGE = 50;

interface Filters {
  admin_username: string;
  action: string;
  target_id: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = { admin_username: '', action: '', target_id: '', from: '', to: '' };

function auditQuery(f: Filters, page: number, perPage: number) {
  return `/admin/audit-logs${qs({
    admin_username: f.admin_username,
    action: f.action,
    target_id: f.target_id,
    from: f.from,
    to: f.to,
    page,
    per_page: perPage,
  })}`;
}

export default function AuditLogsPage() {
  const [form, setForm] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', applied, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<AuditLog>>(auditQuery(applied, page, PER_PAGE));
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  function applyFilters() {
    setApplied({
      ...form,
      admin_username: form.admin_username.trim(),
      action: form.action.trim(),
      target_id: form.target_id.trim(),
    });
    setPage(1);
    setExpanded(null);
  }

  async function exportCSV() {
    setExporting(true);
    try {
      // Ambil hingga 1000 baris sesuai filter aktif untuk diserahkan ke penyidik.
      const res = await fetchAPI<PaginatedData<AuditLog>>(auditQuery(applied, 1, 1000));
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      const items = res.data.data ?? [];
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const lines = [
        ['waktu', 'admin', 'aksi', 'target_id', 'ip_address', 'payload'].join(','),
        ...items.map((l) =>
          [
            esc(l.created_at),
            esc(l.admin_username),
            esc(l.action),
            esc(l.target_id ?? ''),
            esc(l.ip_address ?? ''),
            esc(l.payload ? JSON.stringify(l.payload) : ''),
          ].join(','),
        ),
      ];
      const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${items.length} baris diekspor`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal ekspor CSV');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
          <p className="text-sm text-muted-foreground">
            Riwayat tindakan admin — lengkap dengan IP dan detail perubahan
          </p>
        </div>
        <Button variant="outline" disabled={exporting || total === 0} onClick={exportCSV}>
          <Download className="size-4" />
          {exporting ? 'Mengekspor…' : 'Export CSV'}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <FilterInput
          label="Admin"
          value={form.admin_username}
          placeholder="username admin"
          onChange={(v) => setForm((f) => ({ ...f, admin_username: v }))}
          onEnter={applyFilters}
          className="w-40"
        />
        <FilterInput
          label="Aksi"
          value={form.action}
          placeholder="mis. SUSPEND"
          onChange={(v) => setForm((f) => ({ ...f, action: v }))}
          onEnter={applyFilters}
          className="w-44"
        />
        <FilterInput
          label="Target ID"
          value={form.target_id}
          placeholder="UUID target"
          onChange={(v) => setForm((f) => ({ ...f, target_id: v }))}
          onEnter={applyFilters}
          className="w-52"
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Dari</label>
          <Input
            type="date"
            value={form.from}
            onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))}
            className="w-36"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Sampai</label>
          <Input
            type="date"
            value={form.to}
            onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
            className="w-36"
          />
        </div>
        <Button onClick={applyFilters}>Terapkan</Button>
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
                <TableHead className="w-8" />
                <TableHead>Waktu</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Aksi</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((log) => {
                const hasPayload = log.payload != null;
                const isOpen = expanded === log.id;
                return (
                  <Fragment key={log.id}>
                    <TableRow
                      className={hasPayload ? 'cursor-pointer' : undefined}
                      onClick={() => hasPayload && setExpanded(isOpen ? null : log.id)}
                    >
                      <TableCell className="text-muted-foreground">
                        {hasPayload &&
                          (isOpen ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          ))}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(log.created_at)}
                      </TableCell>
                      <TableCell className="font-medium">{log.admin_username}</TableCell>
                      <TableCell>
                        <Badge variant="neutral">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate font-mono text-xs text-muted-foreground">
                        {log.target_id || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.ip_address || '-'}</TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/40">
                          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all p-1 font-mono text-xs">
                            {JSON.stringify(log.payload, null, 2)}
                          </pre>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
          <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

function FilterInput({
  label,
  value,
  placeholder,
  onChange,
  onEnter,
  className,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
        onKeyDown={(e) => e.key === 'Enter' && onEnter()}
      />
    </div>
  );
}
