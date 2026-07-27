'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { fetchAPI, qs } from '@/lib/api';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type { AuditLog } from '@/types/admin';
import { formatDateTime } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/lib/store/toastStore';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Sheet } from '@/components/ui/sheet';
import { Field, FieldGrid } from '@/components/ui/field';
import { useCommandStore } from '@/lib/store/commandStore';

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AuditLogsPage() {
  const openCommandPalette = useCommandStore((s) => s.toggle);
  const [form, setForm] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-logs', applied, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<AuditLog>>(auditQuery(applied, page, PER_PAGE));
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const columns: Column<AuditLog>[] = [
    {
      key: 'time',
      header: 'Waktu',
      cell: (l) => (
        <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(l.created_at)}</span>
      ),
    },
    { key: 'admin', header: 'Admin', cell: (l) => <span className="font-medium">{l.admin_username}</span> },
    { key: 'action', header: 'Aksi', cell: (l) => <Badge variant="neutral">{l.action}</Badge> },
    {
      key: 'target',
      header: 'Target',
      cell: (l) => (
        <span className="block max-w-[220px] truncate font-mono text-xs text-muted-foreground">
          {l.target_id || '-'}
        </span>
      ),
      hideBelow: 'md',
    },
    {
      key: 'ip',
      header: 'IP',
      cell: (l) => <span className="font-mono text-xs">{l.ip_address || '-'}</span>,
      hideBelow: 'lg',
    },
    {
      key: 'payload',
      header: 'Detail',
      align: 'right',
      cell: (l) => (
        <span className="text-xs text-muted-foreground">{l.payload != null ? 'Lihat' : '-'}</span>
      ),
    },
  ];

  function applyFilters() {
    setApplied({
      ...form,
      admin_username: form.admin_username.trim(),
      action: form.action.trim(),
      target_id: form.target_id.trim(),
    });
    setPage(1);
    setSelected(null);
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
            Riwayat tindakan admin — klik baris untuk melihat detail perubahan lengkap.
          </p>
        </div>
        <Button variant="outline" disabled={exporting || (data?.pagination?.total ?? 0) === 0} onClick={exportCSV}>
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

      <DataTable
        columns={columns}
        rows={data?.data}
        getRowId={(l) => l.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="Tidak ada log"
        emptyNote="Belum ada aktivitas untuk filter ini."
        onRowClick={setSelected}
        page={page}
        perPage={PER_PAGE}
        total={data?.pagination?.total ?? 0}
        onPageChange={setPage}
      />

      {/* Payload dulu dibuka sebagai baris tambahan di dalam tabel; JSON yang
          panjang jadi sempit dan mendorong baris lain. Panel samping memberi
          ruang penuh sekaligus tempat menautkan entitas yang terdampak. */}
      <Sheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.action}
        description={
          selected ? `${selected.admin_username} · ${formatDateTime(selected.created_at)}` : undefined
        }
      >
        {selected && (
          <div className="space-y-4">
            <FieldGrid columns={1}>
              <Field label="Admin" value={selected.admin_username} />
              <Field label="Waktu" value={formatDateTime(selected.created_at)} />
              <Field label="Alamat IP" value={selected.ip_address} mono />
              <Field
                label="Target"
                mono
                value={
                  selected.target_id ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="break-all">{selected.target_id}</span>
                      {UUID_RE.test(selected.target_id) && (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => openCommandPalette()}
                          title="Cari entitas ini lewat Ctrl+K"
                        >
                          Buka entitas
                        </Button>
                      )}
                    </span>
                  ) : null
                }
              />
            </FieldGrid>

            {selected.payload != null && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Payload</p>
                <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-all rounded-lg border border-border bg-muted/40 p-2.5 font-mono text-xs">
                  {JSON.stringify(selected.payload, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Sheet>
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
