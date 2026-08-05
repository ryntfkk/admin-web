'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ImageIcon } from 'lucide-react';
import { fetchAPI, qs } from '@/lib/api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type { ServiceRow } from '@/types/admin';
import { formatIDR } from '@/lib/format';
import { SERVICE_STATUS_OPTIONS } from '@/lib/enums';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DataTable, type Column } from '@/components/ui/data-table';

const PER_PAGE = 20;

const UNIT_LABEL: Record<string, string> = {
  per_hour: 'jam',
  per_unit: 'unit',
  per_service: 'jasa',
};

export default function ServicesPage() {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  // Pencarian langsung: hasil menyusul 300ms setelah admin berhenti mengetik.
  const search = useDebouncedValue(searchInput.trim(), 300);
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['services', status, search, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<ServiceRow>>(
        `/admin/services${qs({ status, q: search, page, per_page: PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const columns: Column<ServiceRow>[] = [
    {
      key: 'service',
      header: 'Layanan',
      cell: (s) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{s.name}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <ImageIcon className="size-3" />
            {s.photo_count} foto · {s.estimated_duration} mnt
          </div>
        </div>
      ),
    },
    {
      key: 'partner',
      header: 'Mitra',
      cell: (s) => <span className="text-muted-foreground">{s.partner_name}</span>,
      hideBelow: 'md',
    },
    {
      key: 'category',
      header: 'Kategori',
      cell: (s) => <span className="text-muted-foreground">{s.category_name}</span>,
      hideBelow: 'lg',
    },
    {
      key: 'price',
      header: 'Harga',
      align: 'right',
      cell: (s) => (
        <span className="whitespace-nowrap tabular-nums">
          {formatIDR(s.price)}
          <span className="text-xs text-muted-foreground">
            /{UNIT_LABEL[s.unit] ?? 'jasa'}
          </span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (s) =>
        s.is_active ? <Badge variant="success">Aktif</Badge> : <Badge variant="neutral">Nonaktif</Badge>,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Produk Jasa</h1>
        <p className="text-sm text-muted-foreground">
          Moderasi layanan yang ditawarkan mitra . klik baris untuk mengedit, mengatur foto, dan
          variasi harga.
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={data?.data}
        getRowId={(s) => s.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="Tidak ada layanan"
        emptyNote="Coba ubah filter status atau pencarian."
        onRowClick={(s) => router.push(`/dashboard/services/${s.id}`)}
        page={page}
        perPage={PER_PAGE}
        total={data?.pagination?.total ?? 0}
        onPageChange={setPage}
        toolbar={
          <>
            <div className="w-44">
              <Select
                value={status}
                aria-label="Filter status layanan"
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                {SERVICE_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-52 flex-1">
              <Input
                value={searchInput}
                placeholder="Cari nama layanan, mitra, kategori…"
                aria-label="Cari layanan"
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
