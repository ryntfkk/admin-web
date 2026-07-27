'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type { DisputeDetailRow } from '@/types/admin';
import { nenum, nint, nstr, ntime } from '@/lib/sql';
import { formatDateTime, formatIDR } from '@/lib/format';
import { toast } from '@/lib/store/toastStore';
import {
  DISPUTE_STATUS_LABELS,
  DISPUTE_TYPE_LABELS,
  ORDER_STATUS_LABELS,
  RESOLUTION_TYPE_OPTIONS,
  disputeStatusVariant,
  orderStatusVariant,
} from '@/lib/enums';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldGrid } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EntityPage, EntitySection, type EntityTab } from '@/components/ui/entity-page';
import ThreadPanel, { CANNED_REPLIES, type ThreadMessage } from '@/components/common/ThreadPanel';

interface DisputeMessage {
  id: string;
  sender_role: 'customer' | 'partner' | 'admin';
  sender_name: string;
  content: string;
  message_type: string;
  created_at: string;
}

const ROLE_LABEL: Record<string, string> = {
  customer: 'Pelanggan',
  partner: 'Mitra',
  admin: 'Admin CS',
};

export default function DisputeDetailPage() {
  const { id: disputeId } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dispute-detail', disputeId],
    queryFn: async () => {
      const res = await fetchAPI<DisputeDetailRow>(`/admin/disputes/${disputeId}`);
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const assign = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI(`/admin/disputes/${disputeId}/assign`, { method: 'PUT' });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Sengketa diambil untuk ditinjau');
      refetch();
      qc.invalidateQueries({ queryKey: ['disputes'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = data?.status;

  const tabs: EntityTab[] = data
    ? [
        { id: 'ringkasan', label: 'Ringkasan', content: <SummaryTab dispute={data} /> },
        { id: 'ruang', label: 'Ruang Sengketa', content: <DisputeThread disputeId={disputeId} /> },
        {
          id: 'resolusi',
          label: 'Resolusi',
          content: (
            <ResolutionTab
              dispute={data}
              disputeId={disputeId}
              onResolved={() => {
                refetch();
                qc.invalidateQueries({ queryKey: ['disputes'] });
                qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
              }}
            />
          ),
        },
      ]
    : [];

  return (
    <EntityPage
      backHref="/dashboard/disputes"
      backLabel="Semua sengketa"
      isLoading={isLoading}
      error={error}
      title={data ? `Sengketa ${data.order_number}` : '—'}
      subtitle={
        data && (
          <span>
            {data.customer_name} vs {data.partner_name} ·{' '}
            {DISPUTE_TYPE_LABELS[data.dispute_type] || data.dispute_type}
          </span>
        )
      }
      badges={
        data && (
          <>
            <Badge variant={disputeStatusVariant(data.status)}>
              {DISPUTE_STATUS_LABELS[data.status] || data.status}
            </Badge>
            <Badge variant={orderStatusVariant(data.order_status)}>
              Order: {ORDER_STATUS_LABELS[data.order_status] || data.order_status || '-'}
            </Badge>
          </>
        )
      }
      actions={
        status === 'OPEN' && (
          <Button onClick={() => assign.mutate()} disabled={assign.isPending}>
            Ambil &amp; Tinjau
          </Button>
        )
      }
      tabs={tabs}
    />
  );
}

function SummaryTab({ dispute }: { dispute: DisputeDetailRow }) {
  const totalCollected =
    typeof dispute.total_collected === 'number' ? dispute.total_collected : null;

  return (
    <div className="space-y-4">
      <EntitySection title="Pesanan yang disengketakan">
        <FieldGrid columns={3}>
          <Field
            label="Order"
            value={
              <Link
                href={`/dashboard/transactions/${dispute.order_id}`}
                className="font-mono underline underline-offset-4"
              >
                {dispute.order_number}
              </Link>
            }
          />
          <Field label="Nominal order" value={formatIDR(dispute.order_amount)} />
          <Field
            label="Dana terkumpul"
            value={totalCollected !== null ? formatIDR(totalCollected) : null}
          />
          <Field label="Pelanggan" value={dispute.customer_name} />
          <Field
            label="Mitra"
            value={
              <Link
                href={`/dashboard/partners/${dispute.partner_id}`}
                className="underline underline-offset-4"
              >
                {dispute.partner_name}
              </Link>
            }
          />
          <Field
            label="Tipe sengketa"
            value={DISPUTE_TYPE_LABELS[dispute.dispute_type] || dispute.dispute_type}
          />
        </FieldGrid>
        <p className="mt-3 text-xs text-muted-foreground">
          &ldquo;Dana terkumpul&rdquo; adalah plafon gabungan refund + payout — backend menolak
          resolusi yang melebihinya.
        </p>
      </EntitySection>

      {nstr(dispute.response_content) && (
        <EntitySection title="Tanggapan terlapor">
          <p className="text-sm whitespace-pre-wrap">{nstr(dispute.response_content)}</p>
          {ntime(dispute.responded_at) && (
            <p className="mt-1 text-xs text-muted-foreground">
              Ditanggapi {formatDateTime(ntime(dispute.responded_at))}
            </p>
          )}
        </EntitySection>
      )}

      {dispute.evidence_urls && dispute.evidence_urls.length > 0 && (
        <EntitySection title="Bukti pelapor">
          <div className="flex flex-wrap gap-2">
            {dispute.evidence_urls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="overflow-hidden rounded-lg border border-border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Bukti ${i + 1}`} className="size-24 object-cover" />
              </a>
            ))}
          </div>
        </EntitySection>
      )}
    </div>
  );
}

function DisputeThread({ disputeId }: { disputeId: string }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['dispute-messages', disputeId],
    refetchInterval: 5000,
    queryFn: async () => {
      const res = await fetchAPI<DisputeMessage[]>(`/admin/disputes/${disputeId}/messages`);
      if (!res.success) throw new Error(getErrorMessage(res));
      return res.data ?? [];
    },
  });

  const send = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetchAPI(`/admin/disputes/${disputeId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, message_type: 'text' }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dispute-messages', disputeId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const messages: ThreadMessage[] | undefined = data?.map((m) => ({
    id: m.id,
    fromAdmin: m.sender_role === 'admin',
    authorLabel: ROLE_LABEL[m.sender_role] || m.sender_name,
    content: m.content,
    createdAt: m.created_at,
  }));

  return (
    <ThreadPanel
      title="Ruang Sengketa (Pelanggan + Mitra + Admin)"
      messages={messages}
      isLoading={isLoading}
      onSend={(content) => send.mutate(content)}
      isSending={send.isPending}
      cannedReplies={CANNED_REPLIES}
      emptyNote="Belum ada pesan di ruang sengketa."
    />
  );
}

function ResolutionTab({
  dispute,
  disputeId,
  onResolved,
}: {
  dispute: DisputeDetailRow;
  disputeId: string;
  onResolved: () => void;
}) {
  const [resolutionType, setResolutionType] = useState('FULL_REFUND');
  const [refundAmount, setRefundAmount] = useState('');
  const [partnerPayout, setPartnerPayout] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [confirming, setConfirming] = useState(false);

  const showRefund = resolutionType === 'FULL_REFUND' || resolutionType === 'PARTIAL_REFUND';
  const showPayout = resolutionType === 'PAY_PARTNER' || resolutionType === 'PARTIAL_REFUND';

  const totalCollected =
    typeof dispute.total_collected === 'number' ? dispute.total_collected : null;
  // Resolusi hanya sah selama order masih DISPUTED — mencerminkan guard backend.
  const orderNotDisputed =
    typeof dispute.order_status === 'string' &&
    dispute.order_status !== '' &&
    dispute.order_status !== 'DISPUTED';

  const refundNum = showRefund ? Number(refundAmount) || 0 : 0;
  const payoutNum = showPayout ? Number(partnerPayout) || 0 : 0;
  const amountError =
    refundNum < 0 || payoutNum < 0
      ? 'Nominal tidak boleh negatif.'
      : totalCollected !== null && refundNum + payoutNum > totalCollected
        ? `Refund + payout (${formatIDR(refundNum + payoutNum)}) melebihi total dana terkumpul (${formatIDR(totalCollected)}).`
        : null;

  const resolve = useMutation({
    mutationFn: async () => {
      // Kirim nilai ter-GATE sesuai resolution_type: field yang tersembunyi di UI
      // HARUS terkirim 0. Tanpa ini nominal basi (mis. refund yang sempat diisi
      // lalu jenisnya diubah ke PAY_PARTNER) ikut terkirim → refund tak sengaja
      // dicairkan, karena backend hanya membatasi plafon total, bukan maksud admin.
      const res = await fetchAPI(`/admin/disputes/${disputeId}/resolve`, {
        method: 'PUT',
        body: JSON.stringify({
          resolution_type: resolutionType,
          refund_amount: showRefund ? Number(refundAmount) || 0 : 0,
          partner_payout: showPayout ? Number(partnerPayout) || 0 : 0,
          admin_notes: adminNotes,
        }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Sengketa diselesaikan');
      setConfirming(false);
      onResolved();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setConfirming(false);
      // Konflik (order berubah status / sengketa diambil admin lain) — muat ulang
      // agar UI langsung menampilkan kondisi terbaru.
      onResolved();
    },
  });

  if (dispute.status === 'RESOLVED' || dispute.status === 'CLOSED') {
    return (
      <EntitySection title="Sengketa sudah diselesaikan">
        <FieldGrid columns={3}>
          <Field label="Jenis resolusi" value={nenum(dispute.resolution_type, 'ResolutionType')} />
          <Field label="Refund ke pelanggan" value={formatIDR(nint(dispute.refund_amount) || 0)} />
          <Field label="Dicairkan ke mitra" value={formatIDR(nint(dispute.partner_payout) || 0)} />
        </FieldGrid>
        {nstr(dispute.admin_resolution) && (
          <p className="mt-3 text-sm whitespace-pre-wrap">{nstr(dispute.admin_resolution)}</p>
        )}
      </EntitySection>
    );
  }

  if (dispute.status === 'OPEN') {
    return (
      <EntitySection title="Belum ditinjau">
        <p className="text-sm text-muted-foreground">
          Tekan <strong>Ambil &amp; Tinjau</strong> di atas untuk menandai sengketa ini sedang Anda
          tangani. Form resolusi terbuka setelah itu.
        </p>
      </EntitySection>
    );
  }

  if (orderNotDisputed) {
    return (
      <EntitySection title="Resolusi tidak tersedia">
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          Status order sudah berubah menjadi{' '}
          <strong>{ORDER_STATUS_LABELS[dispute.order_status] || dispute.order_status}</strong> (bukan
          Sengketa lagi), sehingga refund/payout dari tiket ini diblokir demi mencegah pembayaran
          ganda. Periksa riwayat order sebelum menindaklanjuti.
        </div>
      </EntitySection>
    );
  }

  return (
    <>
      <EntitySection
        title="Form resolusi"
        description="Refund + payout tidak boleh melebihi dana yang benar-benar terkumpul dari pelanggan."
      >
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="res-type">Jenis resolusi</Label>
            <Select
              id="res-type"
              value={resolutionType}
              onChange={(e) => setResolutionType(e.target.value)}
            >
              {RESOLUTION_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {showRefund && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="res-refund">Refund ke pelanggan (Rp)</Label>
                <Input
                  id="res-refund"
                  type="number"
                  min={0}
                  max={totalCollected ?? undefined}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder="0"
                />
                {totalCollected !== null && (
                  <p className="text-xs text-muted-foreground">Maks. {formatIDR(totalCollected)}</p>
                )}
              </div>
            )}
            {showPayout && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="res-payout">Cairkan ke mitra (Rp)</Label>
                <Input
                  id="res-payout"
                  type="number"
                  min={0}
                  max={totalCollected ?? undefined}
                  value={partnerPayout}
                  onChange={(e) => setPartnerPayout(e.target.value)}
                  placeholder="0"
                />
                {totalCollected !== null && (
                  <p className="text-xs text-muted-foreground">
                    Maks. {formatIDR(totalCollected)} (gabungan dengan refund)
                  </p>
                )}
              </div>
            )}
          </div>

          {amountError && <p className="text-sm font-medium text-destructive">{amountError}</p>}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="res-notes">Catatan admin (wajib)</Label>
            <Textarea
              id="res-notes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Catatan internal & dasar keputusan…"
            />
          </div>

          <div className="flex justify-end">
            <Button
              variant="destructive"
              disabled={!adminNotes.trim() || !!amountError}
              onClick={() => setConfirming(true)}
            >
              Tutup tiket &amp; selesaikan
            </Button>
          </div>
        </div>
      </EntitySection>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => resolve.mutate()}
        variant="danger"
        title="Selesaikan sengketa ini?"
        description={
          <>
            Uang berpindah seketika: pelanggan menerima{' '}
            <strong className="text-foreground">{formatIDR(refundNum)}</strong> dan mitra menerima{' '}
            <strong className="text-foreground">{formatIDR(payoutNum)}</strong>. Tiket ditutup dan
            keputusan ini tidak bisa dibatalkan lewat panel.
          </>
        }
        confirmLabel="Selesaikan"
        confirmPhrase={dispute.order_number}
        loading={resolve.isPending}
      />
    </>
  );
}
