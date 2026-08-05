'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type { PlatformSettings } from '@/types/admin';
import { formatDateTime, formatIDR } from '@/lib/format';
import { toast } from '@/lib/store/toastStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EntitySection } from '@/components/ui/entity-page';
import { CenteredSpinner } from '@/components/ui/feedback';
import ProfileForm from './_components/ProfileForm';

export default function SettingsPage() {
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: async () => {
      const res = await fetchAPI<PlatformSettings>('/admin/settings');
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Setelan Platform</h1>
        <p className="text-sm text-muted-foreground">
          Tarif dan batas yang dipakai seluruh sistem. Perubahan berlaku seketika . tanpa deploy
          ulang.
        </p>
      </div>

      {isLoading ? (
        <CenteredSpinner />
      ) : error || !data ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : 'Gagal memuat setelan.'}
        </div>
      ) : (
        // `key` mereset form ke nilai server setiap kali data berubah.
        <SettingsForm
          key={data.updated_at}
          settings={data}
          onSaved={() => qc.invalidateQueries({ queryKey: ['platform-settings'] })}
        />
      )}
    </div>
  );
}

function SettingsForm({
  settings,
  onSaved,
}: {
  settings: PlatformSettings;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    base_transport_fee: String(settings.base_transport_fee),
    transport_fee_per_km: String(settings.transport_fee_per_km),
    admin_fee: String(settings.admin_fee),
    // Disimpan sebagai pecahan (0.12) tapi diedit sebagai persen (12) . admin
    // berpikir dalam persen, bukan pecahan.
    platform_fee_percent: String(Math.round(settings.platform_fee_rate * 10000) / 100),
    min_transaction: String(settings.min_transaction),
    withdrawal_fee: String(settings.withdrawal_fee),
    max_withdrawal: String(settings.max_withdrawal),
    max_wallet_adjustment: String(settings.max_wallet_adjustment),
    max_additional_fee: String(settings.max_additional_fee),
  });
  // Sakelar penegakan persyaratan . bukan angka, jadi di luar `form` yang
  // seluruhnya string numerik.
  const [requireReqAck, setRequireReqAck] = useState(settings.require_requirements_ack ?? false);
  const [confirming, setConfirming] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      const percent = Number(form.platform_fee_percent);
      if (Number.isNaN(percent) || percent < 0 || percent > 100) {
        throw new Error('Komisi platform harus antara 0 dan 100 persen');
      }
      const numbers = {
        base_transport_fee: Number(form.base_transport_fee),
        transport_fee_per_km: Number(form.transport_fee_per_km),
        admin_fee: Number(form.admin_fee),
        min_transaction: Number(form.min_transaction),
        withdrawal_fee: Number(form.withdrawal_fee),
        max_withdrawal: Number(form.max_withdrawal),
        max_wallet_adjustment: Number(form.max_wallet_adjustment),
        max_additional_fee: Number(form.max_additional_fee),
      };
      for (const [key, value] of Object.entries(numbers)) {
        if (Number.isNaN(value) || value < 0) throw new Error(`Nilai ${key} tidak valid`);
      }
      if (numbers.max_withdrawal <= numbers.withdrawal_fee) {
        throw new Error('Maksimum penarikan harus lebih besar dari biaya penarikan');
      }

      const res = await fetchAPI('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          ...numbers,
          platform_fee_rate: percent / 100,
          require_requirements_ack: requireReqAck,
        }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Setelan platform disimpan');
      setConfirming(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function field(
    key: keyof typeof form,
    label: string,
    hint?: string,
    suffix?: string,
  ) {
    const numeric = Number(form[key]);
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`set-${key}`}>{label}</Label>
        <div className="flex items-center gap-2">
          <Input
            id={`set-${key}`}
            type="number"
            min="0"
            value={form[key]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          />
          {suffix && <span className="shrink-0 text-sm text-muted-foreground">{suffix}</span>}
        </div>
        <p className="text-xs text-muted-foreground">
          {hint}
          {!suffix && !Number.isNaN(numeric) && numeric > 0 && ` · ${formatIDR(numeric)}`}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <EntitySection
          title="Komisi & biaya"
          description="Dipakai saat menghitung harga pesanan dan bagi hasil mitra."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {field(
              'platform_fee_percent',
              'Komisi platform',
              'Potongan dari harga layanan sebelum masuk saldo mitra.',
              '%',
            )}
            {field('admin_fee', 'Biaya admin per pesanan', 'Ditagihkan ke pelanggan.')}
            {field('base_transport_fee', 'Biaya transport dasar', 'Tarif awal sebelum per-km.')}
            {field('transport_fee_per_km', 'Biaya transport per km', 'Dikalikan jarak tempuh.')}
            {field('min_transaction', 'Minimum transaksi', 'Total layanan di bawah ini ditolak.')}
          </div>
        </EntitySection>

        <EntitySection title="Penarikan saldo" description="Batas yang berlaku untuk mitra.">
          <div className="grid gap-4 sm:grid-cols-2">
            {field('withdrawal_fee', 'Biaya penarikan', 'Dipotong dari nominal yang ditarik.')}
            {field('max_withdrawal', 'Maksimum penarikan', 'Per satu permintaan penarikan.')}
          </div>
        </EntitySection>

        <EntitySection
          title="Pengaman aksi admin"
          description="Panel admin hanya punya satu tingkat hak akses, jadi plafon nominal inilah pengaman terhadap salah ketik."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {field(
              'max_wallet_adjustment',
              'Batas penyesuaian saldo sekali aksi',
              'Penyesuaian saldo manual di atas nilai ini ditolak backend.',
            )}
            {field(
              'max_additional_fee',
              'Batas biaya tambahan per item',
              'Plafon tagihan tambahan yang boleh diajukan mitra; menahan salah ketik nol.',
            )}
          </div>
        </EntitySection>

        <EntitySection
          title="Persyaratan pelanggan"
          description="Persyaratan yang harus disiapkan pelanggan sebelum mitra datang (mis. stop kontak, sumber air)."
        >
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={requireReqAck}
              onChange={(e) => setRequireReqAck(e.target.checked)}
              className="mt-1 size-4 shrink-0"
            />
            <span className="text-sm">
              <span className="font-medium">Wajibkan persetujuan sebelum bayar</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Bila aktif, pesanan yang memuat persyaratan <strong>wajib</strong> ditolak
                (400) bila pelanggan belum menyetujuinya. Nyalakan hanya setelah aplikasi
                web/mobile terbaru benar-benar mengirim persetujuan itu . versi lama akan
                gagal memesan seluruhnya. Bisa dimatikan lagi kapan saja tanpa deploy.
              </span>
            </span>
          </label>
        </EntitySection>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Terakhir diubah {formatDateTime(settings.updated_at)}
            {settings.updated_by && ` oleh ${settings.updated_by}`}
          </p>
          <Button onClick={() => setConfirming(true)}>Simpan setelan</Button>
        </div>

        {/* Identitas & kontak . disimpan terpisah (tabel platform_profile),
            jadi punya tombol Simpan sendiri. */}
        <ProfileForm />
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => save.mutate()}
        variant="danger"
        title="Terapkan setelan baru?"
        description="Tarif ini langsung dipakai untuk SEMUA pesanan dan penarikan berikutnya di seluruh platform. Pesanan yang sudah berjalan memakai tarif lama yang tersimpan di pesanan itu."
        confirmLabel="Terapkan"
        requireReason
        reasonLabel="Alasan perubahan"
        reasonPlaceholder="mis. Penyesuaian komisi mulai kuartal ini"
        confirmPhrase="SETELAN"
        loading={save.isPending}
      />
    </>
  );
}
