'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Menu, ShieldCheck, X } from 'lucide-react';
import SidebarNav from '@/components/layout/SidebarNav';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useIsMounted } from '@/hooks/useIsMounted';
import { APP_VERSION } from '@/lib/constants';

/**
 * Navigasi untuk layar < md. Sidebar desktop di-`hidden` pada breakpoint itu,
 * sehingga sebelumnya panel admin sama sekali tidak punya menu di ponsel.
 */
export default function MobileNav() {
  const mounted = useIsMounted();
  const pathname = usePathname();

  // Drawer diikat ke rute tempat ia dibuka: begitu pathname berubah . entah
  // karena menu diklik atau tombol Kembali browser . `open` otomatis jadi false
  // tanpa perlu efek yang memanggil setState.
  const [openedAt, setOpenedAt] = React.useState<string | null>(null);
  const open = openedAt !== null && openedAt === pathname;
  const setOpen = React.useCallback(
    (next: boolean) => setOpenedAt(next ? pathname : null),
    [pathname],
  );

  const panelRef = useFocusTrap<HTMLDivElement>(open);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, setOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buka menu"
        aria-expanded={open}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
      >
        <Menu className="size-5" />
      </button>

      {mounted &&
        open &&
        createPortal(
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div
              ref={panelRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label="Menu navigasi"
              className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl outline-none"
            >
              <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <ShieldCheck className="size-4.5" />
                </div>
                <span className="flex-1 truncate font-semibold tracking-tight">POSKO24 Admin</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Tutup menu"
                  className="rounded-md p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <SidebarNav onNavigate={() => setOpen(false)} />

              <div className="border-t border-sidebar-border p-3 text-xs text-muted-foreground">
                v{APP_VERSION}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
