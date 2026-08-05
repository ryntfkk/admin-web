'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote, AlertTriangle } from 'lucide-react';
import { fetchAPI, qs } from '@/lib/api';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type { WithdrawalRow } from '@/types/admin';
import { nstr } from '@/lib/sql';
import { formatDateTime, formatIDR } from '@/lib/format';
import { toast } from '@/lib/store/toastStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type Column } from '@/components/ui/data-table';

const PER_PAGE = 20;

// Sinyal risiko mismatch nama rekening vs legal_entity_name vendor.
// H3: Backend sekarang HARD BLOCK penyetujuan mismatch — UI ini memberi
// tahu admin SEBELUM klik approve supaya tidak terkejut oleh error.
function vendorBankNameMismatch(w: WithdrawalRow): boolean {
  if (!w.partner_type?.valid || w.partner_type.partner_type !== 'vendor') return false;
  const legal = nstr(w.partner_legal_name);
  const acct = nstr(w.bank_account_name);
  if (!legal || !acct) return false;
  return legal.trim().toUpperCase() !== acct.trim().toUpperCase();
}

export default function WithdrawalsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<WithdrawalRow | null>(null);
  const [confirming, setConfirming] = useState<'approve' | 'reject' | null>(null);
  // reference_id = bukti transfer (WAJIB backend utk approve); notes = alasan tolak.
  const [refId, setRefId] = useState('');
  const [notes, setNotes] = useState('');

  const openProcess = (w: WithdrawalRow) => {
    setRefId('');
    setNotes('');
    setSelected(w);
  };
  const closeProcess = () => {
    setSelected(null);
    setConfirming(null);
  };

  const { data, isLoading, error } = useQuery({
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
    mutationFn: async ({
      id,
      action,
      reference_id,
      notes: rejectNotes,
    }: {
      id: string;
      action: string;
      reference_id?: string;
      notes?: string;
    }) => {
      const res = await fetchAPI(`/admin/withdrawals/${id}/process`, {
        method: 'PUT',
        body: JSON.stringify({ action, reference_id, notes: rejectNotes }),
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

  const columns: Column<WithdrawalRow>[] = [
    {
      key: 'user',
      header: 'Penerima',
      // Untuk mitra badan usaha, user_name adalah nama PIC — bukan penerima
      // dananya. Nama badan hukum ditampilkan di depan supaya admin tidak
      // menyetujui transfer ke rekening perusahaan sambil membaca nama orang.
      cell: (w) => {
        const legal = nstr(w.partner_legal_name);
        const isEntity = !!legal && legal !== w.user_name;
        const mismatch = vendorBankNameMismatch(w);
        return (
          <div className="flex flex-col">
            <span className="font-medium">{isEntity ? legal : w.user_name}</span>
            {isEntity && (
              <span className="text-xs text-muted-foreground">PIC: {w.user_name}</span>
            )}
            {mismatch && (
              <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-destructive">
                <AlertTriangle className="size-3" /> Nama rekening ≠ badan usaha
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'bank',
      header: 'Rekening',
      cell: (w) => (
        <span className="text-muted-foreground">
          {nstr(w.bank_code) || '-'} · {nstr(w.bank_account_number) || '-'}
        </span>
      ),
      hideBelow: 'md',
    },
    {
      key: 'amount',
      header: 'Nominal',
      align: 'right',
      cell: (w) => <span className="tabular-nums">{formatIDR(w.amount)}</span>,
    },
    {
      key: 'fee',
      header: 'Biaya',
      align: 'right',
      cell: (w) => <span className="tabular-nums text-muted-foreground">{formatIDR(w.admin_fee)}</span>,
      hideBelow: 'sm',
    },
    {
      key: 'net',
      header: 'Transfer',
      align: 'right',
      cell: (w) => <span className="font-medium tabular-nums">{formatIDR(w.amount - w.admin_fee)}</span>,
    },
    {
      key: 'created',
      header: 'Diajukan',
      cell: (w) => (
        <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(w.created_at)}</span>
      ),
      hideBelow: 'lg',
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Withdrawal</h1>
        <p className="text-sm text-muted-foreground">
          Penarikan dana yang menunggu diproses — klik baris untuk memverifikasi rekening dan
          menandai transfer selesai.
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={data?.data}
        getRowId={(w) => w.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="Tidak ada penarikan pending"
        emptyNote="Semua permintaan penarikan sudah diproses."
        onRowClick={openProcess}
        page={page}
        perPage={PER_PAGE}
        total={data?.pagination?.total ?? 0}
        onPageChange={setPage}
      />

      {selected && (
        <Modal open onClose={closeProcess} title="Proses Penarikan">
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-success/10 text-success">
                <Banknote className="size-5" />
              </div>
              <div>
                <p className="font-medium">
                  {nstr(selected.partner_legal_name) &&
                  nstr(selected.partner_legal_name) !== selected.user_name
                    ? nstr(selected.partner_legal_name)
                    : selected.user_name}
                </p>
                {nstr(selected.partner_legal_name) &&
                  nstr(selected.partner_legal_name) !== selected.user_name && (
                    <p className="text-xs text-muted-foreground">
                      Badan usaha · PIC: {selected.user_name}
                    </p>
                  )}
                <p className="text-sm text-muted-foreground">
                  {nstr(selected.bank_code)} · {nstr(selected.bank_account_number)} ·{' '}
                  {nstr(selected.bank_account_name)}
                </p>
              </div>
            </div>
            {vendorBankNameMismatch(selected) && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">
                    Nama rekening tidak cocok dengan badan usaha
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    Rekening atas nama <strong>{nstr(selected.bank_account_name)}</strong>,
                    badan usaha <strong>{nstr(selected.partner_legal_name)}</strong>. Penyetujuan
                    akan ditolak otomatis oleh sistem (H3) — tolak penarikan ini atau minta mitra
                    memperbarui rekening via OTP.
                  </p>
                </div>
              </div>
            )}
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
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  No. Referensi / Bukti Transfer <span className="text-destructive">*</span>
                </label>
                <Input
                  value={refId}
                  onChange={(e) => setRefId(e.target.value)}
                  placeholder="mis. ID transaksi bank / e-wallet"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Wajib diisi untuk menandai selesai (bukti transfer sudah dilakukan).
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Alasan penolakan (bila menolak)
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Alasan penolakan — tercatat & saldo dikembalikan ke pengguna"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="ghost" onClick={closeProcess}>
                Batal
              </Button>
              <Button
                variant="destructive"
                disabled={process.isPending}
                onClick={() => {
                  if (!notes.trim()) {
                    toast.error('Isi alasan penolakan terlebih dahulu.');
                    return;
                  }
                  setConfirming('reject');
                }}
              >
                Tolak
              </Button>
              <Button
                disabled={process.isPending || !refId.trim()}
                onClick={() => setConfirming('approve')}
              >
                Tandai Selesai
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Menandai penarikan selesai berarti uang SUDAH ditransfer di luar sistem
          dan tidak bisa ditarik kembali — karena itu butuh ketik-ulang, bukan
          sekadar window.confirm() yang mudah ditekan tanpa dibaca. */}
      <ConfirmDialog
        open={confirming === 'approve'}
        onClose={() => setConfirming(null)}
        onConfirm={() => selected && process.mutate({ id: selected.id, action: 'approve', reference_id: refId })}
        variant="danger"
        title="Tandai penarikan selesai?"
        description={
          selected && (
            <>
              Menyatakan transfer{' '}
              <strong className="text-foreground">
                {formatIDR(selected.amount - selected.admin_fee)}
              </strong>{' '}
              ke <strong className="text-foreground">{selected.user_name}</strong> sudah dilakukan.
              Pastikan bukti transfer benar — aksi ini tidak dapat dibatalkan.
            </>
          )
        }
        confirmLabel="Tandai selesai"
        confirmPhrase={selected?.user_name}
        loading={process.isPending}
      />

      <ConfirmDialog
        open={confirming === 'reject'}
        onClose={() => setConfirming(null)}
        onConfirm={() => selected && process.mutate({ id: selected.id, action: 'reject', notes })}
        variant="danger"
        title="Tolak permintaan penarikan?"
        description="Saldo dikembalikan ke dompet pengguna dan alasan penolakan dikirim ke mereka."
        confirmLabel="Tolak penarikan"
        loading={process.isPending}
      />
    </div>
  );
}
