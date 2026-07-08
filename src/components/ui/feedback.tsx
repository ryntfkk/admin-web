import { Loader2, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-muted-foreground', className)} />;
}

export function CenteredSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex h-48 items-center justify-center', className)}>
      <Spinner className="size-6" />
    </div>
  );
}

export function EmptyState({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <div className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Inbox className="size-5" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </div>
  );
}
