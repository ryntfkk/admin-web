'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Ban, Check, ExternalLink, Eye, EyeOff, Landmark, Pencil, ShieldCheck, ShieldOff, ShieldX, Trash2 } from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type {
  PartnerDetailRow,
  PartnerType,
  UpdatePartnerIdentityPayload,
  VerificationChecklist,
} from '@/types/admin';
import { ENTITY_FORMS } from '@/types/admin';
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
import { ActionLogsTab, DocumentsTab, PortfolioTab, ServicesTab, StrikesTab, WorkingHoursTab } from '../_components/PartnerTabs';
import {
  PartnerDisputesTab,
  PartnerOrdersTab,
  PartnerPerformanceTab,
  PartnerReviewsTab,
  PartnerWithdrawalsTab,
} from '../_components/PartnerActivityTabs';

type VerifyAction = 'approve' | 'reject' | 'revoke' | 'suspend' | 'unsuspend' | 'delete' | 'editProfile' | 'editBank' | 'editIdentity' | null;

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

  // V4 §7.2.4: checklist dokumen wajib. Aturannya milik backend — halaman ini
  // hanya merendernya, supaya tidak melenceng dari gate approve yang sebenarnya.
  const { data: checklist } = useQuery({
    queryKey: ['partner-checklist', partnerId],
    queryFn: async () => {
      const res = await fetchAPI<VerificationChecklist>(
        `/admin/partners/${partnerId}/verification-checklist`,
      );
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

  // F4: suspend/unsuspend mitra (pakai endpoint user, mitra = user dengan role partner).
  // Suspend mencabut sesi aktif langsung — mitra tidak bisa login/menerima pesanan.
  const suspend = useMutation({
    mutationFn: async (payload: { duration_hours: number; reason: string }) => {
      const res = await fetchAPI(`/admin/users/${data?.user_id}/suspend`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Mitra di-suspend');
      setAction(null);
      qc.invalidateQueries({ queryKey: ['partner-detail', partnerId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unsuspend = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI(`/admin/users/${data?.user_id}/unsuspend`, {
        method: 'PUT',
        body: JSON.stringify({ notes: 'Reaktivasi mitra dari halaman partner detail' }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Mitra di-unsuspend');
      setAction(null);
      qc.invalidateQueries({ queryKey: ['partner-detail', partnerId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = data?.verification_status;
  const isApproved = status === 'approved';
  const isVendor = data?.partner_type === 'vendor';
  // Tombol Setujui dimatikan bila dokumen wajib belum lengkap. Ini cerminan UI
  // dari gate backend (A1) — backend tetap penegaknya, ini hanya supaya admin
  // tidak menabrak 409 tanpa tahu sebabnya. Saat checklist belum termuat,
  // tombol dibiarkan aktif: backend yang akan menolak bila memang kurang.
  const canApprove = checklist ? checklist.can_approve : true;
  const missingDocs = checklist?.missing ?? [];

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
        { id: 'profil', label: 'Profil', content: <ProfileTab partner={data} checklist={checklist} /> },
        { id: 'identitas', label: 'KTP & Selfie', content: <IdentityTab partner={data} /> },
        { id: 'dokumen', label: 'Dokumen', content: <DocumentsTab partnerId={partnerId} /> },
        { id: 'layanan', label: 'Layanan', content: <ServicesTab partnerId={partnerId} /> },
        { id: 'portfolio', label: 'Portfolio', content: <PortfolioTab partnerId={partnerId} /> },
        { id: 'jadwal', label: 'Jam Operasional', content: <WorkingHoursTab partnerId={partnerId} /> },
        // §11.1 — halaman ini akhirnya jadi workspace operasional, bukan hanya
        // layar KYC: aktivitas mitra bisa dibaca tanpa berpindah halaman.
        { id: 'pesanan', label: 'Pesanan', content: <PartnerOrdersTab partnerId={partnerId} /> },
        { id: 'ulasan', label: 'Ulasan', content: <PartnerReviewsTab partnerId={partnerId} /> },
        {
          id: 'pencairan',
          label: 'Pencairan',
          content: <PartnerWithdrawalsTab userId={data.user_id} />,
        },
        { id: 'sengketa', label: 'Sengketa', content: <PartnerDisputesTab partnerId={partnerId} /> },
        {
          id: 'performa',
          label: 'Performa',
          content: <PartnerPerformanceTab partnerId={partnerId} />,
        },
        { id: 'strike', label: 'Strike', content: <StrikesTab partnerId={partnerId} /> },
        { id: 'aksi', label: 'Riwayat Aksi', content: <ActionLogsTab partnerId={partnerId} /> },
      ]
    : [];

  return (
    <>
      <EntityPage
        backHref="/dashboard/partners"
        backLabel="Semua mitra"
        isLoading={isLoading}
        error={error}
        /* V4 §7.2.2: judul = nama yang DILIHAT PELANGGAN. Untuk vendor itu nama
           merek; nama legal & nama PIC muncul di subtitle. Admin yang memverifikasi
           harus melihat ketiganya bersamaan — tanpa itu ia menyetujui "PT Bersih
           Jaya" sambil hanya membaca "Budi Santoso". */
        title={(data && (nstr(data.display_name) || data.name)) ?? '—'}
        subtitle={
          data && (
            <span>
              {isVendor && (
                <>
                  <strong>{nstr(data.legal_entity_name) || '—'}</strong>
                  {nstr(data.entity_form) ? ` · ${nstr(data.entity_form)}` : ''} · PIC:{' '}
                  {nstr(data.pic_name) || data.name}
                  {' · '}
                </>
              )}
              {nstr(data.phone) || nstr(data.email) || 'tanpa kontak'} · mendaftar{' '}
              {formatDateTime(data.submitted_at)}
            </span>
          )
        }
        badges={
          <>
            {status && (
              <Badge variant={partnerStatusVariant(status)}>
                {PARTNER_STATUS_LABELS[status] || status}
              </Badge>
            )}
            {data && (
              <Badge variant={isVendor ? 'info' : 'neutral'}>
                {isVendor ? 'Badan Usaha' : 'Perorangan'}
              </Badge>
            )}
          </>
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
              <Button variant="outline" size="sm" onClick={() => setAction('editIdentity')}>
                <BadgeCheck className="size-4" />
                Edit identitas
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAction('editBank')}>
                <Landmark className="size-4" />
                Rekening
              </Button>
              {/* Keputusan verifikasi tidak lagi satu arah: backend memang tidak
                  mengunci status, dulu hanya UI yang menyembunyikan tombolnya
                  begitu keputusan diambil — sehingga salah klik tak bisa dikoreksi. */}
              {!isApproved && (
                <Button
                  size="sm"
                  onClick={() => setAction('approve')}
                  disabled={verify.isPending || !canApprove}
                  title={
                    canApprove
                      ? undefined
                      : `Dokumen wajib belum disetujui: ${missingDocs.join(', ')}`
                  }
                >
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
              {/* F4: Suspend/Unsuspend — pakai endpoint user (mitra = user). */}
              <Button variant="destructive" size="sm" onClick={() => setAction('suspend')}>
                <Ban className="size-4" />
                Suspend
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAction('unsuspend')}>
                <ShieldCheck className="size-4" />
                Unsuspend
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setAction('delete')}>
                <Trash2 className="size-4" />
                Hapus
              </Button>
            </>
          )
        }
        tabs={tabs}
      />

      {data && action === 'editIdentity' && (
        <EditPartnerIdentityDialog
          partner={data}
          onClose={() => setAction(null)}
          onSaved={() => {
            setAction(null);
            qc.invalidateQueries({ queryKey: ['partner-detail', partnerId] });
            qc.invalidateQueries({ queryKey: ['partner-checklist', partnerId] });
            qc.invalidateQueries({ queryKey: ['partners'] });
          }}
        />
      )}

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

      {/* F4: Suspend mitra — duration 0 = permanen sampai unsuspend. */}
      <ConfirmDialog
        open={action === 'suspend'}
        onClose={() => setAction(null)}
        onConfirm={(reason) => suspend.mutate({ duration_hours: 0, reason })}
        variant="danger"
        title="Suspend mitra?"
        description="Mitra tidak bisa login/menerima pesanan. Sesi aktif langsung dicabut. Berlaku permanen sampai di-unsuspend. Alasan tercatat di audit log."
        confirmLabel="Suspend"
        requireReason
        reasonLabel="Alasan"
        reasonPlaceholder="Jelaskan alasan suspend…"
        confirmPhrase={data?.name}
        loading={suspend.isPending}
      />

      <ConfirmDialog
        open={action === 'unsuspend'}
        onClose={() => setAction(null)}
        onConfirm={() => unsuspend.mutate()}
        title="Unsuspend mitra?"
        description="Mitra dapat login kembali dan menerima pesanan. Sesi denylist dicabut."
        confirmLabel="Unsuspend"
        loading={unsuspend.isPending}
      />
    </>
  );
}

function ProfileTab({
  partner,
  checklist,
}: {
  partner: PartnerDetailRow;
  checklist?: VerificationChecklist;
}) {
  const [showKtp, setShowKtp] = useState(false);
  const [showNpwp, setShowNpwp] = useState(false);
  const ktp = nstr(partner.decrypted_ktp);
  const isVendor = partner.partner_type === 'vendor';

  // §7.2.5: nama rekening vs nama legal. Ejaan rekening bank sering berbeda
  // ("PT" disingkat, nama dipotong), jadi ini PERINGATAN saja — bukan penolakan.
  // Keputusan tetap milik admin yang memegang dokumennya.
  const expectedName = isVendor ? nstr(partner.legal_entity_name) : partner.name;
  const bankName = nstr(partner.bank_account_name);
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const bankNameMismatch =
    !!bankName && !!expectedName && !normalize(bankName).includes(normalize(expectedName).slice(0, 8));

  return (
    <div className="space-y-4">
      {checklist && !checklist.can_approve && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-medium">Belum bisa disetujui — dokumen wajib belum lengkap</p>
          <ul className="mt-1 list-inside list-disc">
            {checklist.items
              .filter((i) => !i.satisfied)
              .map((i) => (
                <li key={i.doc_type}>
                  {i.label} —{' '}
                  {i.status === 'MISSING' ? 'belum diunggah' : `status ${i.status}`}
                </li>
              ))}
          </ul>
          <p className="mt-2 text-xs">
            Setujui dokumennya di tab <strong>Dokumen</strong> terlebih dulu.
          </p>
        </div>
      )}

      {isVendor && (
        <EntitySection
          title="Data Badan Usaha"
          description="Identitas hukum mitra. Hanya bisa diubah lewat tombol Edit identitas — mitra tidak dapat mengubahnya sendiri."
        >
          <FieldGrid columns={3}>
            <Field label="Nama tampil (dilihat pelanggan)" value={nstr(partner.display_name)} />
            <Field label="Nama badan hukum" value={nstr(partner.legal_entity_name)} />
            <Field label="Bentuk badan usaha" value={nstr(partner.entity_form)} />
            <Field label="NIB" value={nstr(partner.nib)} mono />
            <Field
              label="NPWP"
              mono
              value={
                partner.decrypted_npwp ? (
                  <span className="flex items-center gap-2">
                    {showNpwp ? partner.decrypted_npwp : '•'.repeat(partner.decrypted_npwp.length)}
                    <button
                      type="button"
                      onClick={() => setShowNpwp((v) => !v)}
                      aria-label={showNpwp ? 'Sembunyikan NPWP' : 'Tampilkan NPWP'}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {showNpwp ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </span>
                ) : null
              }
            />
            <Field label="PIC" value={nstr(partner.pic_name)} />
            <Field label="Jabatan PIC" value={nstr(partner.pic_position)} />
            <Field label="Telepon usaha" value={nstr(partner.business_phone)} />
            <Field label="Email usaha" value={nstr(partner.business_email)} />
          </FieldGrid>
        </EntitySection>
      )}

      <EntitySection title="Identitas">
        <FieldGrid columns={3}>
          <Field
            label={isVendor ? 'Nama PIC (pemegang akun)' : 'Nama'}
            value={partner.name}
          />
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
        {bankNameMismatch && (
          <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Nama rekening <strong>{bankName}</strong> tidak mirip dengan{' '}
            {isVendor ? 'nama badan hukum' : 'nama mitra'} <strong>{expectedName}</strong>.
            Ejaan rekening bank memang sering berbeda — periksa dokumennya sebelum
            memutuskan, jangan langsung menolak.
          </p>
        )}
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

// V4 §7.2.7: satu-satunya jalur mengubah tipe mitra & identitas badan usaha.
// Mengubah tipe MENURUNKAN status verifikasi ke pending — peringatannya
// ditampilkan supaya admin tidak melakukannya tanpa sadar.
function EditPartnerIdentityDialog({
  partner,
  onClose,
  onSaved,
}: {
  partner: PartnerDetailRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<UpdatePartnerIdentityPayload>({
    partner_type: partner.partner_type,
    reason: '',
    display_name: nstr(partner.display_name) ?? '',
    legal_entity_name: nstr(partner.legal_entity_name) ?? '',
    entity_form: nstr(partner.entity_form) ?? '',
    npwp: '',
    nib: nstr(partner.nib) ?? '',
    pic_name: nstr(partner.pic_name) ?? '',
    pic_position: nstr(partner.pic_position) ?? '',
    business_phone: nstr(partner.business_phone) ?? '',
    business_email: nstr(partner.business_email) ?? '',
  });
  const set = <K extends keyof UpdatePartnerIdentityPayload>(
    k: K,
    v: UpdatePartnerIdentityPayload[K],
  ) => setForm((f) => ({ ...f, [k]: v }));

  const isVendor = form.partner_type === 'vendor';
  const typeChanged = form.partner_type !== partner.partner_type;

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI(`/admin/partners/${partner.partner_id}/identity`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success(
        typeChanged
          ? 'Identitas diperbarui. Status verifikasi turun ke pending.'
          : 'Identitas mitra diperbarui',
      );
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal open onClose={onClose} title="Edit Identitas Mitra">
      <div className="space-y-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ident-type">Tipe mitra</Label>
          <select
            id="ident-type"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={form.partner_type}
            onChange={(e) => set('partner_type', e.target.value as PartnerType)}
          >
            <option value="individual">Perorangan</option>
            <option value="vendor">Badan Usaha / Vendor</option>
          </select>
        </div>

        {typeChanged && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Mengubah tipe mitra mengubah subjek hukum kontrak, jadi status
            verifikasi otomatis turun ke <strong>pending</strong> dan mitra harus
            diverifikasi ulang. Mitra akan menerima notifikasi.
          </p>
        )}

        {isVendor && (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ident-display">Nama tampil (dilihat pelanggan)</Label>
              <Input
                id="ident-display"
                value={form.display_name}
                onChange={(e) => set('display_name', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ident-legal">Nama badan hukum</Label>
              <Input
                id="ident-legal"
                value={form.legal_entity_name}
                onChange={(e) => set('legal_entity_name', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ident-form">Bentuk badan usaha</Label>
              <select
                id="ident-form"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.entity_form}
                onChange={(e) => set('entity_form', e.target.value)}
              >
                <option value="">— pilih —</option>
                {ENTITY_FORMS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ident-npwp">NPWP (kosongkan bila tidak diubah)</Label>
              <Input
                id="ident-npwp"
                value={form.npwp}
                onChange={(e) => set('npwp', e.target.value)}
                placeholder="Tersimpan terenkripsi — nilai lama tidak ditampilkan"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ident-nib">NIB</Label>
              <Input id="ident-nib" value={form.nib} onChange={(e) => set('nib', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ident-pic">Nama PIC</Label>
              <Input
                id="ident-pic"
                value={form.pic_name}
                onChange={(e) => set('pic_name', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ident-picpos">Jabatan PIC</Label>
              <Input
                id="ident-picpos"
                value={form.pic_position}
                onChange={(e) => set('pic_position', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ident-bphone">Telepon usaha</Label>
              <Input
                id="ident-bphone"
                value={form.business_phone}
                onChange={(e) => set('business_phone', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ident-bemail">Email usaha</Label>
              <Input
                id="ident-bemail"
                value={form.business_email}
                onChange={(e) => set('business_email', e.target.value)}
              />
            </div>
          </>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ident-reason">Alasan perubahan (wajib)</Label>
          <Textarea
            id="ident-reason"
            rows={3}
            value={form.reason}
            onChange={(e) => set('reason', e.target.value)}
            placeholder="Tercatat di audit log…"
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !form.reason.trim()}
          >
            Simpan identitas
          </Button>
        </div>
      </div>
    </Modal>
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
