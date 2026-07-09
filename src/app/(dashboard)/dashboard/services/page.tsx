'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Eye, EyeOff, Trash2, ImageIcon } from 'lucide-react';
import { fetchAPI, qs } from '@/lib/api';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type { ServiceRow } from '@/types/admin';
import { nstr } from '@/lib/sql';
import { formatDateTime, formatIDR } from '@/lib/format';
import { toast } from '@/lib/store/toastStore';
import { SERVICE_STATUS_OPTIONS } from '@/lib/enums';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { CenteredSpinner, EmptyState } from '@/components/ui/feedback';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

const PER_PAGE = 20;

export default function ServicesPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<ServiceRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['services', status, search, page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<ServiceRow>>(
        `/admin/services${qs({ status, q: search, page, per_page: PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const setActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetchAPI(`/admin/services/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: isActive }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: (_r, vars) => {
      toast.success(vars.isActive ? 'Layanan diaktifkan' : 'Layanan dinonaktifkan');
      qc.invalidateQueries({ queryKey: ['services'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchAPI(`/admin/services/${id}`, { method: 'DELETE' });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Layanan dihapus');
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ['services'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Produk Jasa</h1>
        <p className="text-sm text-muted-foreground">
          Moderasi layanan yang ditawarkan mitra — aktif/nonaktifkan atau hapus
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-44">
          <Select
            value={status}
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
        <div className="flex flex-1 gap-2">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari nama layanan, mitra, kategori…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSearch(searchInput.trim());
                setPage(1);
              }
            }}
          />
          <Button
            variant="outline"
            onClick={() => {
              setSearch(searchInput.trim());
              setPage(1);
            }}
          >
            <Search className="size-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <CenteredSpinner />
      ) : rows.length === 0 ? (
        <EmptyState title="Tidak ada layanan" note="Coba ubah filter pencarian." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Layanan</TableHead>
                <TableHead>Mitra</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Harga</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-medium">{s.name}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ImageIcon className="size-3" />
                      {s.photo_count} foto · {s.estimated_duration} mnt
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.partner_name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.category_name}</TableCell>
                  <TableCell>{formatIDR(s.price)}</TableCell>
                  <TableCell>
                    {s.is_active ? (
                      <Badge variant="success">Aktif</Badge>
                    ) : (
                      <Badge variant="neutral">Nonaktif</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={setActive.isPending}
                        onClick={() => setActive.mutate({ id: s.id, isActive: !s.is_active })}
                      >
                        {s.is_active ? (
                          <>
                            <EyeOff className="size-4" />
                            Nonaktifkan
                          </>
                        ) : (
                          <>
                            <Eye className="size-4" />
                            Aktifkan
                          </>
                        )}
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => setToDelete(s)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />
        </>
      )}

      {toDelete && (
        <Modal open onClose={() => setToDelete(null)} title="Hapus Layanan">
          <div className="space-y-4">
            <p className="text-sm">
              Yakin ingin menghapus layanan{' '}
              <span className="font-medium">{toDelete.name}</span> milik{' '}
              <span className="font-medium">{toDelete.partner_name}</span>? Tindakan ini
              menyembunyikan layanan dari aplikasi (soft delete).
            </p>
            {nstr(toDelete.description) && (
              <p className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {nstr(toDelete.description)}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Dibuat {formatDateTime(toDelete.created_at)}
            </p>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="ghost" onClick={() => setToDelete(null)}>
                Batal
              </Button>
              <Button
                variant="destructive"
                disabled={remove.isPending}
                onClick={() => remove.mutate(toDelete.id)}
              >
                Hapus
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
