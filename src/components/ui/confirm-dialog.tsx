'use client';

import * as React from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * Panjang minimum alasan admin. Alasan ikut tersimpan di `admin_audit_logs`,
 * jadi "ok"/"tes" tidak berguna saat kelak ditelusuri.
 */
export const MIN_REASON_LENGTH = 10;

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** Dipanggil saat admin menekan tombol konfirmasi. Penutupan diserahkan ke pemanggil (biasanya onSuccess mutation). */
  onConfirm: (reason: string) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` = aksi merusak/menyentuh uang: tombol merah + ikon peringatan. */
  variant?: 'default' | 'danger';
  /** Bila diisi, admin wajib mengetik ulang teks ini PERSIS sebelum tombol aktif. */
  confirmPhrase?: string;
  /** Bila true, alasan wajib diisi minimal MIN_REASON_LENGTH karakter. */
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  /** Biasanya `mutation.isPending`. */
  loading?: boolean;
}

/**
 * Dialog konfirmasi terpadu . pengganti `window.confirm()` dan modal konfirmasi
 * bespoke yang sebelumnya tersebar di halaman users/services/reviews/dll.
 *
 * Karena panel admin hanya punya SATU tingkat hak akses (setiap admin bisa
 * melakukan apa saja), friksi di lapisan UI inilah pengamannya: ketik-ulang
 * untuk aksi merusak + alasan wajib yang masuk audit log.
 */
export function ConfirmDialog({ open, onClose, ...rest }: ConfirmDialogProps) {
  // Isi dialog sengaja di-mount ulang tiap kali dibuka: alasan & frasa
  // konfirmasi dari aksi sebelumnya otomatis hilang, tanpa efek pereset yang
  // memicu render berantai. Membawa alasan lama ke aksi berikutnya berarti
  // audit log bisa mencatat alasan yang salah.
  if (!open) return null;
  return (
    <Modal open onClose={onClose} className="max-w-md">
      <ConfirmDialogForm onClose={onClose} {...rest} />
    </Modal>
  );
}

function ConfirmDialogForm({
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  variant = 'default',
  confirmPhrase,
  requireReason = false,
  reasonLabel = 'Alasan',
  reasonPlaceholder = 'Jelaskan alasan tindakan ini…',
  loading = false,
}: Omit<ConfirmDialogProps, 'open'>) {
  const [reason, setReason] = React.useState('');
  const [phrase, setPhrase] = React.useState('');

  const reasonOk = !requireReason || reason.trim().length >= MIN_REASON_LENGTH;
  const phraseOk = !confirmPhrase || phrase.trim() === confirmPhrase.trim();
  const canConfirm = reasonOk && phraseOk && !loading;

  const isDanger = variant === 'danger';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canConfirm) return;
    onConfirm(reason.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-3">
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg',
            isDanger ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground',
          )}
          aria-hidden
        >
          {isDanger ? <ShieldAlert className="size-5" /> : <AlertTriangle className="size-5" />}
        </div>
        <div className="min-w-0 space-y-1">
          <h2 className="font-semibold tracking-tight">{title}</h2>
          {description && (
            <div className="text-sm text-muted-foreground">{description}</div>
          )}
        </div>
      </div>

      {requireReason && (
        <div className="space-y-1.5">
          <Label htmlFor="confirm-reason">
            {reasonLabel} <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="confirm-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonPlaceholder}
            rows={3}
            aria-invalid={reason.length > 0 && !reasonOk}
          />
          <p
            className={cn(
              'text-xs',
              reason.length > 0 && !reasonOk ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            Minimal {MIN_REASON_LENGTH} karakter . tersimpan di audit log ({reason.trim().length}/
            {MIN_REASON_LENGTH}).
          </p>
        </div>
      )}

      {confirmPhrase && (
        <div className="space-y-1.5">
          <Label htmlFor="confirm-phrase">
            Ketik <span className="font-mono font-semibold text-foreground">{confirmPhrase}</span>{' '}
            untuk melanjutkan
          </Label>
          <Input
            id="confirm-phrase"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={phrase.length > 0 && !phraseOk}
          />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          type="submit"
          variant={isDanger ? 'destructive' : 'default'}
          disabled={!canConfirm}
        >
          {loading ? 'Memproses…' : confirmLabel}
        </Button>
      </div>
    </form>
  );
}
