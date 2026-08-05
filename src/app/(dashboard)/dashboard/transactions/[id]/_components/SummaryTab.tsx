'use client';

import Link from 'next/link';
import { ExternalLink, MapPin, MessageSquare, ShieldAlert, Star } from 'lucide-react';
import type { OrderDetailRow } from '@/types/admin';
import { formatDateTime, formatIDR } from '@/lib/format';
import { CANCELLED_BY_LABELS, DISPUTE_STATUS_LABELS } from '@/lib/enums';
import { Badge } from '@/components/ui/badge';
import { Field, FieldGrid } from '@/components/ui/field';
import { EntitySection } from '@/components/ui/entity-page';
import { MoneyRow } from './shared';

export function SummaryTab({ order }: { order: OrderDetailRow }) {
  const { cost, timestamps: ts } = order;

  // Komponen yang benar-benar menyusun `agreed_price`. Biaya tambahan yang
  // sudah dibayar TIDAK termasuk di dalamnya . itu ditagih terpisah . jadi
  // ditampilkan di blok sendiri agar penjumlahan di atas tetap konsisten.
  const sum =
    cost.total_service_price + cost.transport_fee + cost.admin_fee_customer - cost.discount_amount;
  const mismatch = sum !== cost.agreed_price;

  return (
    <div className="space-y-4">
      <EntitySection title="Pihak">
        <FieldGrid columns={3}>
          <Field
            label="Pelanggan"
            value={
              <Link
                href={`/dashboard/users/${order.customer.id}`}
                className="inline-flex items-center gap-1 underline underline-offset-4"
              >
                {order.customer.name}
                <ExternalLink className="size-3" />
              </Link>
            }
          />
          <Field label="Telepon pelanggan" value={order.customer.phone} />
          <Field label="Email pelanggan" value={order.customer.email} />
          <Field
            label="Mitra"
            value={
              <Link
                href={`/dashboard/partners/${order.partner.partner_id}`}
                className="inline-flex items-center gap-1 underline underline-offset-4"
              >
                {order.partner.name}
                <ExternalLink className="size-3" />
              </Link>
            }
          />
          <Field label="Telepon mitra" value={order.partner.phone} />
          <Field
            label="Jenis mitra"
            value={
              order.partner.partner_type === 'vendor' ? (
                // Nama badan usaha berbeda dari nama akun; keduanya perlu
                // terlihat saat admin mencocokkan rekening atau dokumen.
                <span>
                  Badan usaha
                  {order.partner.legal_name && order.partner.legal_name !== order.partner.name && (
                    <span className="block text-xs text-muted-foreground">
                      {order.partner.legal_name}
                    </span>
                  )}
                </span>
              ) : (
                'Perorangan'
              )
            }
          />
        </FieldGrid>
      </EntitySection>

      <EntitySection title="Waktu">
        <FieldGrid columns={3}>
          <Field label="Dibuat" value={formatDateTime(ts.created_at)} />
          <Field label="Jadwal kerja" value={formatDateTime(ts.scheduled_at)} />
          <Field label="Dikonfirmasi mitra" value={ts.confirmed_at && formatDateTime(ts.confirmed_at)} />
          <Field label="Dibayar" value={ts.paid_at && formatDateTime(ts.paid_at)} />
          <Field label="Mulai dikerjakan" value={ts.started_at && formatDateTime(ts.started_at)} />
          <Field label="Selesai" value={ts.completed_at && formatDateTime(ts.completed_at)} />
          <Field label="Disengketakan" value={ts.disputed_at && formatDateTime(ts.disputed_at)} />
          <Field
            label="Tenggat ulasan"
            value={ts.review_deadline_at && formatDateTime(ts.review_deadline_at)}
          />
          <Field label="Terakhir diubah" value={formatDateTime(ts.updated_at)} />
        </FieldGrid>
      </EntitySection>

      <EntitySection title="Lokasi">
        <p className="text-sm">{order.address}</p>
        {order.address_detail && (
          <p className="mt-1 text-sm text-muted-foreground">{order.address_detail}</p>
        )}
        {order.notes && (
          <p className="mt-2 text-sm text-muted-foreground">Catatan pelanggan: {order.notes}</p>
        )}
        {(order.latitude !== 0 || order.longitude !== 0) && (
          <a
            href={`https://www.google.com/maps?q=${order.latitude},${order.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-sm underline underline-offset-4"
          >
            <MapPin className="size-3.5" />
            Lihat di peta ({order.latitude.toFixed(5)}, {order.longitude.toFixed(5)})
          </a>
        )}
        {order.photo_urls.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Foto dari pelanggan ({order.photo_urls.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {order.photo_urls.map((url) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                  {/* next/image dilewati dengan sengaja: host foto pengguna
                      tidak terdaftar di next.config, dan panel ini hanya
                      dipakai lokal oleh admin. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt="Foto pesanan dari pelanggan"
                    className="size-20 rounded-lg border border-border object-cover"
                  />
                </a>
              ))}
            </div>
          </div>
        )}
      </EntitySection>

      <EntitySection
        title="Rincian biaya"
        description="Seluruh komponen ditampilkan agar penjumlahannya bisa dicocokkan, termasuk komisi platform dan bagian mitra."
      >
        <div className="text-sm">
          <MoneyRow label="Harga layanan" value={formatIDR(cost.total_service_price)} />
          <MoneyRow label="Biaya transport" value={formatIDR(cost.transport_fee)} />
          <MoneyRow label="Biaya admin" value={formatIDR(cost.admin_fee_customer)} />
          {cost.discount_amount > 0 && (
            <MoneyRow
              label="Diskon"
              value={`- ${formatIDR(cost.discount_amount)}`}
              hint={order.promo_code ?? undefined}
            />
          )}
          <div className="mt-2 border-t border-border pt-2">
            <MoneyRow label="Total disepakati" value={formatIDR(cost.agreed_price)} bold />
          </div>

          {mismatch && (
            // Bukan sekadar hiasan: selisih di sini berarti order diubah di luar
            // alur normal, dan itu harus terlihat alih-alih diam-diam dibulatkan.
            <p className="mt-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
              Penjumlahan komponen ({formatIDR(sum)}) tidak sama dengan total disepakati (
              {formatIDR(cost.agreed_price)}). Periksa riwayat perubahan pesanan.
            </p>
          )}

          {(cost.additional_material_fee > 0 || cost.additional_service_fee > 0) && (
            <div className="mt-3 border-t border-border pt-2">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Biaya tambahan (ditagih terpisah, di luar total di atas)
              </p>
              <MoneyRow label="Material" value={formatIDR(cost.additional_material_fee)} />
              <MoneyRow label="Jasa" value={formatIDR(cost.additional_service_fee)} />
            </div>
          )}

          <div className="mt-3 border-t border-border pt-2">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Pembagian</p>
            <MoneyRow
              label="Komisi platform"
              value={cost.platform_fee === null ? 'belum dihitung' : formatIDR(cost.platform_fee)}
            />
            <MoneyRow
              label="Bagian mitra"
              value={cost.partner_amount === null ? 'belum dihitung' : formatIDR(cost.partner_amount)}
            />
            {cost.refunded_amount !== null && cost.refunded_amount > 0 && (
              <MoneyRow label="Sudah direfund" value={formatIDR(cost.refunded_amount)} />
            )}
            {cost.partner_compensation !== null && cost.partner_compensation > 0 && (
              <MoneyRow label="Kompensasi mitra" value={formatIDR(cost.partner_compensation)} />
            )}
          </div>
        </div>
      </EntitySection>

      {order.cancellation_reason && (
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Dibatalkan
          {order.cancelled_by &&
            ` oleh ${CANCELLED_BY_LABELS[order.cancelled_by] ?? order.cancelled_by}`}
          : {order.cancellation_reason}
        </div>
      )}

      <RelatedSection order={order} />
    </div>
  );
}

/**
 * Tautan silang ke modul lain. Sebelumnya tidak ada sama sekali . admin yang
 * menangani sebuah order harus menebak nomor sengketanya lalu mencarinya
 * manual di halaman Sengketa.
 */
function RelatedSection({ order }: { order: OrderDetailRow }) {
  const rel = order.relations;
  const nothing = !rel.dispute_id && !rel.review_id && !rel.chat_room_id;

  return (
    <EntitySection title="Terkait">
      {nothing ? (
        <p className="text-sm text-muted-foreground">
          Belum ada sengketa, ulasan, maupun percakapan untuk pesanan ini.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {rel.dispute_id && (
            <Link
              href={`/dashboard/disputes/${rel.dispute_id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:border-foreground/30"
            >
              <ShieldAlert className="size-4 text-destructive" />
              Sengketa
              {rel.dispute_status && (
                <Badge variant="warning">
                  {DISPUTE_STATUS_LABELS[rel.dispute_status] ?? rel.dispute_status}
                </Badge>
              )}
            </Link>
          )}
          {rel.review_id && (
            <Link
              href={`/dashboard/reviews?review=${rel.review_id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:border-foreground/30"
            >
              <Star className="size-4 text-warning" />
              Ulasan
              {rel.review_rating !== null && <span className="tabular-nums">{rel.review_rating}/5</span>}
            </Link>
          )}
          {rel.chat_room_id && (
            <Link
              href={`/dashboard/chat?room=${rel.chat_room_id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:border-foreground/30"
            >
              <MessageSquare className="size-4" />
              Percakapan pelanggan ↔ mitra
            </Link>
          )}
        </div>
      )}
    </EntitySection>
  );
}
