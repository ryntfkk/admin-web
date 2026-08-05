import { cn } from '@/lib/utils';

/** Baris "label — nominal" untuk rincian biaya. */
export function MoneyRow({
  label,
  value,
  bold,
  muted,
  hint,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className={cn('text-muted-foreground', muted && 'text-xs')}>
        {label}
        {hint && <span className="ml-1 text-xs text-muted-foreground/70">({hint})</span>}
      </span>
      <span className={cn('shrink-0 tabular-nums', bold && 'font-semibold')}>{value}</span>
    </div>
  );
}

/** Selisih waktu dalam bentuk yang bisa dibaca sekilas. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} dtk`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} mnt`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam ${m % 60} mnt`;
  const d = Math.floor(h / 24);
  return `${d} hari ${h % 24} jam`;
}
