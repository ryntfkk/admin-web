'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_GROUPS, isNavItemActive } from '@/lib/nav';
import { useActionBadges } from '@/hooks/useActionBadges';
import { cn } from '@/lib/utils';

/**
 * Daftar menu bergrup. Dipakai bersama oleh sidebar desktop dan drawer mobile
 * supaya struktur menu hanya ditulis sekali.
 */
export default function SidebarNav({
  collapsed = false,
  onNavigate,
}: {
  /** Mode ikon saja (sidebar desktop yang diciutkan). */
  collapsed?: boolean;
  /** Dipanggil setelah menu diklik . dipakai drawer mobile untuk menutup diri. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const badges = useActionBadges();

  return (
    <nav className={cn('flex flex-1 flex-col gap-4 overflow-y-auto py-3', collapsed ? 'px-2' : 'px-3')}>
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          {collapsed ? (
            <div className="mx-auto my-1 h-px w-6 bg-sidebar-border" aria-hidden />
          ) : (
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
          )}

          {group.items.map((item) => {
            const active = isNavItemActive(item, pathname);
            const count = badges[item.href] ?? 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'relative flex items-center rounded-lg text-sm font-medium transition-colors',
                  collapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2',
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                )}
              >
                <item.icon className="size-4.5 shrink-0" />

                {collapsed ? (
                  // Saat diciutkan tak ada ruang untuk angka . cukup titik penanda
                  // agar admin tetap melihat ada antrean yang menunggu.
                  count > 0 && (
                    <span
                      className="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive"
                      aria-label={`${count} perlu tindakan`}
                    />
                  )
                ) : (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {count > 0 && (
                      <span className="min-w-[18px] rounded-full bg-destructive px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums text-destructive-foreground">
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
