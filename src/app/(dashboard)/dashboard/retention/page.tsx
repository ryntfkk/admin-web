'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ShieldAlert, Trash2 } from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type { RetentionStatusRow, PurgeRunRow, RetentionCategory } from '@/types/admin';
import { formatDateTime } from '@/lib/format';
import { toast } from '@/lib/store/toastStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { EntitySection } from '@/components/ui/entity-page';
import { CenteredSpinner } from '@/components/ui/feedback';

// Halaman paling merusak di panel ini: ia menghapus data secara PERMANEN.
//
// Karena itu alurnya sengaja berlapis . kebijakan harus diaktifkan dulu, jumlah
// kandidat ditampilkan sebelum aksi, dan pemusnahan menuntut frasa konfirmasi.
// Backend menegakkan ketiganya; UI hanya mencerminkannya.
const FRASA_KONFIRMASI = 'MUSNAHKAN';

export default function RetentionPage() {
  const qc = useQueryClient();
  const [purging, setPurging] = useState<RetentionStatusRow | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['retention-status'],
    queryFn: async () => {
      const res = await fetchAPI<{ categories: RetentionStatusRow[]; max_rows_per_purge: number }>('/admin/retention');
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const { data: runs } = useQuery({
    queryKey: ['retention-runs'],
    queryFn: async () => {
      const res = await fetchAPI<PurgeRunRow[]>('/admin/retention/runs?limit=20');
      return res.success && res.data ? res.data : [];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['retention-status'] });
    qc.invalidateQueries({ queryKey: ['retention-runs'] });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Masa Penyimpanan &amp; Pemusnahan Data</h1>
        <p className="text-sm text-muted-foreground">
          Menepati janji di Kebijakan Privasi bahwa data dimusnahkan setelah masa
          penyimpanan berakhir. Sistem hanya <strong>menghitung</strong> kandidat .
          pemusnahan selalu Anda yang memutuskan.
        </p>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <ShieldAlert className="mt-0.5 size-5 shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold">Pemusnahan bersifat permanen dan tidak dapat dibatalkan.</p>
          <p className="text-xs">
            Pastikan ada <strong>backup database terbaru</strong> sebelum menjalankannya.
            Data yang terkait sengketa yang belum selesai otomatis dilewati, tapi itu
            bukan pengganti pertimbangan Anda sendiri.
          </p>
        </div>
      </div>

      {isLoading ? (
        <CenteredSpinner />
      ) : error || !data ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : 'Gagal memuat status retensi.'}
        </div>
      ) : (
        <>
          {data.categories.map((row) => (
            <KategoriCard
              key={row.category}
              row={row}
              maxPerPurge={data.max_rows_per_purge}
              onSaved={refresh}
              onPurge={() => setPurging(row)}
            />
          ))}

          <EntitySection title="Riwayat Pemusnahan">
            {!runs || runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum pernah ada pemusnahan.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border text-sm">
                {runs.map((r, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 p-3">
                    <span className="font-medium">{r.category}</span>
                    <span className="text-muted-foreground">
                      {r.rows_deleted.toLocaleString('id-ID')} baris dihapus
                      {r.rows_skipped > 0 && `, ${r.rows_skipped.toLocaleString('id-ID')} dilewati`}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatDateTime(r.executed_at)} · {r.executed_by}
                    </span>
                    {r.note && <span className="w-full text-xs text-muted-foreground">Catatan: {r.note}</span>}
                  </li>
                ))}
              </ul>
            )}
          </EntitySection>
        </>
      )}

      {purging && (
        <PurgeModal
          row={purging}
          maxPerPurge={data?.max_rows_per_purge ?? 0}
          onClose={() => setPurging(null)}
          onDone={refresh}
        />
      )}
    </div>
  );
}

function KategoriCard({
  row,
  maxPerPurge,
  onSaved,
  onPurge,
}: {
  row: RetentionStatusRow;
  maxPerPurge: number;
  onSaved: () => void;
  onPurge: () => void;
}) {
  const [months, setMonths] = useState(String(row.retention_months));
  const [enabled, setEnabled] = useState(row.is_enabled);

  const simpan = useMutation({
    mutationFn: async (payload: { retention_months: number; is_enabled: boolean }) => {
      const res = await fetchAPI(`/admin/retention/${row.category}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => { toast.success('Kebijakan disimpan'); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const berubah = String(row.retention_months) !== months || row.is_enabled !== enabled;
  const bisaMusnahkan = row.is_enabled && row.candidates > 0;

  return (
    <EntitySection title={row.label}>
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Sumber: <code className="rounded bg-muted px-1">{row.sumber}</code> . {row.catatan}
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor={`m-${row.category}`}>Masa penyimpanan (bulan)</Label>
            <Input
              id={`m-${row.category}`}
              type="number"
              min={1}
              value={months}
              onChange={(e) => setMonths(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Batas waktu saat ini</Label>
            <p className="pt-2 text-sm">{formatDateTime(row.cutoff_at)}</p>
            <p className="text-xs text-muted-foreground">Data lebih tua dari ini jadi kandidat.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Kandidat</Label>
            <p className="pt-2 text-sm">
              <span className={row.candidates > 0 ? 'font-semibold text-destructive' : ''}>
                {row.candidates.toLocaleString('id-ID')}
              </span>{' '}
              baris
              {row.skipped > 0 && (
                <span className="text-muted-foreground"> · {row.skipped.toLocaleString('id-ID')} dilewati</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {row.oldest_at ? `Tertua: ${formatDateTime(row.oldest_at)}` : 'Belum ada yang melewati masa simpan.'}
            </p>
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="mt-0.5 size-4 rounded border-input"
          />
          <span>
            Aktifkan kebijakan ini
            <span className="block text-xs text-muted-foreground">
              Selama mati, tombol musnahkan ditolak backend . bahkan bila kandidatnya ada.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {row.updated_by ? `Diubah ${formatDateTime(row.updated_at)} oleh ${row.updated_by}` : 'Belum pernah diubah'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!berubah || simpan.isPending}
              onClick={() => simpan.mutate({ retention_months: Number(months), is_enabled: enabled })}
            >
              {simpan.isPending ? 'Menyimpan…' : 'Simpan kebijakan'}
            </Button>
            <Button variant="destructive" size="sm" disabled={!bisaMusnahkan} onClick={onPurge}>
              <Trash2 className="mr-1 size-4" /> Musnahkan
            </Button>
          </div>
        </div>

        {row.candidates > maxPerPurge && (
          <p className="text-xs text-muted-foreground">
            Satu kali eksekusi menghapus maksimal {maxPerPurge.toLocaleString('id-ID')} baris.
            Jalankan berulang sampai kandidat habis.
          </p>
        )}
      </div>
    </EntitySection>
  );
}

function PurgeModal({
  row,
  maxPerPurge,
  onClose,
  onDone,
}: {
  row: RetentionStatusRow;
  maxPerPurge: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [frasa, setFrasa] = useState('');
  const [note, setNote] = useState('');

  const akanDihapus = Math.min(row.candidates, maxPerPurge);

  const musnahkan = useMutation({
    mutationFn: async () => {
      const res = await fetchAPI<{ rows_deleted: number; remaining: number }>(
        `/admin/retention/${row.category}/purge`,
        { method: 'POST', body: JSON.stringify({ confirm: FRASA_KONFIRMASI, note }) },
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
    onSuccess: (d) => {
      toast.success(`${d.rows_deleted.toLocaleString('id-ID')} baris dimusnahkan. Sisa ${d.remaining.toLocaleString('id-ID')}.`);
      onDone();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal open onClose={onClose} title={`Musnahkan ${row.label}?`} className="max-w-lg">
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">
              {akanDihapus.toLocaleString('id-ID')} baris akan dihapus permanen.
            </p>
            <p className="mt-1 text-xs">
              Data lebih tua dari {formatDateTime(row.cutoff_at)}. Tidak ada cara
              mengembalikannya selain memulihkan backup database.
            </p>
          </div>
        </div>

        {row.skipped > 0 && (
          <p className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
            {row.skipped.toLocaleString('id-ID')} baris sudah lewat masa simpan tapi{' '}
            <strong>dilewati</strong> karena terkait sengketa yang belum selesai.
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="p-note">Catatan (opsional)</Label>
          <Input
            id="p-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="mis. pembersihan rutin kuartal I"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="p-confirm">
            Ketik <span className="text-destructive">{FRASA_KONFIRMASI}</span> untuk melanjutkan
          </Label>
          <Input
            id="p-confirm"
            value={frasa}
            onChange={(e) => setFrasa(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={musnahkan.isPending}>
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={() => musnahkan.mutate()}
            disabled={musnahkan.isPending || frasa.trim() !== FRASA_KONFIRMASI}
          >
            {musnahkan.isPending ? 'Memusnahkan…' : 'Musnahkan permanen'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
