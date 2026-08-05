'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, CalendarClock, Coins, GitBranch } from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type { OrderDetailRow } from '@/types/admin';
import { formatIDR } from '@/lib/format';
import { toast } from '@/lib/store/toastStore';
import { ORDER_STATUS_LABELS, ORDER_STATUS_OPTIONS } from '@/lib/enums';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EntitySection } from '@/components/ui/entity-page';
import { MoneyRow } from './shared';

/**
 * Status PRA-PAYOUT (mitra belum dibayar) yang aman di-force-cancel + refund.
 * Daftar ini harus sama dengan allowlist di backend AdminForceCancelOrder.
 */
const FORCE_CANCELLABLE = new Set([
  'WAITING_PAYMENT',
  'WAITING_CONFIRMATION',
  'PAID',
  'IN_PROGRESS',
  'WAITING_ADDITIONAL_PAY',
  'WAITING_CUSTOMER_CONFIRM',
]);

/** Status final . jadwal tidak lagi bisa diubah (lihat UpdateOrderSchedule). */
const FINAL_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

export function AdminControlTab({ order }: { order: OrderDetailRow }) {
  return (
    <div className="space-y-4">
      <ForceCancelSection order={order} />
      <ChangeStatusSection order={order} />
      <AdjustSettlementSection order={order} />
      <RescheduleSection order={order} />
    </div>
  );
}

/**
 * Hook bersama: semua aksi kontrol menyegarkan data yang sama.
 *
 * Query keuangan ikut di-invalidate karena setiap aksi di tab ini bisa
 * menggerakkan saldo . layar Keuangan yang menampilkan angka pra-aksi lebih
 * menyesatkan daripada tidak menampilkan apa pun.
 */
function useOrderMutation(orderId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['orders'] });
    qc.invalidateQueries({ queryKey: ['orders-summary'] });
    qc.invalidateQueries({ queryKey: ['order-detail', orderId] });
    qc.invalidateQueries({ queryKey: ['order-status-history', orderId] });
    qc.invalidateQueries({ queryKey: ['financial-summary'] });
    qc.invalidateQueries({ queryKey: ['financial-transactions'] });
  };
}

/** Membaca input rupiah opsional. String kosong = 0, bukan NaN. */
function parseAmount(raw: string): number {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// ── 1. Batalkan paksa & refund ──────────────────────────────────────

function ForceCancelSection({ order }: { order: OrderDetailRow }) {
  const invalidate = useOrderMutation(order.id);
  const [refundOverride, setRefundOverride] = useState('');
  const [compensation, setCompensation] = useState('');
  const [confirming, setConfirming] = useState(false);

  const cancel = useMutation({
    mutationFn: async (reason: string) => {
      const body: {
        reason: string;
        refund_amount?: number;
        partner_compensation?: number;
      } = { reason };
      if (refundOverride.trim() !== '') {
        const n = Number.parseInt(refundOverride, 10);
        if (Number.isNaN(n) || n < 0) throw new Error('Nominal refund tidak valid');
        body.refund_amount = n;
      }
      const comp = parseAmount(compensation);
      if (comp > 0) body.partner_compensation = comp;

      const res = await fetchAPI(`/admin/orders/${order.id}/force-cancel`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Pesanan dibatalkan & dana disesuaikan');
      setConfirming(false);
      setRefundOverride('');
      setCompensation('');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Kenapa aksi tidak tersedia . sebelumnya panel ini sekadar menghilang tanpa
  // penjelasan, sehingga admin tak tahu harus lewat jalur mana.
  if (!FORCE_CANCELLABLE.has(order.status)) {
    return (
      <EntitySection title="Pembatalan paksa tidak tersedia">
        <p className="text-sm text-muted-foreground">
          {order.status === 'COMPLETED' ? (
            <>
              Pesanan sudah <strong>selesai</strong> dan mitra sudah dibayar. Membatalkan lewat
              jalur ini akan membuat pembayaran ganda. Gunakan{' '}
              <strong>Penyesuaian dana</strong> di bawah . satu transaksi atomik yang bisa
              me-refund pelanggan sekaligus memotong saldo mitra.
            </>
          ) : order.status === 'DISPUTED' ? (
            <>
              Pesanan sedang <strong>disengketakan</strong>. Selesaikan lewat menu{' '}
              <Link
                href={
                  order.relations.dispute_id
                    ? `/dashboard/disputes/${order.relations.dispute_id}`
                    : '/dashboard/disputes'
                }
                className="underline underline-offset-4"
              >
                Sengketa
              </Link>
              , yang menangani refund + payout secara aman dalam satu transaksi.
            </>
          ) : (
            <>
              Status <strong>{ORDER_STATUS_LABELS[order.status] || order.status}</strong> bersifat
              final . tidak ada dana yang perlu dikembalikan lewat jalur ini.
            </>
          )}
        </p>
      </EntitySection>
    );
  }

  const comp = parseAmount(compensation);

  return (
    <>
      <EntitySection
        title="Batalkan paksa & refund"
        description="Hanya untuk pesanan pra-payout (mitra belum dibayar), sehingga tidak mungkin terjadi pembayaran ganda."
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <MoneyRow label="Total disepakati" value={formatIDR(order.cost.agreed_price)} bold />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="refund-amount">Nominal refund pelanggan</Label>
              <Input
                id="refund-amount"
                type="number"
                min="0"
                placeholder={`Kosongkan untuk penuh (${formatIDR(order.cost.agreed_price)})`}
                value={refundOverride}
                onChange={(e) => setRefundOverride(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Backend membatasi ke maksimum dana yang benar-benar terkumpul dari pelanggan.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="partner-compensation">Kompensasi mitra (opsional)</Label>
              <Input
                id="partner-compensation"
                type="number"
                min="0"
                placeholder="0 . tidak ada kompensasi"
                value={compensation}
                onChange={(e) => setCompensation(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Isi bila pembatalan bukan kesalahan mitra (mis. mitra sudah berangkat). Dibayarkan
                dalam transaksi yang sama dengan refund.
              </p>
            </div>
          </div>

          <Button variant="destructive" onClick={() => setConfirming(true)}>
            <Ban className="size-4" />
            Batalkan & Refund
          </Button>
        </div>
      </EntitySection>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={(reason) => cancel.mutate(reason)}
        variant="danger"
        title="Batalkan pesanan & kembalikan dana?"
        description={
          <>
            Saldo pelanggan bertambah{' '}
            <strong className="text-foreground">
              {refundOverride.trim() === ''
                ? `penuh (maks. ${formatIDR(order.cost.agreed_price)})`
                : formatIDR(Number(refundOverride) || 0)}
            </strong>
            . Mitra{' '}
            {comp > 0 ? (
              <>
                menerima kompensasi{' '}
                <strong className="text-foreground">{formatIDR(comp)}</strong>
              </>
            ) : (
              <strong className="text-foreground">tidak</strong>
            )}
            {comp > 0 ? '.' : ' menerima kompensasi.'} Tindakan ini tidak bisa dibatalkan.
          </>
        }
        confirmLabel="Batalkan & Refund"
        requireReason
        reasonLabel="Alasan pembatalan"
        confirmPhrase={order.order_number}
        loading={cancel.isPending}
      />
    </>
  );
}

// ── 2. Ubah status paksa ────────────────────────────────────────────

function ChangeStatusSection({ order }: { order: OrderDetailRow }) {
  const invalidate = useOrderMutation(order.id);
  const [target, setTarget] = useState('');
  const [confirming, setConfirming] = useState(false);

  const change = useMutation({
    mutationFn: async (reason: string) => {
      const res = await fetchAPI(`/admin/orders/${order.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: target, reason, version: order.version }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Status pesanan diperbarui');
      setConfirming(false);
      setTarget('');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (order.status === 'CANCELLED') {
    return (
      <EntitySection title="Ubah status tidak tersedia">
        <p className="text-sm text-muted-foreground">
          Pesanan yang sudah dibatalkan tidak bisa dihidupkan kembali. Buat pesanan baru bila
          pekerjaannya tetap dilanjutkan.
        </p>
      </EntitySection>
    );
  }

  // CANCELLED tidak ditawarkan: pembatalan HARUS lewat jalur force-cancel agar
  // refund dan alasan pembatalan ikut tercatat. Backend juga menolaknya.
  const options = ORDER_STATUS_OPTIONS.filter(
    (o) => o.value && o.value !== 'CANCELLED' && o.value !== order.status,
  );

  return (
    <>
      <EntitySection
        title="Ubah status paksa"
        description="Untuk membebaskan pesanan yang macet . mis. pelanggan tidak pernah menekan konfirmasi selesai."
      >
        <div className="space-y-3">
          <div className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
            Aksi ini <strong>tidak menggerakkan uang sama sekali</strong>: tidak ada refund, payout,
            maupun kompensasi. Memindahkan ke Selesai juga <strong>tidak</strong> mencairkan dana ke
            mitra. Gunakan Penyesuaian dana di bawah untuk sisi uangnya.
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="target-status">Status tujuan</Label>
            <div className="max-w-sm">
              <Select
                id="target-status"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">Pilih status…</option>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Button variant="outline" onClick={() => setConfirming(true)} disabled={!target}>
            <GitBranch className="size-4" />
            Ubah status
          </Button>
        </div>
      </EntitySection>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={(reason) => change.mutate(reason)}
        variant="danger"
        title="Ubah status pesanan?"
        description={
          <>
            Status berubah dari{' '}
            <strong className="text-foreground">
              {ORDER_STATUS_LABELS[order.status] || order.status}
            </strong>{' '}
            menjadi{' '}
            <strong className="text-foreground">{ORDER_STATUS_LABELS[target] || target}</strong>.
            Pelanggan dan mitra akan menerima notifikasi. Tidak ada dana yang berpindah.
          </>
        }
        confirmLabel="Ubah status"
        requireReason
        reasonLabel="Alasan perubahan"
        confirmPhrase={order.order_number}
        loading={change.isPending}
      />
    </>
  );
}

// ── 3. Penyesuaian dana pasca-fakta ─────────────────────────────────

function AdjustSettlementSection({ order }: { order: OrderDetailRow }) {
  const invalidate = useOrderMutation(order.id);
  const [refund, setRefund] = useState('');
  const [debit, setDebit] = useState('');
  const [compensate, setCompensate] = useState('');
  const [confirming, setConfirming] = useState(false);

  const refundN = parseAmount(refund);
  const debitN = parseAmount(debit);
  const compensateN = parseAmount(compensate);
  const nothing = refundN === 0 && debitN === 0 && compensateN === 0;
  const conflict = debitN > 0 && compensateN > 0;

  const adjust = useMutation({
    mutationFn: async (reason: string) => {
      const res = await fetchAPI(`/admin/orders/${order.id}/adjust`, {
        method: 'POST',
        body: JSON.stringify({
          refund_customer: refundN,
          debit_partner: debitN,
          compensate_partner: compensateN,
          reason,
        }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Penyesuaian dana tercatat');
      setConfirming(false);
      setRefund('');
      setDebit('');
      setCompensate('');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <EntitySection
        title="Penyesuaian dana"
        description="Menggerakkan saldo untuk pesanan ini dalam SATU transaksi. Status pesanan tidak berubah."
      >
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Ini pengganti dua kali &quot;Sesuaikan Saldo&quot; di halaman pengguna yang terpisah:
            di sini pelanggan dan mitra disesuaikan bersamaan, sehingga tidak mungkin berhasil
            separuh. Tercatat di audit log dan di aliran dana pesanan ini.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adj-refund">Refund ke pelanggan</Label>
              <Input
                id="adj-refund"
                type="number"
                min="0"
                placeholder="0"
                value={refund}
                onChange={(e) => setRefund(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adj-debit">Potong saldo mitra</Label>
              <Input
                id="adj-debit"
                type="number"
                min="0"
                placeholder="0"
                value={debit}
                onChange={(e) => setDebit(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adj-compensate">Kompensasi mitra</Label>
              <Input
                id="adj-compensate"
                type="number"
                min="0"
                placeholder="0"
                value={compensate}
                onChange={(e) => setCompensate(e.target.value)}
              />
            </div>
          </div>

          {conflict && (
            <p className="text-xs text-destructive">
              Potong dan kompensasi mitra saling meniadakan . isi salah satu saja.
            </p>
          )}
          {debitN > 0 && (
            <p className="text-xs text-muted-foreground">
              Pemotongan gagal bila saldo mitra tidak mencukupi . seluruh penyesuaian dibatalkan,
              bukan sebagian.
            </p>
          )}

          <Button variant="destructive" onClick={() => setConfirming(true)} disabled={nothing || conflict}>
            <Coins className="size-4" />
            Sesuaikan dana
          </Button>
        </div>
      </EntitySection>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={(reason) => adjust.mutate(reason)}
        variant="danger"
        title="Sesuaikan dana pesanan ini?"
        description={
          <ul className="list-inside list-disc space-y-0.5">
            {refundN > 0 && (
              <li>
                Saldo <strong className="text-foreground">{order.customer.name}</strong> bertambah{' '}
                {formatIDR(refundN)}
              </li>
            )}
            {debitN > 0 && (
              <li>
                Saldo <strong className="text-foreground">{order.partner.name}</strong> berkurang{' '}
                {formatIDR(debitN)}
              </li>
            )}
            {compensateN > 0 && (
              <li>
                Saldo <strong className="text-foreground">{order.partner.name}</strong> bertambah{' '}
                {formatIDR(compensateN)}
              </li>
            )}
          </ul>
        }
        confirmLabel="Sesuaikan dana"
        requireReason
        reasonLabel="Alasan penyesuaian"
        confirmPhrase={order.order_number}
        loading={adjust.isPending}
      />
    </>
  );
}

// ── 4. Ubah jadwal & alamat ─────────────────────────────────────────

/** Date → nilai untuk <input type="datetime-local"> dalam zona waktu lokal. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // toISOString() memakai UTC dan akan menggeser jam yang ditampilkan.
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function RescheduleSection({ order }: { order: OrderDetailRow }) {
  const invalidate = useOrderMutation(order.id);
  const [scheduledAt, setScheduledAt] = useState(() => toLocalInput(order.timestamps.scheduled_at));
  const [address, setAddress] = useState(order.address);
  const [addressDetail, setAddressDetail] = useState(order.address_detail ?? '');
  const [confirming, setConfirming] = useState(false);

  const save = useMutation({
    mutationFn: async (reason: string) => {
      const res = await fetchAPI(`/admin/orders/${order.id}/schedule`, {
        method: 'PUT',
        body: JSON.stringify({
          scheduled_at: new Date(scheduledAt).toISOString(),
          address: address.trim(),
          address_detail: addressDetail.trim() || null,
          notes: order.notes,
          reason,
        }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Jadwal pesanan diperbarui');
      setConfirming(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (FINAL_STATUSES.has(order.status)) {
    return (
      <EntitySection title="Ubah jadwal tidak tersedia">
        <p className="text-sm text-muted-foreground">
          Pesanan sudah final. Jadwalnya adalah catatan kapan pekerjaan benar-benar terjadi dan
          tidak boleh ditulis ulang.
        </p>
      </EntitySection>
    );
  }

  const dirty =
    scheduledAt !== toLocalInput(order.timestamps.scheduled_at) ||
    address.trim() !== order.address ||
    addressDetail.trim() !== (order.address_detail ?? '');

  return (
    <>
      <EntitySection
        title="Perbaiki jadwal & alamat"
        description="Untuk salah input atau kesepakatan ulang lewat telepon. Kedua pihak diberi notifikasi."
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sched-at">Jadwal kerja</Label>
              <Input
                id="sched-at"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sched-detail">Detail alamat</Label>
              <Input
                id="sched-detail"
                value={addressDetail}
                placeholder="Patokan, nomor unit, lantai…"
                onChange={(e) => setAddressDetail(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sched-address">Alamat</Label>
            <Input
              id="sched-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Koordinat peta <strong>tidak</strong> ikut berubah . perubahan besar sebaiknya lewat
              pesanan baru agar biaya transport terhitung ulang.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setConfirming(true)}
            disabled={!dirty || !scheduledAt || address.trim() === ''}
          >
            <CalendarClock className="size-4" />
            Simpan perubahan
          </Button>
        </div>
      </EntitySection>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={(reason) => save.mutate(reason)}
        title="Perbarui jadwal pesanan?"
        description="Pelanggan dan mitra akan menerima notifikasi berisi alasan yang Anda tulis."
        confirmLabel="Simpan"
        requireReason
        reasonLabel="Alasan perubahan"
        loading={save.isPending}
      />
    </>
  );
}
