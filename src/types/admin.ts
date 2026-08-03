import type {
  NullString,
  NullInt64,
  NullTime,
  NullUUID,
} from '@/lib/sql';

// ── Partners ────────────────────────────────────────────────────────
export interface PendingPartnerRow {
  partner_id: string;
  ktp_photo_url: NullString;
  selfie_ktp_url: NullString;
  bio: NullString;
  verification_status: string;
  submitted_at: string;
  user_id: string;
  name: string;
  phone: NullString;
  email: NullString;
}

export interface PartnerDetailRow extends PendingPartnerRow {
  rejection_reason: NullString;
  user_created_at: string;
  // Dikirim oleh AdminGetPartnerDetail (queries/admin.sql) tapi dulu tak
  // dideklarasikan di sini, jadi tak pernah tampil di UI padahal justru inilah
  // data yang dipakai admin saat memverifikasi KYC & pembayaran.
  decrypted_ktp: NullString | string | null;
  bank_code: NullString;
  bank_account_number: NullString;
  bank_account_name: NullString;
  // F4: field lengkap untuk admin review (basecamp, service_area, statistik)
  service_area: string[] | null;
  is_online: boolean;
  strike_count: number;
  avg_rating: string;
  total_reviews: number;
  total_orders: number;
  basecamp_lat: number;
  basecamp_lon: number;
  city: NullString;
  district: NullString;
  province: NullString;
  address_detail: NullString;
  avatar_url: NullString;
}

// F4: portfolio photo (admin lihat semua termasuk soft-deleted)
export interface PartnerPortfolioPhoto {
  id: string;
  partner_id: string;
  photo_url: string;
  caption: NullString;
  created_at: string;
  deleted_at: NullTime;
  deleted_by_partner: boolean;
}

// F4: service singkat untuk admin review
export interface PartnerServiceRow {
  id: string;
  partner_id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  is_active: boolean;
  created_at: string;
}

// F5: audit log mitra — timeline aksi (delete dokumen, update profile, dll).
export interface PartnerActionLog {
  id: string;
  partner_id: string;
  user_id: NullUUID;
  action: string;
  payload: Record<string, unknown> | null;
  ip_address: NullString;
  user_agent: NullString;
  created_at: string;
}

// ── Disputes ────────────────────────────────────────────────────────
export interface DisputeRow {
  id: string;
  order_id: string;
  dispute_type: string;
  status: string;
  has_evidence: boolean;
  has_response: boolean;
  created_at: string;
  resolution_type: { ResolutionType: string; Valid: boolean } | null;
  order_number: string;
  order_amount: number;
  customer_name: string;
  partner_id: string;
  partner_name: string;
}

export interface DisputeDetailRow {
  id: string;
  order_id: string;
  dispute_type: string;
  status: string;
  evidence_urls: string[] | null;
  created_at: string;
  resolution_type: { ResolutionType: string; Valid: boolean } | null;
  refund_amount: NullInt64;
  partner_payout: NullInt64;
  admin_resolution: NullString;
  response_content: NullString;
  response_evidence_urls: string[] | null;
  responded_at: NullTime;
  order_number: string;
  order_amount: number;
  customer_name: string;
  partner_id: string;
  partner_name: string;
  /** Status order saat ini — resolusi hanya sah bila 'DISPUTED'. */
  order_status: string;
  /** Total dana terkumpul (order + biaya tambahan PAID) = plafon refund + payout. */
  total_collected: number;
}

// ── Withdrawals ─────────────────────────────────────────────────────
export interface WithdrawalRow {
  id: string;
  amount: number;
  admin_fee: number;
  status: string;
  created_at: string;
  transaction_id: NullUUID;
  user_id: string;
  user_name: string;
  bank_code: NullString;
  bank_account_number: NullString;
  bank_account_name: NullString;
}

// ── Promos (db.Promo) ───────────────────────────────────────────────
export interface Promo {
  id: string;
  code: string;
  name: string;
  description: NullString;
  sponsor: string;
  category_id: NullUUID;
  partner_id: NullUUID;
  discount_type: string; // 'percentage' | 'fixed'
  value: number;
  max_discount: NullInt64;
  min_order_amount: number;
  usage_limit: number;
  per_user_limit: number;
  used_count: number;
  reserved_count: number;
  valid_until: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PromoFormValues {
  code: string;
  name: string;
  description: string;
  sponsor: string;
  discount_type: string;
  value: number;
  max_discount: number;
  min_order_amount: number;
  usage_limit: number;
  per_user_limit: number;
  valid_until: string; // ISO8601
  is_active: boolean;
}

// ── Audit logs (admin.AuditLogResponse) ─────────────────────────────
export interface AuditLog {
  id: string;
  admin_username: string;
  action: string;
  target_id?: string;
  payload?: unknown;
  ip_address?: string;
  created_at: string;
}

// ── Orders / Transactions ───────────────────────────────────────────
export interface OrderRow {
  id: string;
  order_number: string;
  status: string;
  agreed_price: number;
  created_at: string;
  scheduled_at: string;
  customer_name: string;
  partner_name: string;
}

export interface OrderDetailRow {
  id: string;
  order_number: string;
  status: string;
  agreed_price: number;
  total_service_price: number;
  transport_fee: number;
  admin_fee_customer: number;
  discount_amount: number;
  scheduled_at: string;
  address: string;
  notes: NullString;
  created_at: string;
  completed_at: NullTime;
  cancellation_reason: NullString;
  customer_id: string;
  customer_name: string;
  customer_phone: NullString;
  partner_id: string;
  partner_name: string;
  partner_phone: NullString;
}

// ── Partner services (products) ─────────────────────────────────────
export interface ServiceRow {
  id: string;
  partner_id: string;
  partner_name: string;
  category_id: string;
  category_name: string;
  name: string;
  description: NullString;
  price: number;
  estimated_duration: number;
  unit: string;
  is_active: boolean;
  photo_count: number;
  created_at: string;
}

export interface ServicePhoto {
  id: string;
  photo_url: string;
  is_primary: boolean;
  sort_order: number;
}

export interface ServiceVariation {
  id: string;
  name: string;
  price: number;
}

export interface ServiceDetail extends ServiceRow {
  included_items: string[];
  excluded_items: string[];
  photos: ServicePhoto[];
  /** Variasi harga (kosong bila harga tunggal). Read-only di panel admin. */
  variations: ServiceVariation[];
}

// ── Categories ──────────────────────────────────────────────────────
export interface Category {
  id: string;
  name: string;
  icon_url: NullString;
  is_active: boolean;
  // Hierarki 2 level. parent_id null = kategori utama; terisi = subkategori.
  slug: NullString;
  sort_order: number;
  parent_id: NullUUID;
  parent_name: NullString;
}

// ── Users ───────────────────────────────────────────────────────────
export interface UserRow {
  id: string;
  username: string;
  name: string;
  phone: NullString;
  email: NullString;
  avatar_url: NullString;
  active_role: string;
  is_suspended: boolean;
  is_verified: boolean;
  balance: number;
  created_at: string;
  deleted_at: NullTime;
}

export interface UserDetailRow {
  id: string;
  name: string;
  username: string;
  email: NullString;
  phone: NullString;
  avatar_url: NullString;
  balance: number;
  is_suspended: boolean;
  suspended_until: NullTime;
  roles: string[];
  active_role: string;
  is_verified: boolean;
  bank_code: NullString;
  bank_account_number: NullString;
  bank_account_name: NullString;
  created_at: string;
  deleted_at: NullTime;
  /**
   * Sinyal auth. Tanpa ini panel tidak punya cara membedakan akun Google tanpa
   * password dari akun biasa — admin yang menyelidiki "user tidak bisa login"
   * hanya melihat baris yang tampak normal.
   */
  phone_verified: boolean;
  email_verified: boolean;
  /** Asal pendaftaran ('local' | 'google'), BUKAN kapabilitas login. */
  auth_provider: string;
  has_google: boolean;
  has_password: boolean;
}

// ── Login history (admin.LoginHistoryResponse) ──────────────────────
export interface LoginHistoryRow {
  id: string;
  event_type: string;
  identifier?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// ── Arsip penghapusan akun (db.UserDeletionArchive) ─────────────────
export interface DeletionArchiveRow {
  id: string;
  user_id: string;
  username: string;
  name: string;
  phone: NullString;
  email: NullString;
  avatar_url: NullString;
  bank_code: NullString;
  bank_account_number: NullString;
  bank_account_name: NullString;
  roles: string[];
  active_role: string;
  balance: number;
  user_created_at: string;
  deleted_at: string;
}

export interface UserAddressRow {
  id: string;
  user_id: string;
  label: string;
  address: string;
  address_detail: NullString;
  city: NullString;
  district: NullString;
  province: NullString;
  postal_code: NullString;
  lon: number | null;
  lat: number | null;
  is_default: boolean;
  created_at: string;
}

// ── Reports ──────────────────────────────────────────────────────────
export interface ReportRow {
  id: string;
  reporter_id: string;
  reporter_name: string;
  target_type: string;
  target_id: string;
  reason_category: string;
  description: NullString;
  status: string;
  evidence_urls: string[] | null;
  created_at: string;
  resolved_by: NullString;
  resolution_note: NullString;
  resolved_at: NullTime;
  // Dikirim AdminListReports tapi dulu tak dideklarasikan, sehingga penanda
  // "ada balasan pelapor yang belum dibaca" tak pernah tampil di daftar.
  last_message_at: NullTime;
  last_message: string;
  unread_count: number;
}

export interface ReportDetailRow {
  id: string;
  reporter_id: string;
  reporter_name: string;
  reporter_phone: NullString;
  target_type: string;
  target_id: string;
  reason_category: string;
  description: NullString;
  status: string;
  evidence_urls: string[] | null;
  created_at: string;
  resolved_by: NullString;
  resolution_note: NullString;
  resolved_at: NullTime;
  target_name: NullString;
  target_details: NullString;
}

// ── Reviews ──────────────────────────────────────────────────────────
export interface ReviewRow {
  id: string;
  order_id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  partner_id: string;
  partner_name: string;
  rating: number;
  quality_rating: number;
  punctuality_rating: number;
  communication_rating: number;
  comment: NullString;
  partner_response: NullString;
  partner_response_at: NullTime;
  is_hidden: boolean;
  created_at: string;
}

export interface ReviewDetailRow extends ReviewRow {
  service_name: NullString;
  order_amount: number;
  customer_phone: NullString;
  rating_quality: number | null;
  rating_punctuality: number | null;
  rating_communication: number | null;
}

// ── Wallet / Financial ───────────────────────────────────────────────
export interface WalletRow {
  user_id: string;
  user_name: string;
  balance: number;
  total_credits: number;
  total_debits: number;
}

export interface WalletDetailRow extends WalletRow {
  user_phone: NullString;
}

export interface WalletTransactionRow {
  id: string;
  user_id: string;
  type: string;
  category: string;
  status: string;
  amount: number;
  description: NullString;
  created_at: string;
  order_number: string | null;
}

export interface AllTransactionRow {
  id: string;
  user_id: string;
  user_name: string;
  type: string;
  category: string;
  status: string;
  amount: number;
  description: NullString;
  created_at: string;
  order_number: string | null;
  withdrawal_id: string | null;
  bank_code: NullString;
  bank_account_number: NullString;
}

export interface FinancialSummary {
  total_earnings: number;
  total_refunds: number;
  total_withdrawals: number;
  total_payments: number;
  total_topups: number;
}

// ── Notifications ───────────────────────────────────────────────────
export interface NotificationRow {
  id: string;
  user_id: string;
  user_name: string;
  type: string;
  title: string;
  body: NullString;
  is_read: boolean;
  metadata: NullString;
  created_at: string;
}

// ── Chat ─────────────────────────────────────────────────────────────
export interface ChatRoomRow {
  id: string;
  customer_id: string;
  customer_name: string;
  partner_id: string;
  partner_name: string;
  last_message: NullString;
  last_message_at: NullTime;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  message_type: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

// Pesan dalam thread laporan/CS (chat dua arah pelapor ↔ admin).
export interface ReportMessageRow {
  id: string;
  report_id: string;
  sender_type: 'user' | 'admin';
  admin_username: NullString;
  sender_name: string;
  content: string;
  message_type: string;
  created_at: string;
}

// ── Order Status History ─────────────────────────────────────────────
export interface OrderStatusHistoryRow {
  id: string;
  order_id: string;
  status: string;
  actor_id: NullString;
  actor_name: NullString;
  actor_role: NullString;
  reason: NullString;
  created_at: string;
}

// ── Fase 3: kontrol penuh data ──────────────────────────────────────
// Endpoint di bawah ini sudah memakai lapisan DTO backend (internal/admin/mapper.go),
// jadi nilainya polos — TIDAK perlu dibongkar dengan helper di lib/sql.ts.

export interface WorkingHour {
  id: string;
  day_of_week: string; // monday..sunday
  open_time: string; // "HH:MM"
  close_time: string; // "HH:MM"
  is_open: boolean;
}

export interface PartnerDocument {
  id: string;
  partner_id: string;
  doc_type: string;
  file_url: string;
  document_number: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface PartnerStrike {
  id: string;
  order_id: string | null;
  order_number: string | null;
  reason: string;
  created_at: string;
}

export interface AdminAccount {
  id: string;
  username: string;
  name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  is_suspended: boolean;
  created_at: string;
}

export interface PlatformSettings {
  base_transport_fee: number;
  transport_fee_per_km: number;
  admin_fee: number;
  platform_fee_rate: number; // 0.12 = 12%
  min_transaction: number;
  withdrawal_fee: number;
  max_withdrawal: number;
  max_wallet_adjustment: number;
  updated_by: string | null;
  updated_at: string;
}
