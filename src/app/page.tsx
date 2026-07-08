'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/lib/store/authStore';

export default function Home() {
  const router = useRouter();
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (isInitializing) return;
    router.replace(isAuthenticated ? '/dashboard' : '/login');
  }, [isInitializing, isAuthenticated, router]);

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
