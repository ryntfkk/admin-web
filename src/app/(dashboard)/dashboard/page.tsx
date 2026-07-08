'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Users,
  BadgeCheck,
  ShoppingBag,
  Scale,
  Banknote,
  Clock3,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import type { DashboardStats } from '@/types/api';
import { formatIDR, formatNumber } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';

function useStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await fetchAPI<DashboardStats>('/admin/dashboard/stats');
      if (!res.success || !res.data) throw new Error(res.message || 'Gagal memuat statistik');
      return res.data;
    },
  });
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={`flex size-11 items-center justify-center rounded-lg ${
            accent ?? 'bg-primary/10 text-primary'
          }`}
        >
          <Icon className="size-5.5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data, isLoading, isError, error } = useStats();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
        <AlertTriangle className="size-8 text-destructive" />
        <p className="text-sm text-muted-foreground">
          {(error as Error)?.message || 'Gagal memuat data dashboard.'}
        </p>
      </div>
    );
  }

  const o = data.overview;
  const t = data.today;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Ringkasan aktivitas platform</p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={Users} label="Total Pelanggan" value={formatNumber(o.total_customers)} />
        <StatCard icon={BadgeCheck} label="Total Mitra" value={formatNumber(o.total_partners)} />
        <StatCard icon={ShoppingBag} label="Pesanan Aktif" value={formatNumber(o.active_orders)} />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/dashboard/partners" className="block">
          <StatCard
            icon={Clock3}
            label="Mitra Menunggu Verifikasi"
            value={formatNumber(o.pending_partners)}
            accent="bg-amber-500/10 text-amber-600"
          />
        </Link>
        <Link href="/dashboard/disputes" className="block">
          <StatCard
            icon={Scale}
            label="Sengketa Terbuka"
            value={formatNumber(o.open_disputes)}
            accent="bg-rose-500/10 text-rose-600"
          />
        </Link>
        <Link href="/dashboard/withdrawals" className="block">
          <StatCard
            icon={Banknote}
            label="Withdrawal Tertunda"
            value={formatIDR(data.financial.pending_withdrawals)}
            accent="bg-emerald-500/10 text-emerald-600"
          />
        </Link>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Hari Ini</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={ShoppingBag}
            label="Pesanan Baru"
            value={formatNumber(t.new_orders)}
            accent="bg-blue-500/10 text-blue-600"
          />
          <StatCard
            icon={CheckCircle2}
            label="Pesanan Selesai"
            value={formatNumber(t.completed_orders)}
            accent="bg-emerald-500/10 text-emerald-600"
          />
          <StatCard
            icon={XCircle}
            label="Pesanan Dibatalkan"
            value={formatNumber(t.cancelled_orders)}
            accent="bg-rose-500/10 text-rose-600"
          />
        </div>
      </section>
    </div>
  );
}
