'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { NAV_ITEMS } from '@/lib/nav';
import { fetchAPI } from '@/lib/api';
import type { DashboardStats } from '@/types/api';
import { cn } from '@/lib/utils';

// Badge "Perlu Tindakan" per menu. Memakai queryKey yang SAMA dgn halaman
// dashboard (react-query dedupe) + refetch berkala → badge terasa "notifikasi
// live" sehingga admin tahu ada laporan/sengketa/withdrawal baru tanpa reload.
function useActionBadges(): Record<string, number> {
  const { data } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await fetchAPI<DashboardStats>('/admin/dashboard/stats');
      if (!res.success || !res.data) throw new Error(res.message || 'Gagal memuat statistik');
      return res.data;
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  if (!data) return {};
  return {
    '/dashboard/reports': data.overview.open_reports,
    '/dashboard/disputes': data.overview.open_disputes,
    '/dashboard/partners': data.overview.pending_partners,
    '/dashboard/withdrawals': data.financial.pending_withdrawals_count,
  };
}

export default function Sidebar() {
  const pathname = usePathname();
  const badges = useActionBadges();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="size-4.5" />
        </div>
        <span className="font-semibold tracking-tight">POSKO24 Admin</span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);
          const count = badges[item.href] ?? 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
              )}
            >
              <item.icon className="size-4.5 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {count > 0 && (
                <span className="min-w-[18px] rounded-full bg-rose-500 px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">
                  {count > 99 ? '99+' : count}
                </span>
              )}
              {!item.ready && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  soon
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3 text-xs text-muted-foreground">
        v1.0.0
      </div>
    </aside>
  );
}
