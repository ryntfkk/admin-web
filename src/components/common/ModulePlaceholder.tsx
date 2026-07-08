import { Construction } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function ModulePlaceholder({
  title,
  note,
}: {
  title: string;
  note?: string;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Construction className="size-6" />
          </div>
          <p className="text-sm text-muted-foreground">
            {note || 'Modul ini sedang dalam pengembangan.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
