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
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** true = backend endpoint exists today; false = awaiting backend work. */
  ready: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, ready: true },
  { label: 'Verifikasi Mitra', href: '/dashboard/partners', icon: BadgeCheck, ready: true },
  { label: 'Sengketa', href: '/dashboard/disputes', icon: Scale, ready: true },
  { label: 'Withdrawal', href: '/dashboard/withdrawals', icon: Banknote, ready: true },
  { label: 'Pengguna', href: '/dashboard/users', icon: Users, ready: true },
  { label: 'Promo', href: '/dashboard/promos', icon: Ticket, ready: true },
  { label: 'Audit Log', href: '/dashboard/audit-logs', icon: ScrollText, ready: true },
  { label: 'Transaksi', href: '/dashboard/transactions', icon: Receipt, ready: false },
  { label: 'Kategori', href: '/dashboard/categories', icon: LayoutGrid, ready: false },
];
