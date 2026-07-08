'use client';

import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { useToastStore, type ToastVariant } from '@/lib/store/toastStore';
import { cn } from '@/lib/utils';

const icons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const styles: Record<ToastVariant, string> = {
  success: 'border-emerald-500/30 text-emerald-700',
  error: 'border-rose-500/30 text-rose-700',
  info: 'border-border text-foreground',
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const Icon = icons[t.variant];
        return (
          <div
            key={t.id}
            className={cn(
              'flex items-start gap-2.5 rounded-lg border bg-card px-3.5 py-2.5 shadow-md',
              styles[t.variant],
            )}
          >
            <Icon className="mt-0.5 size-4.5 shrink-0" />
            <p className="flex-1 text-sm text-foreground">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Tutup"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
