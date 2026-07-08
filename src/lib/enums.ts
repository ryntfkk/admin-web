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
