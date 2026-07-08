'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote } from 'lucide-react';
import { fetchAPI, qs } from '@/lib/api';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type { WithdrawalRow } from '@/types/admin';
import { nstr } from '@/lib/sql';
import { formatDateTime, formatIDR } from '@/lib/format';
import { toast } from '@/lib/store/toastStore';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { CenteredSpinner, EmptyState } from '@/components/ui/feedback';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

const PER_PAGE = 20;

export default function WithdrawalsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<WithdrawalRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['withdrawals', page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<WithdrawalRow>>(
        `/admin/withdrawals/pending${qs({ page, per_page: PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const process = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchAPI(`/admin/withdrawals/${id}/process`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'approve' }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Penarikan diproses');
      setSelected(null);
      qc.invalidateQueries({ queryKey: ['withdrawals'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Withdrawal</h1>
        <p className="text-sm text-muted-foreground">Penarikan dana yang menunggu diproses</p>
      </div>

      {isLoading ? (
        <CenteredSpinner />
      ) : rows.length === 0 ? (
        <EmptyState title="Tidak ada penarikan pending" />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pengguna</TableHead>
                <TableHead>Rekening</TableHead>
                <TableHead>Nominal</TableHead>
                <TableHead>Biaya</TableHead>
                <TableHead>Transfer</TableHead>
                <TableHead>Diajukan</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">{w.user_name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {nstr(w.bank_code) || '-'} · {nstr(w.bank_account_number) || '-'}
                  </TableCell>
                  <TableCell>{formatIDR(w.amount)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatIDR(w.admin_fee)}</TableCell>
                  <TableCell className="font-medium">
                    {formatIDR(w.amount - w.admin_fee)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(w.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setSelected(w)}>
                      Proses
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />
        </>
      )}

      {selected && (
        <Modal open onClose={() => setSelected(null)} title="Proses Penarikan">
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <Banknote className="size-5" />
              </div>
              <div>
                <p className="font-medium">{selected.user_name}</p>
                <p className="text-sm text-muted-foreground">
                  {nstr(selected.bank_code)} · {nstr(selected.bank_account_number)} ·{' '}
                  {nstr(selected.bank_account_name)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Nominal</p>
                <p className="font-medium">{formatIDR(selected.amount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Biaya</p>
                <p className="font-medium">{formatIDR(selected.admin_fee)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total transfer</p>
                <p className="font-medium">{formatIDR(selected.amount - selected.admin_fee)}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Pastikan transfer ke rekening tujuan sudah/akan dilakukan sebelum menandai selesai.
            </p>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="ghost" onClick={() => setSelected(null)}>
                Batal
              </Button>
              <Button
                disabled={process.isPending}
                onClick={() => process.mutate(selected.id)}
              >
                Tandai Selesai
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
