import {
  LayoutDashboard,
  BadgeCheck,
  Scale,
  Banknote,
  Users,
  Ticket,
  Receipt,
  LayoutGrid,
  ScrollText,
  Package,
  Flag,
  Star,
  Wallet,
  Bell,
  MessageSquare,
  Settings,
  DatabaseBackup,
  FileText,
  HelpCircle,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Kata kunci tambahan agar item ketemu di command palette (Ctrl+K). */
  keywords?: string[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Menu dikelompokkan menurut cara kerja admin, bukan menurut nama tabel:
 * antrean harian dulu (Operasional), baru penelusuran data, uang, lalu sistem.
 *
 * Catatan: verifikasi mitra memakai satu entri "Mitra" yang sama dengan
 * penelusuran data — badge merahnya sudah menandai antrean yang perlu ditinjau,
 * jadi tak perlu dua entri ke rute yang sama (ambigu untuk penanda menu aktif).
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operasional',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, keywords: ['beranda', 'ringkasan', 'statistik'] },
      { label: 'Sengketa', href: '/dashboard/disputes', icon: Scale, keywords: ['dispute', 'mediasi'] },
      { label: 'Laporan', href: '/dashboard/reports', icon: Flag, keywords: ['report', 'cs', 'bantuan', 'tiket'] },
      { label: 'Withdrawal', href: '/dashboard/withdrawals', icon: Banknote, keywords: ['tarik', 'payout', 'pencairan'] },
      { label: 'Chat', href: '/dashboard/chat', icon: MessageSquare, keywords: ['pesan', 'percakapan'] },
    ],
  },
  {
    label: 'Data',
    items: [
      { label: 'Pengguna', href: '/dashboard/users', icon: Users, keywords: ['user', 'customer', 'pelanggan', 'akun'] },
      { label: 'Mitra', href: '/dashboard/partners', icon: BadgeCheck, keywords: ['partner', 'verifikasi', 'kyc'] },
      { label: 'Produk Jasa', href: '/dashboard/services', icon: Package, keywords: ['layanan', 'service', 'produk'] },
      { label: 'Kategori', href: '/dashboard/categories', icon: LayoutGrid, keywords: ['category', 'subkategori'] },
      { label: 'Promo', href: '/dashboard/promos', icon: Ticket, keywords: ['voucher', 'kupon', 'diskon'] },
      { label: 'Review', href: '/dashboard/reviews', icon: Star, keywords: ['ulasan', 'rating', 'bintang'] },
    ],
  },
  {
    label: 'Keuangan',
    items: [
      { label: 'Transaksi', href: '/dashboard/transactions', icon: Receipt, keywords: ['order', 'pesanan', 'booking'] },
      { label: 'Keuangan', href: '/dashboard/financial', icon: Wallet, keywords: ['dompet', 'saldo', 'ledger', 'finansial'] },
    ],
  },
  {
    label: 'Sistem',
    items: [
      { label: 'Notifikasi', href: '/dashboard/notifications', icon: Bell, keywords: ['notification', 'pemberitahuan', 'broadcast', 'pengumuman'] },
      { label: 'Audit Log', href: '/dashboard/audit-logs', icon: ScrollText, keywords: ['jejak', 'riwayat admin', 'log'] },
      { label: 'Setelan', href: '/dashboard/settings', icon: Settings, keywords: ['komisi', 'tarif', 'biaya', 'platform', 'konfigurasi'] },
      { label: 'FAQ', href: '/dashboard/faqs', icon: HelpCircle, keywords: ['bantuan', 'pertanyaan', 'help', 'tanya jawab'] },
      { label: 'Retensi Data', href: '/dashboard/retention', icon: DatabaseBackup, keywords: ['pemusnahan', 'hapus data', 'masa simpan', 'privasi', 'purge'] },
      { label: 'Dokumen Legal', href: '/dashboard/legal', icon: FileText, keywords: ['syarat', 'ketentuan', 'privasi', 's&k', 'terms', 'privacy', 'consent', 'persetujuan'] },
      { label: 'Admin', href: '/dashboard/admins', icon: ShieldCheck, keywords: ['pengelola', 'akun admin', 'akses'] },
    ],
  },
];

/** Semua item, diratakan — untuk command palette & breadcrumb. */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/**
 * Item menu yang cocok dengan sebuah pathname. `/dashboard` dicocokkan persis
 * agar tidak ikut aktif di setiap sub-halaman.
 */
export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) =>
    item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href),
  );
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
}
