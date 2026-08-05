'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useIsMounted } from '@/hooks/useIsMounted';

export type SheetSide = 'right' | 'left';

/**
 * Panel geser dari tepi layar. Dipakai untuk aksi pendek yang butuh konteks
 * daftar tetap terlihat (mis. filter lanjutan, balas cepat). Detail entitas
 * yang panjang TIDAK memakai ini . gunakan halaman `/[id]` ber-URL.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  side = 'right',
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  side?: SheetSide;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const panelRef = useFocusTrap<HTMLDivElement>(open);
  const mounted = useIsMounted();
  const headingId = React.useId();


  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? headingId : undefined}
        className={cn(
          'absolute inset-y-0 flex w-full max-w-md flex-col border-border bg-card shadow-xl outline-none',
          side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-4">
          <div className="min-w-0">
            {title && (
              <h2 id={headingId} className="font-semibold tracking-tight">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Tutup"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">{children}</div>

        {footer && <div className="border-t border-border p-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
