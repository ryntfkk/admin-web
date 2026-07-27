'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ArrowRight, LogOut, Moon, Search, Sun, type LucideIcon } from 'lucide-react';
import { NAV_ITEMS } from '@/lib/nav';
import { fetchAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';
import { useCommandStore } from '@/lib/store/commandStore';
import { useTheme } from '@/components/providers/theme-provider';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useIsMounted } from '@/hooks/useIsMounted';
import { cn } from '@/lib/utils';

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  keywords: string[];
  run: () => void;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Entitas yang punya halaman detail ber-URL, untuk lompat langsung dari UUID. */
const ENTITY_ROUTES: { label: string; segment: string }[] = [
  { label: 'Pengguna', segment: 'users' },
  { label: 'Transaksi', segment: 'transactions' },
  { label: 'Mitra', segment: 'partners' },
  { label: 'Layanan', segment: 'services' },
];

/**
 * Peluncur cepat (Ctrl/Cmd+K). Panel admin punya ~15 halaman; berpindah antar
 * antrean lewat mouse memperlambat kerja triase harian.
 *
 * Menempelkan sebuah UUID (mis. dari audit log, laporan error, atau chat
 * dukungan) langsung menawarkan pembukaan detail entitas terkait — jenis
 * entitasnya tak bisa ditebak dari UUID saja, jadi keempatnya ditawarkan.
 */
export default function CommandPalette() {
  const open = useCommandStore((s) => s.open);
  const setOpen = useCommandStore((s) => s.setOpen);
  const toggle = useCommandStore((s) => s.toggle);
  const mounted = useIsMounted();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggle();
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, setOpen]);

  React.useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!mounted || !open) return null;

  // Dialog di-mount ulang tiap kali dibuka, sehingga query & posisi kursor
  // otomatis kembali kosong — tanpa efek yang mereset state.
  return createPortal(<CommandPaletteDialog onClose={() => setOpen(false)} />, document.body);
}

function CommandPaletteDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const logout = useAuthStore((s) => s.logout);

  const [query, setQuery] = React.useState('');
  const [cursor, setCursor] = React.useState(0);
  const panelRef = useFocusTrap<HTMLDivElement>(true);
  const listRef = React.useRef<HTMLDivElement>(null);

  const commands = React.useMemo<Command[]>(() => {
    const navCommands: Command[] = NAV_ITEMS.map((item) => ({
      id: `nav:${item.href}`,
      label: item.label,
      hint: 'Buka halaman',
      icon: item.icon,
      keywords: [item.label, ...(item.keywords ?? [])],
      run: () => router.push(item.href),
    }));

    const actionCommands: Command[] = [
      {
        id: 'action:theme',
        label: resolvedTheme === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap',
        hint: 'Tampilan',
        icon: resolvedTheme === 'dark' ? Sun : Moon,
        keywords: ['tema', 'theme', 'dark', 'gelap', 'terang', 'mode'],
        run: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
      },
      {
        id: 'action:logout',
        label: 'Keluar',
        hint: 'Akun',
        icon: LogOut,
        keywords: ['logout', 'keluar', 'sign out'],
        run: async () => {
          await fetchAPI('/auth/logout', { method: 'POST' });
          logout();
          router.replace('/login');
        },
      },
    ];

    return [...navCommands, ...actionCommands];
  }, [router, resolvedTheme, setTheme, logout]);

  const results = React.useMemo(() => {
    const raw = query.trim();
    const q = raw.toLowerCase();
    if (!q) return commands;

    if (UUID_RE.test(raw)) {
      return ENTITY_ROUTES.map(({ label, segment }) => ({
        id: `jump:${segment}`,
        label: `Buka ${label}`,
        hint: raw.slice(0, 8),
        icon: ArrowRight,
        keywords: [label],
        run: () => router.push(`/dashboard/${segment}/${raw}`),
      }));
    }

    return commands.filter((c) => c.keywords.some((k) => k.toLowerCase().includes(q)));
  }, [commands, query, router]);

  // Kursor bisa menunjuk ke luar daftar setelah query menyempit.
  const activeIndex = Math.min(cursor, Math.max(0, results.length - 1));

  function runCommand(command: Command | undefined) {
    if (!command) return;
    onClose();
    command.run();
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((activeIndex + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((activeIndex - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runCommand(results[activeIndex]);
    }
  }

  React.useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Peluncur perintah"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl outline-none"
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Cari halaman, perintah, atau tempel UUID…"
            aria-label="Cari halaman, perintah, atau tempel UUID"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5" role="listbox">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Tidak ada hasil untuk “{query}”.
            </p>
          ) : (
            results.map((command, index) => (
              <button
                key={command.id}
                type="button"
                data-index={index}
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setCursor(index)}
                onClick={() => runCommand(command)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  index === activeIndex ? 'bg-muted text-foreground' : 'text-muted-foreground',
                )}
              >
                <command.icon className="size-4 shrink-0" />
                <span className="flex-1 truncate text-foreground">{command.label}</span>
                {command.hint && <span className="text-xs">{command.hint}</span>}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          <span>
            <kbd className="rounded border border-border px-1">↑</kbd>{' '}
            <kbd className="rounded border border-border px-1">↓</kbd> pilih
          </span>
          <span>
            <kbd className="rounded border border-border px-1">Enter</kbd> buka
          </span>
          <span>
            <kbd className="rounded border border-border px-1">Esc</kbd> tutup
          </span>
        </div>
      </div>
    </div>
  );
}
