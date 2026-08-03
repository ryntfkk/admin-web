'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type { PlatformProfile } from '@/types/admin';
import { formatDateTime } from '@/lib/format';
import { toast } from '@/lib/store/toastStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EntitySection } from '@/components/ui/entity-page';
import { CenteredSpinner } from '@/components/ui/feedback';

// Identitas & kontak platform (Fase 3).
//
// Semua field boleh kosong; web merender yang terisi saja. Yang PENTING:
// `support_email` adalah satu-satunya kanal yang bisa dijangkau orang yang
// TIDAK bisa masuk akun — chat CS in-app butuh login. Mengosongkannya berarti
// pengguna yang terkunci tidak punya jalan menghubungi siapa pun.
export default function ProfileForm() {
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['platform-profile'],
    queryFn: async () => {
      const res = await fetchAPI<PlatformProfile>('/admin/profile');
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  if (isLoading) return <CenteredSpinner />;
  if (error || !data) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error instanceof Error ? error.message : 'Gagal memuat profil platform.'}
      </div>
    );
  }

  return (
    <Form
      key={data.updated_at}
      profile={data}
      onSaved={() => qc.invalidateQueries({ queryKey: ['platform-profile'] })}
    />
  );
}

const FIELDS: { key: keyof PlatformProfile; label: string; hint?: string; placeholder?: string }[] = [
  { key: 'brand_name', label: 'Nama merek', hint: 'Dipakai di halaman Tentang Kami dan footer.' },
  { key: 'legal_name', label: 'Nama badan usaha', hint: 'PT/CV resmi. Kosongkan bila belum ada — barisnya tidak akan tampil di web.', placeholder: 'PT Contoh Jasa Nusantara' },
  { key: 'business_id', label: 'NIB / NPWP', hint: 'Kosongkan bila belum terdaftar.' },
  { key: 'address', label: 'Alamat terdaftar' },
  { key: 'support_email', label: 'Email dukungan', hint: 'WAJIB diisi — satu-satunya kanal bagi pengguna yang tidak bisa masuk akun.', placeholder: 'info@poskojasa.com' },
  { key: 'dpo_email', label: 'Email Pengendali Data', hint: 'Untuk urusan data pribadi (UU PDP). Bila kosong, web memakai email dukungan.' },
  { key: 'support_phone', label: 'Telepon dukungan', hint: 'Opsional.' },
  { key: 'support_whatsapp', label: 'WhatsApp dukungan', hint: 'Opsional. Kosongkan bila CS hanya lewat chat in-app + email.' },
  { key: 'withdrawal_sla', label: 'SLA pencairan dana', hint: 'Kalimat yang tampil di dompet mitra.', placeholder: '1-2 hari kerja' },
];

function Form({ profile, onSaved }: { profile: PlatformProfile; onSaved: () => void }) {
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, String(profile[f.key] ?? '')])),
  );

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI('/admin/profile', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => { toast.success('Profil platform disimpan'); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <EntitySection title="Identitas & Kontak Platform">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Ditampilkan di halaman Tentang Kami, Kebijakan Privasi, dan footer.
          Field yang dikosongkan tidak dirender di web.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`p-${f.key}`}>{f.label}</Label>
              <Input
                id={`p-${f.key}`}
                value={form[f.key] ?? ''}
                placeholder={f.placeholder}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
              {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
            </div>
          ))}
        </div>

        {!form.support_email?.trim() && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
            Email dukungan kosong. Pengguna yang tidak bisa masuk akun tidak akan
            punya cara menghubungi Anda, dan Google Play mensyaratkan kontak yang
            dapat dijangkau publik.
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-xs text-muted-foreground">
            Terakhir diubah {formatDateTime(profile.updated_at)}
            {profile.updated_by ? ` oleh ${profile.updated_by}` : ''}
          </p>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </div>
      </div>
    </EntitySection>
  );
}
