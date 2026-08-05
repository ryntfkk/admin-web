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

// ── Services ────────────────────────────────────────────────────────
export const SERVICE_STATUS_OPTIONS = [
  { value: '', label: 'Semua status' },
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' },
];

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
  { value: 'deleted', label: 'Terhapus' },
];

export const LOGIN_EVENT_LABELS: Record<string, string> = {
  LOGIN: 'Login',
  LOGIN_FAILED: 'Login gagal',
  REGISTER_OTP: 'Registrasi (OTP)',
  REGISTER_EMAIL: 'Registrasi (email)',
};

export function loginEventVariant(event: string): 'success' | 'danger' | 'info' | 'neutral' {
  switch (event) {
    case 'LOGIN':
      return 'success';
    case 'LOGIN_FAILED':
      return 'danger';
    case 'REGISTER_OTP':
    case 'REGISTER_EMAIL':
      return 'info';
    default:
      return 'neutral';
  }
}

// ── Partners ────────────────────────────────────────────────────────
export const PARTNER_STATUS_OPTIONS = [
  { value: 'pending', label: 'Menunggu verifikasi' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'rejected', label: 'Ditolak' },
  { value: '', label: 'Semua status' },
];

export const PARTNER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Disetujui',
  rejected: 'Ditolak',
};

export function partnerStatusVariant(status: string): 'warning' | 'success' | 'danger' | 'neutral' {
  switch (status) {
    case 'pending':
      return 'warning';
    case 'approved':
      return 'success';
    case 'rejected':
      return 'danger';
    default:
      return 'neutral';
  }
}

// ── Reports ──────────────────────────────────────────────────────────
export const REPORT_STATUS_OPTIONS = [
  { value: '', label: 'Semua status' },
  { value: 'OPEN', label: 'Terbuka' },
  { value: 'REVIEWING', label: 'Ditinjau' },
  { value: 'ACTIONED', label: 'Ditindaklanjuti' },
  { value: 'DISMISSED', label: 'Dismissed' },
];

export const REPORT_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Terbuka',
  REVIEWING: 'Ditinjau',
  ACTIONED: 'Ditindaklanjuti',
  DISMISSED: 'Dismissed',
};

export const REPORT_TYPE_LABELS: Record<string, string> = {
  PARTNER: 'Mitra',
  SERVICE: 'Layanan',
  REVIEW: 'Review',
  CHAT_MESSAGE: 'Pesan Chat',
  USER: 'Pengguna',
  SUPPORT: 'Bantuan CS',
};

/** Opsi filter tipe target laporan, diturunkan dari label agar tak bisa desync. */
export const REPORT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Semua target' },
  ...Object.entries(REPORT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

export function reportStatusVariant(status: string): 'warning' | 'info' | 'success' | 'neutral' | 'danger' {
  switch (status) {
    case 'OPEN':
      return 'warning';
    case 'REVIEWING':
      return 'info';
    case 'ACTIONED':
      return 'success';
    case 'DISMISSED':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function reportTypeVariant(type: string): 'info' | 'success' | 'warning' | 'danger' | 'default' {
  switch (type) {
    case 'PARTNER':
      return 'info';
    case 'SERVICE':
      return 'success';
    case 'REVIEW':
      return 'warning';
    case 'CHAT_MESSAGE':
      return 'default';
    case 'USER':
      return 'danger';
    default:
      return 'default';
  }
}

// ── Reviews ──────────────────────────────────────────────────────────
// Backend memfilter `is_hidden = ($1 = 'true')` (AdminListReviews) . jadi nilai
// harus 'true'/'false', BUKAN 'hidden'/'visible' (yang keduanya jatuh ke visible).
export const REVIEW_STATUS_OPTIONS = [
  { value: '', label: 'Semua' },
  { value: 'false', label: 'Visible' },
  { value: 'true', label: 'Hidden' },
];

export function starRatingVariant(rating: number): 'success' | 'warning' | 'info' | 'neutral' {
  if (rating >= 4) return 'success';
  if (rating >= 3) return 'warning';
  if (rating >= 2) return 'info';
  return 'neutral';
}

// ── Wallet ────────────────────────────────────────────────────────────
export const WALLET_TX_CATEGORY_LABELS: Record<string, string> = {
  EARNING: 'Pendapatan',
  REFUND: 'Refund',
  WITHDRAWAL: 'Penarikan',
  TOPUP: 'Top-up',
  PAYMENT: 'Pembayaran',
  ADJUSTMENT: 'Penyesuaian',
};

export const WALLET_TX_TYPE_LABELS: Record<string, string> = {
  CREDIT: 'Masuk',
  DEBIT: 'Keluar',
};

export const WALLET_TX_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  COMPLETED: 'Selesai',
  FAILED: 'Gagal',
};

export function walletTxTypeVariant(type: string): 'success' | 'danger' | 'neutral' {
  switch (type) {
    case 'CREDIT':
      return 'success';
    case 'DEBIT':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function walletTxStatusVariant(status: string): 'warning' | 'success' | 'danger' | 'neutral' {
  switch (status) {
    case 'PENDING':
      return 'warning';
    case 'COMPLETED':
      return 'success';
    case 'FAILED':
      return 'danger';
    default:
      return 'neutral';
  }
}

// ── Transaksi (order) ───────────────────────────────────────────────

/** Penyaring status pembayaran pada daftar transaksi. */
export const ORDER_PAYMENT_OPTIONS = [
  { value: '', label: 'Semua pembayaran' },
  { value: 'paid', label: 'Sudah dibayar' },
  { value: 'unpaid', label: 'Belum dibayar' },
];

/** Nilainya harus sama persis dengan klausa ORDER BY di AdminListOrders. */
export const ORDER_SORT_OPTIONS = [
  { value: '', label: 'Terbaru dibuat' },
  { value: 'created_asc', label: 'Terlama dibuat' },
  { value: 'scheduled_asc', label: 'Jadwal terdekat' },
  { value: 'scheduled_desc', label: 'Jadwal terjauh' },
  { value: 'amount_desc', label: 'Nilai terbesar' },
  { value: 'amount_asc', label: 'Nilai terkecil' },
];

export const CANCELLED_BY_LABELS: Record<string, string> = {
  CUSTOMER: 'Pelanggan',
  PARTNER: 'Mitra',
  SYSTEM: 'Sistem/Admin',
};

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  initial_payment: 'Pembayaran awal',
  additional_payment: 'Pembayaran tambahan',
  refund: 'Refund',
};

export const TRANSACTION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Menunggu',
  PAID: 'Lunas',
  REFUNDED: 'Dikembalikan',
  FAILED: 'Gagal',
  DISBURSED: 'Dicairkan',
  COMPLETED: 'Selesai',
};

export function transactionStatusVariant(
  status: string,
): 'warning' | 'success' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'PAID':
    case 'COMPLETED':
      return 'success';
    case 'PENDING':
      return 'warning';
    case 'FAILED':
      return 'danger';
    case 'DISBURSED':
    case 'REFUNDED':
      return 'info';
    default:
      return 'neutral';
  }
}

export const FEE_TYPE_LABELS: Record<string, string> = {
  MATERIAL: 'Material',
  SERVICE: 'Jasa',
};

export const ADDITIONAL_FEE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Menunggu persetujuan',
  PAID: 'Dibayar',
  REJECTED: 'Ditolak',
};

export function additionalFeeStatusVariant(
  status: string,
): 'warning' | 'success' | 'danger' | 'neutral' {
  switch (status) {
    case 'PAID':
      return 'success';
    case 'PENDING':
      return 'warning';
    case 'REJECTED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export const PAYMENT_EVENT_STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Diterima',
  PROCESSED: 'Diproses',
  FAILED: 'Gagal',
  IGNORED: 'Diabaikan',
};

export function paymentEventStatusVariant(
  status: string,
): 'warning' | 'success' | 'danger' | 'neutral' {
  switch (status) {
    case 'PROCESSED':
      return 'success';
    case 'RECEIVED':
      return 'warning';
    case 'FAILED':
      return 'danger';
    default:
      return 'neutral';
  }
}

/**
 * Peran pelaku pada riwayat status. `system` bukan "data hilang" . itu memang
 * transisi otomatis (worker/trigger), dan dibedakan dari admin agar jejak
 * manusia tidak tenggelam.
 */
export const ACTOR_ROLE_LABELS: Record<string, string> = {
  customer: 'Pelanggan',
  partner: 'Mitra',
  admin: 'Admin',
  system: 'Sistem',
};

export function actorRoleVariant(role: string): 'info' | 'success' | 'warning' | 'neutral' {
  switch (role) {
    case 'admin':
      return 'warning';
    case 'customer':
      return 'info';
    case 'partner':
      return 'success';
    default:
      return 'neutral';
  }
}
