'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronRight, LogOut, Monitor, Moon, Search, Sun } from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';
import { useCommandStore } from '@/lib/store/commandStore';
import { findNavItem } from '@/lib/nav';
import { useTheme, type Theme } from '@/components/providers/theme-provider';
import { Button } from '@/components/ui/button';
import MobileNav from '@/components/layout/MobileNav';

const THEME_ORDER: Theme[] = ['light', 'dark', 'system'];
const THEME_LABEL: Record<Theme, string> = {
  light: 'Tema terang',
  dark: 'Tema gelap',
  system: 'Ikut tema sistem',
};

export default function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const openCommandPalette = useCommandStore((s) => s.toggle);
  const { theme, setTheme } = useTheme();

  async function handleLogout() {
    await fetchAPI('/auth/logout', { method: 'POST' });
    logout();
    router.replace('/login');
  }

  const initials = (user?.name || user?.username || 'A')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const navItem = findNavItem(pathname);
  // Segmen setelah href menu = halaman detail (mis. /dashboard/users/<id>).
  const detailSegment =
    navItem && pathname.startsWith(navItem.href) && pathname !== navItem.href
      ? pathname.slice(navItem.href.length).replace(/^\//, '').split('/')[0]
      : null;

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  function cycleTheme() {
    setTheme(THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length]);
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
      <MobileNav />

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex items-center gap-1.5 text-sm">
          <li className="hidden sm:block">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              Admin
            </Link>
          </li>
          {navItem && (
            <>
              <ChevronRight className="hidden size-3.5 shrink-0 text-muted-foreground sm:block" aria-hidden />
              <li className="min-w-0">
                {detailSegment ? (
                  <Link href={navItem.href} className="text-muted-foreground hover:text-foreground">
                    {navItem.label}
                  </Link>
                ) : (
                  <span className="font-medium">{navItem.label}</span>
                )}
              </li>
            </>
          )}
          {detailSegment && (
            <>
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <li className="min-w-0 truncate font-mono text-xs font-medium" title={detailSegment}>
                {detailSegment}
              </li>
            </>
          )}
        </ol>
      </nav>

      <div className="flex items-center gap-2">
        {/* Pemicu yang bisa diklik untuk pintasan Ctrl+K . agar fiturnya bisa ditemukan. */}
        <button
          type="button"
          onClick={openCommandPalette}
          aria-label="Buka pencarian perintah"
          className="hidden items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
        >
          <Search className="size-3.5" />
          <span>Cari</span>
          <kbd className="rounded border border-border px-1 font-mono text-[10px]">Ctrl K</kbd>
        </button>

        <Button
          variant="ghost"
          size="icon"
          onClick={cycleTheme}
          aria-label={THEME_LABEL[theme]}
          title={THEME_LABEL[theme]}
        >
          <ThemeIcon className="size-4.5" />
        </Button>

        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initials}
          </div>
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium leading-tight">{user?.name || user?.username}</div>
            <div className="text-xs leading-tight text-muted-foreground">
              {user?.username ? `@${user.username}` : 'Administrator'}
            </div>
          </div>
        </div>

        <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Keluar">
          <LogOut className="size-4.5" />
        </Button>
      </div>
    </header>
  );
}
