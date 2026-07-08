'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';
import { Button } from '@/components/ui/button';

export default function Topbar() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

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

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4">
      <div className="md:hidden font-semibold">POSKO24 Admin</div>
      <div className="flex flex-1 items-center justify-end gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initials}
          </div>
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium leading-tight">{user?.name || user?.username}</div>
            <div className="text-xs text-muted-foreground leading-tight">Administrator</div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Keluar">
          <LogOut className="size-4.5" />
        </Button>
      </div>
    </header>
  );
}
