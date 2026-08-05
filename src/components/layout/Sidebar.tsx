'use client';

import * as React from 'react';
import Link from 'next/link';
import { PanelLeftClose, PanelLeftOpen, ShieldCheck } from 'lucide-react';
import SidebarNav from '@/components/layout/SidebarNav';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';
import { APP_VERSION } from '@/lib/constants';
import { cn } from '@/lib/utils';

const COLLAPSED_STORAGE_KEY = 'admin.sidebar.collapsed';

export default function Sidebar() {
  const [stored, setStored] = useLocalStorageState(COLLAPSED_STORAGE_KEY, '0');
  const collapsed = stored === '1';

  function toggle() {
    setStored(collapsed ? '0' : '1');
  }

  return (
    <aside
      className={cn(
        'hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div
        className={cn(
          'flex h-14 items-center border-b border-sidebar-border',
          collapsed ? 'justify-center px-2' : 'gap-2 px-4',
        )}
      >
        <Link
          href="/dashboard"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
          aria-label="POSKO24 Admin . ke dashboard"
        >
          <ShieldCheck className="size-4.5" />
        </Link>
        {!collapsed && (
          <span className="flex-1 truncate font-semibold tracking-tight">POSKO24 Admin</span>
        )}
      </div>

      <SidebarNav collapsed={collapsed} />

      <div
        className={cn(
          'flex items-center gap-2 border-t border-sidebar-border p-3',
          collapsed && 'justify-center',
        )}
      >
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Lebarkan menu' : 'Ciutkan menu'}
          title={collapsed ? 'Lebarkan menu' : 'Ciutkan menu'}
          aria-expanded={!collapsed}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {collapsed ? <PanelLeftOpen className="size-4.5" /> : <PanelLeftClose className="size-4.5" />}
        </button>
        {!collapsed && (
          <span className="text-xs text-muted-foreground">v{APP_VERSION}</span>
        )}
      </div>
    </aside>
  );
}
