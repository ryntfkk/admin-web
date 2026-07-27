'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { fetchAPI, qs } from '@/lib/api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type { ReportRow } from '@/types/admin';
import { nstr } from '@/lib/sql';
import { formatDateTime } from '@/lib/format';
import {
  REPORT_STATUS_OPTIONS,
  REPORT_STATUS_LABELS,
  REPORT_TYPE_OPTIONS,
  REPORT_TYPE_LABELS,
  reportStatusVariant,
  reportTypeVariant,
} from '@/lib/enums';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DataTable, type Column } from '@/components/ui/data-table';

const PER_PAGE = 20;

export default function ReportsPage() {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [targetType, setTargetType] = useState('');
  const [searchInput, setSearchInput] = useState('');
  // Pencarian dijalankan SERVER (AdminListReports punya param `search`), jadi
  // hasilnya mencakup seluruh laporan — bukan hanya halaman yang kebetulan termuat.
  const search = useDebouncedValue(searchInput.trim(), 300);
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', status, targetType, search, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<ReportRow>>(
        `/admin/reports${qs({ status, target_type: targetType, search, page, per_page: PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const columns: Column<ReportRow>[] = [
    {
      key: 'reporter',
      header: 'Pelapor',
      cell: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{r.reporter_name}</span>
          {r.unread_count > 0 && (
            <Badge variant="danger">
              <MessageSquare className="mr-1 size-3" />
              {r.unread_count}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Target',
      cell: (r) => (
        <Badge variant={reportTypeVariant(r.target_type)}>
          {REPORT_TYPE_LABELS[r.target_type] || r.target_type}
        </Badge>
      ),
      hideBelow: 'sm',
    },
    {
      key: 'reason',
      header: 'Alasan',
      cell: (r) => (
        <span className="block max-w-[260px] truncate text-muted-foreground">
          {nstr(r.description) || r.reason_category || '-'}
        </span>
      ),
      hideBelow: 'md',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <Badge variant={reportStatusVariant(r.status)}>
          {REPORT_STATUS_LABELS[r.status] || r.status}
        </Badge>
      ),
    },
    {
      key: 'created',
      header: 'Dibuat',
      cell: (r) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatDateTime(r.created_at)}
        </span>
      ),
      hideBelow: 'lg',
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Laporan</h1>
        <p className="text-sm text-muted-foreground">
          Laporan & tiket bantuan dari pengguna — klik baris untuk membaca bukti dan membalas.
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={data?.data}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="Tidak ada laporan"
        emptyNote="Belum ada laporan untuk filter ini."
        onRowClick={(r) => router.push(`/dashboard/reports/${r.id}`)}
        page={page}
        perPage={PER_PAGE}
        total={data?.pagination?.total ?? 0}
        onPageChange={setPage}
        toolbar={
          <>
            <div className="w-40">
              <Select
                value={status}
                aria-label="Filter status laporan"
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                {REPORT_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-40">
              <Select
                value={targetType}
                aria-label="Filter tipe target"
                onChange={(e) => {
                  setTargetType(e.target.value);
                  setPage(1);
                }}
              >
                {REPORT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-48 flex-1">
              <Input
                placeholder="Cari pelapor, kategori, keterangan…"
                aria-label="Cari laporan"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </>
        }
      />
    </div>
  );
}
