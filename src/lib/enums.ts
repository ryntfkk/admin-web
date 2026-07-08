// Enum label maps + badge variant helpers (values match DB enums).

export const DISPUTE_STATUS_OPTIONS = [
  { value: '', label: 'Semua status' },
  { value: 'OPEN', label: 'Terbuka' },
  { value: 'REVIEWING', label: 'Ditinjau' },
  { value: 'RESOLVED', label: 'Selesai' },
  { value: 'CLOSED', label: 'Ditutup' },
];

export const DISPUTE_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Terbuka',
  REVIEWING: 'Ditinjau',
  RESOLVED: 'Selesai',
  CLOSED: 'Ditutup',
};

export function disputeStatusVariant(status: string): 'warning' | 'info' | 'success' | 'neutral' {
  switch (status) {
    case 'OPEN':
      return 'warning';
    case 'REVIEWING':
      return 'info';
    case 'RESOLVED':
      return 'success';
    default:
      return 'neutral';
  }
}

export const DISPUTE_TYPE_LABELS: Record<string, string> = {
  NO_SHOW_PARTNER: 'Mitra tidak hadir',
  NO_SHOW_CUSTOMER: 'Pelanggan tidak hadir',
  QUALITY: 'Kualitas layanan',
  ADDITIONAL_FEE_DISPUTE: 'Sengketa biaya tambahan',
};

export const RESOLUTION_TYPE_OPTIONS = [
  { value: 'FULL_REFUND', label: 'Refund penuh ke pelanggan' },
  { value: 'PARTIAL_REFUND', label: 'Refund sebagian' },
  { value: 'PAY_PARTNER', label: 'Cairkan ke mitra (tolak komplain)' },
  { value: 'REWORK', label: 'Minta pengerjaan ulang' },
];

export const PROMO_DISCOUNT_OPTIONS = [
  { value: 'percentage', label: 'Persentase (%)' },
  { value: 'fixed', label: 'Nominal (Rp)' },
];

// ── Orders ──────────────────────────────────────────────────────────
export const ORDER_STATUS_OPTIONS = [
  { value: '', label: 'Semua status' },
  { value: 'WAITING_CONFIRMATION', label: 'Menunggu konfirmasi' },
  { value: 'WAITING_PAYMENT', label: 'Menunggu pembayaran' },
  { value: 'PAID', label: 'Dibayar' },
  { value: 'IN_PROGRESS', label: 'Dikerjakan' },
  { value: 'WAITING_ADDITIONAL_PAY', label: 'Menunggu bayar tambahan' },
  { value: 'WAITING_CUSTOMER_CONFIRM', label: 'Menunggu konfirmasi pelanggan' },
  { value: 'COMPLETED', label: 'Selesai' },
  { value: 'CANCELLED', label: 'Dibatalkan' },
  { value: 'DISPUTED', label: 'Sengketa' },
];

export const ORDER_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  ORDER_STATUS_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]),
);

export function orderStatusVariant(
  status: string,
): 'warning' | 'info' | 'success' | 'danger' | 'neutral' {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'CANCELLED':
      return 'neutral';
    case 'DISPUTED':
      return 'danger';
    case 'IN_PROGRESS':
    case 'PAID':
      return 'info';
    case 'WAITING_CONFIRMATION':
    case 'WAITING_PAYMENT':
    case 'WAITING_ADDITIONAL_PAY':
    case 'WAITING_CUSTOMER_CONFIRM':
      return 'warning';
    default:
      return 'neutral';
  }
}

// ── Users ───────────────────────────────────────────────────────────
export const USER_ROLE_OPTIONS = [
  { value: '', label: 'Semua role' },
  { value: 'customer', label: 'Pelanggan' },
  { value: 'partner', label: 'Mitra' },
  { value: 'admin', label: 'Admin' },
];

export const USER_STATUS_OPTIONS = [
  { value: '', label: 'Semua status' },
  { value: 'active', label: 'Aktif' },
  { value: 'suspended', label: 'Suspended' },
];
