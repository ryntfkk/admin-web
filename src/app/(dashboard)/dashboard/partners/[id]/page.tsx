'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ExternalLink, Eye, EyeOff, Landmark, Pencil, ShieldOff, ShieldX, Trash2 } from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type { PartnerDetailRow } from '@/types/admin';
import { nstr } from '@/lib/sql';
import { formatDateTime } from '@/lib/format';
import { toast } from '@/lib/store/toastStore';
import { PARTNER_STATUS_LABELS, partnerStatusVariant } from '@/lib/enums';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldGrid } from '@/components/ui/field';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { EntityPage, EntitySection, type EntityTab } from '@/components/ui/entity-page';
import { DocumentsTab, PortfolioTab, ServicesTab, StrikesTab, WorkingHoursTab } from '../_components/PartnerTabs';

type VerifyAction = 'approve' | 'reject' | 'revoke' | 'delete' | 'editProfile' | 'editBank' | null;

export default function PartnerDetailPage() {
  const { id: partnerId } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [action, setAction] = useState<VerifyAction>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['partner-detail', partnerId],
    queryFn: async () => {
      const res = await fetchAPI<PartnerDetailRow>(`/admin/partners/${partnerId}`);
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const verify = useMutation({
    mutationFn: async (payload: { action: 'approve' | 'reject'; reason?: string }) => {
      const res = await fetchAPI(`/admin/partners/${partnerId}/verify`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: (_r, vars) => {
      toast.success(vars.action === 'approve' ? 'Mitra disetujui' : 'Verifikasi mitra dicabut');
      setAction(null);
      qc.invalidateQueries({ queryKey: ['partner-detail', partnerId] });
      qc.invalidateQueries({ queryKey: ['partners'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // F3: revoke-verification endpoint — set status ke 'pending' (bukan 'rejected')
  // supaya mitra bisa edit data verifikasi yang terkunci guard F1 lalu re-submit.
  // Berbeda dari verify{action:'reject'} yang set ke 'rejected' (mitra blocked).
  const revoke = useMutation({
    mutationFn: async (reason: string) => {
      const res = await fetchAPI(`/admin/partners/${partnerId}/revoke-verification`, {
        method: 'PUT',
        body: JSON.stringify({ reason }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Verifikasi dicabut — mitra dapat mengedit data lalu mengajukan ulang');
      setAction(null);
      qc.invalidateQueries({ queryKey: ['partner-detail', partnerId] });
      qc.invalidateQueries({ queryKey: ['partners'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = data?.verification_status;
  const isApproved = status === 'approved';

  const remove = useMutation({
    mutationFn: async (reason: string) => {
      const res = await fetchAPI(`/admin/partners/${partnerId}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Mitra dihapus');
      qc.invalidateQueries({ queryKey: ['partners'] });
      router.push('/dashboard/partners');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tabs: EntityTab[] = data
    ? [
        { id: 'profil', label: 'Profil', content: <ProfileTab partner={data} /> },
        { id: 'identitas', label: 'KTP & Selfie', content: <IdentityTab partner={data} /> },
        { id: 'dokumen', label: 'Dokumen', content: <DocumentsTab partnerId={partnerId} /> },
        { id: 'layanan', label: 'Layanan', content: <ServicesTab partnerId={partnerId} /> },
        { id: 'portfolio', label: 'Portfolio', content: <PortfolioTab partnerId={partnerId} /> },
        { id: 'jadwal', label: 'Jam Operasional', content: <WorkingHoursTab partnerId={partnerId} /> },
        { id: 'strike', label: 'Strike', content: <StrikesTab partnerId={partnerId} /> },
      ]
    : [];

  return (
    <>
      <EntityPage
        backHref="/dashboard/partners"
        backLabel="Semua mitra"
        isLoading={isLoading}
        error={error}
        title={data?.name ?? '—'}
        subtitle={
          data && (
            <span>
              {nstr(data.phone) || nstr(data.email) || 'tanpa kontak'} · mendaftar{' '}
              {formatDateTime(data.submitted_at)}
            </span>
          )
        }
        badges={
          status && (
            <Badge variant={partnerStatusVariant(status)}>
              {PARTNER_STATUS_LABELS[status] || status}
            </Badge>
          )
        }
        actions={
          data && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/dashboard/users/${data.user_id}`)}
              >
                Akun pengguna
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAction('editProfile')}>
                <Pencil className="size-4" />
                Edit profil
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAction('editBank')}>
                <Landmark className="size-4" />
                Rekening
              </Button>
              {/* Keputusan verifikasi tidak lagi satu arah: backend memang tidak
                  mengunci status, dulu hanya UI yang menyembunyikan tombolnya
                  begitu keputusan diambil — sehingga salah klik tak bisa dikoreksi. */}
              {!isApproved && (
                <Button size="sm" onClick={() => setAction('approve')} disabled={verify.isPending}>
                  <Check className="size-4" />
                  {status === 'rejected' ? 'Tinjau ulang & setujui' : 'Setujui'}
                </Button>
              )}
              {/* F3: "Cabut verifikasi" (revoke → pending) hanya untuk mitra approved.
                  Berbeda dari "Tolak" (reject → rejected) untuk mitra pending. */}
              {isApproved && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setAction('revoke')}
                  disabled={revoke.isPending}
                >
                  <ShieldOff className="size-4" />
                  Cabut verifikasi
                </Button>
              )}
              {!isApproved && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setAction('reject')}
                  disabled={verify.isPending}
                >
                  <ShieldX className="size-4" />
                  Tolak
                </Button>
              )}
              <Button variant="destructive" size="sm" onClick={() => setAction('delete')}>
                <Trash2 className="size-4" />
                Hapus
              </Button>
            </>
          )
        }
        tabs={tabs}
      />

      {data && action === 'editProfile' && (
        <EditPartnerProfileDialog
          partner={data}
          onClose={() => setAction(null)}
          onSaved={() => {
            setAction(null);
            qc.invalidateQueries({ queryKey: ['partner-detail', partnerId] });
          }}
        />
      )}

      {data && action === 'editBank' && (
        <EditPartnerBankDialog
          partner={data}
          onClose={() => setAction(null)}
          onSaved={() => {
            setAction(null);
            qc.invalidateQueries({ queryKey: ['partner-detail', partnerId] });
          }}
        />
      )}

      <ConfirmDialog
        open={action === 'delete'}
        onClose={() => setAction(null)}
        onConfirm={(reason) => remove.mutate(reason)}
        variant="danger"
        title="Hapus mitra ini?"
        description="Mitra hilang dari pencarian dan tidak bisa menerima pesanan baru (soft delete). Order yang sedang berjalan sengaja tidak disentuh — pembatalannya punya alur uang tersendiri."
        confirmLabel="Hapus mitra"
        requireReason
        confirmPhrase={data?.name}
        loading={remove.isPending}
      />

      <ConfirmDialog
        open={action === 'approve'}
        onClose={() => setAction(null)}
        onConfirm={() => verify.mutate({ action: 'approve' })}
        title="Setujui verifikasi mitra?"
        description="Mitra akan langsung dapat menerima pesanan. Jadwal operasional default (Sen–Jum 08–17) ikut dibuatkan bila belum ada."
        confirmLabel="Setujui"
        loading={verify.isPending}
      />

      <ConfirmDialog
        open={action === 'reject'}
        onClose={() => setAction(null)}
        onConfirm={(reason) => verify.mutate({ action: 'reject', reason })}
        variant="danger"
        title="Tolak pendaftaran mitra?"
        description="Alasan dikirim ke mitra dan tercatat di audit log. Mitra berstatus 'rejected' tidak bisa re-submit langsung — perlu admin tinjau ulang."
        confirmLabel="Tolak"
        requireReason
        reasonLabel="Alasan"
        reasonPlaceholder="Jelaskan alasan yang akan dikirim ke mitra…"
        loading={verify.isPending}
      />

      {/* F3: revoke-verification — set status ke 'pending' (bukan 'rejected').
          Mitra lalu bisa edit data verifikasi yang terkunci guard F1
          (basecamp, rekening, dokumen APPROVED) lalu ajukan verifikasi ulang. */}
      <ConfirmDialog
        open={action === 'revoke'}
        onClose={() => setAction(null)}
        onConfirm={(reason) => revoke.mutate(reason)}
        variant="danger"
        title="Cabut verifikasi mitra?"
        description="Status mitra kembali ke 'pending'. Mitra dapat mengedit data verifikasi yang terkunci (basecamp, rekening, dokumen) lalu mengajukan verifikasi ulang. Alasan dikirim ke mitra dan tercatat di audit log."
        confirmLabel="Cabut verifikasi"
        requireReason
        reasonLabel="Alasan"
        reasonPlaceholder="Jelaskan alasan yang akan dikirim ke mitra…"
        // Mencabut mitra yang sudah aktif memutus pendapatannya — minta admin
        // mengetik ulang namanya supaya tidak terjadi karena salah klik.
        confirmPhrase={data?.name}
        loading={revoke.isPending}
      />
    </>
  );
}

function ProfileTab({ partner }: { partner: PartnerDetailRow }) {
  const [showKtp, setShowKtp] = useState(false);
  const ktp = nstr(partner.decrypted_ktp);

  return (
    <div className="space-y-4">
      <EntitySection title="Identitas">
        <FieldGrid columns={3}>
          <Field label="Nama" value={partner.name} />
          <Field label="Telepon" value={nstr(partner.phone)} />
          <Field label="Email" value={nstr(partner.email)} />
          <Field label="Akun terdaftar" value={formatDateTime(partner.user_created_at)} />
          <Field label="Ajukan mitra" value={formatDateTime(partner.submitted_at)} />
          <Field
            label="NIK (KTP)"
            mono
            value={
              ktp ? (
                <span className="flex items-center gap-2">
                  {showKtp ? ktp : '•'.repeat(Math.min(ktp.length, 16))}
                  <button
                    type="button"
                    onClick={() => setShowKtp((v) => !v)}
                    aria-label={showKtp ? 'Sembunyikan NIK' : 'Tampilkan NIK'}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {showKtp ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </span>
              ) : null
            }
          />
          <Field label="Partner ID" value={partner.partner_id} mono />
        </FieldGrid>
      </EntitySection>

      <EntitySection
        title="Rekening pencairan"
        description="Dipakai saat memproses penarikan saldo mitra."
      >
        <FieldGrid columns={3}>
          <Field label="Bank" value={nstr(partner.bank_code)} />
          <Field label="No. rekening" value={nstr(partner.bank_account_number)} mono />
          <Field label="Atas nama" value={nstr(partner.bank_account_name)} />
        </FieldGrid>
      </EntitySection>

      {/* F4: Basecamp & area layanan — data verifikasi yang terkunci guard F1.
          Admin butuh lihat ini sebelum approve/revoke. */}
      <EntitySection
        title="Basecamp & Area Layanan"
        description="Data verifikasi. Mitra approved tidak bisa mengubah tanpa admin revoke (F1/F3)."
      >
        <FieldGrid columns={3}>
          <Field label="Provinsi" value={nstr(partner.province)} />
          <Field label="Kota/Kabupaten" value={nstr(partner.city)} />
          <Field label="Kecamatan" value={nstr(partner.district)} />
          <Field label="Detail alamat" value={nstr(partner.address_detail)} />
          <Field
            label="Koordinat basecamp"
            value={
              partner.basecamp_lat || partner.basecamp_lon
                ? `${partner.basecamp_lat.toFixed(6)}, ${partner.basecamp_lon.toFixed(6)}`
                : 'Belum diatur'
            }
            mono
          />
          <Field
            label="Area layanan"
            value={partner.service_area?.length ? partner.service_area.join(', ') : 'Belum diatur'}
          />
        </FieldGrid>
      </EntitySection>

      {/* F4: Statistik performa mitra */}
      <EntitySection title="Statistik Performa">
        <FieldGrid columns={3}>
          <Field label="Rating rata-rata" value={partner.avg_rating || '0.00'} />
          <Field label="Total ulasan" value={String(partner.total_reviews)} />
          <Field label="Total pesanan" value={String(partner.total_orders)} />
          <Field label="Strike" value={String(partner.strike_count)} />
        </FieldGrid>
      </EntitySection>

      {nstr(partner.bio) && (
        <EntitySection title="Bio">
          <p className="text-sm whitespace-pre-wrap">{nstr(partner.bio)}</p>
        </EntitySection>
      )}

      {nstr(partner.rejection_reason) && (
        <EntitySection title="Alasan penolakan terakhir">
          <p className="text-sm text-destructive">{nstr(partner.rejection_reason)}</p>
        </EntitySection>
      )}
    </div>
  );
}

function IdentityTab({ partner }: { partner: PartnerDetailRow }) {
  return (
    <EntitySection
      title="KTP & selfie"
      description="Diunggah saat pendaftaran mitra. Klik gambar untuk membuka ukuran penuh di tab baru."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <DocImage label="Foto KTP" url={nstr(partner.ktp_photo_url)} />
        <DocImage label="Selfie dengan KTP" url={nstr(partner.selfie_ktp_url)} />
      </div>
    </EntitySection>
  );
}

function DocImage({ label, url }: { label: string; url: string | null }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative block overflow-hidden rounded-lg border border-border"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className="h-56 w-full object-cover" />
          <span className="absolute right-1.5 top-1.5 rounded bg-black/60 p-1 text-white">
            <ExternalLink className="size-3.5" />
          </span>
        </a>
      ) : (
        <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
          Tidak ada dokumen
        </div>
      )}
    </div>
  );
}

function EditPartnerProfileDialog({
  partner,
  onClose,
  onSaved,
}: {
  partner: PartnerDetailRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [bio, setBio] = useState(nstr(partner.bio) ?? '');

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI(`/admin/partners/${partner.partner_id}`, {
        method: 'PUT',
        body: JSON.stringify({ bio }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Profil mitra diperbarui');
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal open onClose={onClose} title="Edit Profil Mitra">
      <div className="space-y-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="partner-bio">Bio</Label>
          <Textarea
            id="partner-bio"
            rows={5}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Deskripsi singkat mitra yang tampil di aplikasi pelanggan…"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function EditPartnerBankDialog({
  partner,
  onClose,
  onSaved,
}: {
  partner: PartnerDetailRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    bank_code: nstr(partner.bank_code) ?? '',
    bank_account_number: nstr(partner.bank_account_number) ?? '',
    bank_account_name: nstr(partner.bank_account_name) ?? '',
  });

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI(`/admin/partners/${partner.partner_id}/bank`, {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Rekening mitra diperbarui');
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal open onClose={onClose} title="Rekening Pencairan">
      <div className="space-y-3">
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-xs text-warning">
          Rekening ini menentukan ke mana uang pencairan mitra dikirim. Nilai lama disimpan di audit
          log setiap kali diubah.
        </p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bank-code">Kode bank</Label>
          <Input
            id="bank-code"
            value={form.bank_code}
            onChange={(e) => setForm((f) => ({ ...f, bank_code: e.target.value }))}
            placeholder="mis. BCA"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bank-number">Nomor rekening</Label>
          <Input
            id="bank-number"
            value={form.bank_account_number}
            onChange={(e) => setForm((f) => ({ ...f, bank_account_number: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bank-name">Atas nama</Label>
          <Input
            id="bank-name"
            value={form.bank_account_name}
            onChange={(e) => setForm((f) => ({ ...f, bank_account_name: e.target.value }))}
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Menyimpan…' : 'Simpan rekening'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
