'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchAPI, qs } from '@/lib/api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type { PendingPartnerRow } from '@/types/admin';
import { nstr } from '@/lib/sql';
import { formatDateTime } from '@/lib/format';
import {
  PARTNER_STATUS_OPTIONS,
  PARTNER_STATUS_LABELS,
  partnerStatusVariant,
} from '@/lib/enums';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DataTable, type Column } from '@/components/ui/data-table';

const PER_PAGE = 20;

export default function PartnersPage() {
  const router = useRouter();
  const [status, setStatus] = useState('pending');
  const [partnerType, setPartnerType] = useState('');
  const [searchInput, setSearchInput] = useState('');
  // Pencarian langsung: hasil menyusul 300ms setelah admin berhenti mengetik.
  const search = useDebouncedValue(searchInput.trim(), 300);
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['partners', status, partnerType, search, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<PendingPartnerRow>>(
        `/admin/partners${qs({ status, partner_type: partnerType, q: search, page, per_page: PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const columns: Column<PendingPartnerRow>[] = [
    {
      key: 'name',
      header: 'Nama',
      // Nama tampil (yang dilihat pelanggan) di depan; nama orang/PIC di
      // bawahnya. Untuk perorangan display_name NULL sehingga keduanya sama dan
      // baris kedua tidak dirender.
      cell: (p) => {
        const display = nstr(p.display_name);
        return (
          <div className="flex flex-col">
            <span className="font-medium">{display || p.name}</span>
            {display && <span className="text-xs text-muted-foreground">PIC: {p.name}</span>}
          </div>
        );
      },
    },
    {
      key: 'type',
      header: 'Tipe',
      cell: (p) => (
        <Badge variant={p.partner_type === 'vendor' ? 'info' : 'neutral'}>
          {p.partner_type === 'vendor' ? 'Badan Usaha' : 'Perorangan'}
        </Badge>
      ),
      hideBelow: 'sm',
    },
    {
      key: 'contact',
      header: 'Kontak',
      cell: (p) => (
        <span className="text-muted-foreground">{nstr(p.phone) || nstr(p.email) || '-'}</span>
      ),
      hideBelow: 'sm',
    },
    {
      key: 'submitted',
      header: 'Masuk',
      cell: (p) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatDateTime(p.submitted_at)}
        </span>
      ),
      hideBelow: 'md',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (p) => (
        <Badge variant={partnerStatusVariant(p.verification_status)}>
          {PARTNER_STATUS_LABELS[p.verification_status] || p.verification_status}
        </Badge>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mitra</h1>
        <p className="text-sm text-muted-foreground">
          Verifikasi pendaftaran & direktori semua mitra . klik baris untuk meninjau dokumen KYC.
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={data?.data}
        getRowId={(p) => p.partner_id}
        isLoading={isLoading}
        error={error}
        emptyTitle="Tidak ada mitra"
        emptyNote="Coba ubah filter status atau pencarian."
        onRowClick={(p) => router.push(`/dashboard/partners/${p.partner_id}`)}
        page={page}
        perPage={PER_PAGE}
        total={data?.pagination?.total ?? 0}
        onPageChange={setPage}
        toolbar={
          <>
            <div className="w-48">
              <Select
                value={status}
                aria-label="Filter status verifikasi"
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                {PARTNER_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-44">
              <Select
                value={partnerType}
                aria-label="Filter tipe mitra"
                onChange={(e) => {
                  setPartnerType(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Semua tipe</option>
                <option value="individual">Perorangan</option>
                <option value="vendor">Badan Usaha</option>
              </Select>
            </div>
            <div className="min-w-52 flex-1">
              <Input
                value={searchInput}
                placeholder="Cari nama, nama usaha, telepon, email…"
                aria-label="Cari mitra"
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
