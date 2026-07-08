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

// ── Audit logs (db.AdminAuditLog) ───────────────────────────────────
export interface AuditLog {
  id: string;
  admin_username: string;
  action: string;
  target_id: NullString;
  payload?: unknown;
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

// ── Categories ──────────────────────────────────────────────────────
export interface Category {
  id: string;
  name: string;
  icon_url: NullString;
  is_active: boolean;
}

// ── Users ───────────────────────────────────────────────────────────
export interface UserRow {
  id: string;
  username: string;
  name: string;
  phone: NullString;
  email: NullString;
  active_role: string;
  is_suspended: boolean;
  is_verified: boolean;
  balance: number;
  created_at: string;
}

export interface UserDetailRow {
  id: string;
  name: string;
  email: NullString;
  phone: NullString;
  is_suspended: boolean;
  suspended_until: NullTime;
  active_role: string;
  created_at: string;
}
