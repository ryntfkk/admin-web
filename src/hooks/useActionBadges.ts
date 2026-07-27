'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/api';
import type { DashboardStats } from '@/types/api';

/**
 * Jumlah item yang menunggu tindakan, per menu.
 *
 * Memakai queryKey yang SAMA dengan halaman dashboard sehingga react-query
 * men-dedupe permintaannya; refetch berkala membuat badge terasa seperti
 * notifikasi live — admin tahu ada laporan/sengketa/withdrawal baru tanpa
 * memuat ulang halaman.
 */
export function useActionBadges(): Record<string, number> {
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
