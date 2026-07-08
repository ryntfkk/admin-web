'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { useAuthStore, AdminUser } from '@/lib/store/authStore';
import { ADMIN_ROLE } from '@/lib/constants';
import { getErrorMessage } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface LoginData {
  access_token: string;
  user: AdminUser;
}

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetchAPI<LoginData>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password, remember_me: true }),
      });

      if (!res.success || !res.data) {
        setError(getErrorMessage(res));
        return;
      }

      let { user, access_token } = res.data;

      // Enforce admin-only access to this panel.
      const isAdmin =
        user.active_role === ADMIN_ROLE || (user.roles || []).includes(ADMIN_ROLE);
      if (!isAdmin) {
        setError('Akun ini tidak memiliki akses admin.');
        return;
      }

      // Ensure the active role is admin (switch if needed).
      if (user.active_role !== ADMIN_ROLE) {
        useAuthStore.getState().setAccessToken(access_token);
        const sw = await fetchAPI<LoginData>('/auth/switch-role', {
          method: 'POST',
          body: JSON.stringify({ target_role: ADMIN_ROLE }),
        });
        if (sw.success && sw.data) {
          if (sw.data.access_token) access_token = sw.data.access_token;
          if (sw.data.user) user = sw.data.user;
        }
      }

      login(user, access_token);
      router.replace('/dashboard');
    } catch {
      setError('Tidak dapat terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-6" />
          </div>
          <CardTitle className="text-xl">POSKO24 Admin</CardTitle>
          <CardDescription>Masuk untuk mengelola platform</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="identifier">Email / Username</Label>
              <Input
                id="identifier"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="admin@poskojasa.com"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" disabled={loading} className="mt-1 w-full">
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? 'Memproses…' : 'Masuk'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
