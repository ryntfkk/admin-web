'use client';

import * as React from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export interface ThreadMessage {
  id: string;
  /** true = ditulis admin (ditampilkan di sisi kanan). */
  fromAdmin: boolean;
  authorLabel: string;
  content: string;
  createdAt: string;
}

/**
 * Panel percakapan admin↔pengguna.
 *
 * Ruang sengketa dan thread laporan sebelumnya punya implementasi terpisah yang
 * hampir identik — termasuk daftar balasan cepat yang disalin dua kali. Ini
 * satu-satunya tampilan thread; masing-masing halaman cukup mengoper data &
 * fungsi kirimnya.
 */
export default function ThreadPanel({
  title,
  messages,
  isLoading,
  onSend,
  isSending,
  cannedReplies = [],
  emptyNote = 'Belum ada pesan.',
  placeholder = 'Balas sebagai Admin CS…',
  disabled = false,
  disabledNote,
}: {
  title: string;
  messages: ThreadMessage[] | undefined;
  isLoading?: boolean;
  onSend: (content: string) => void;
  isSending?: boolean;
  cannedReplies?: string[];
  emptyNote?: string;
  placeholder?: string;
  disabled?: boolean;
  disabledNote?: string;
}) {
  const [input, setInput] = React.useState('');
  const listRef = React.useRef<HTMLDivElement>(null);
  const lastId = messages?.[messages.length - 1]?.id;

  // Gulir ke pesan terbaru saat ada pesan baru masuk — percakapan panjang
  // kalau tidak akan tetap menampilkan pesan paling awal.
  React.useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId]);

  function submit() {
    const content = input.trim();
    if (!content || disabled) return;
    onSend(content);
    setInput('');
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <MessageSquare className="size-4 text-muted-foreground" />
        <p className="text-sm font-medium">{title}</p>
      </div>

      <div ref={listRef} className="max-h-96 space-y-2 overflow-y-auto p-3">
        {isLoading ? (
          <p className="text-center text-xs text-muted-foreground">Memuat…</p>
        ) : !messages || messages.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground">{emptyNote}</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn('flex flex-col', m.fromAdmin ? 'items-end' : 'items-start')}
            >
              <span className="text-[10px] font-semibold text-muted-foreground">
                {m.authorLabel}
              </span>
              <div
                className={cn(
                  'max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-1.5 text-sm',
                  m.fromAdmin ? 'bg-primary text-primary-foreground' : 'bg-muted',
                )}
              >
                {m.content}
              </div>
              <span className="text-[10px] text-muted-foreground">
                {formatDateTime(m.createdAt)}
              </span>
            </div>
          ))
        )}
      </div>

      {disabled ? (
        <p className="border-t border-border px-3 py-2.5 text-xs text-muted-foreground">
          {disabledNote ?? 'Percakapan ini sudah ditutup.'}
        </p>
      ) : (
        <>
          {cannedReplies.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-border px-2 pt-2">
              {cannedReplies.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setInput(c)}
                  title={c}
                  className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
                >
                  {c.length > 32 ? c.slice(0, 32) + '…' : c}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 p-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={1}
              placeholder={placeholder}
              aria-label={placeholder}
              className="min-h-0 flex-1 resize-none"
              onKeyDown={(e) => {
                // Enter mengirim, Shift+Enter baris baru — kebiasaan aplikasi chat.
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <Button
              size="icon"
              aria-label="Kirim pesan"
              disabled={!input.trim() || isSending}
              onClick={submit}
            >
              <Send className="size-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** Balasan cepat CS — dipakai bersama oleh sengketa dan laporan. */
export const CANNED_REPLIES = [
  'Halo, terima kasih. Bisa dijelaskan kronologinya lebih detail?',
  'Mohon lampirkan bukti (foto / tangkapan layar) agar bisa kami tindak lanjuti.',
  'Kami sedang meninjau laporan ini. Mohon tunggu maksimal 1x24 jam.',
  'Terima kasih, keputusan akan kami sampaikan setelah meninjau bukti kedua pihak.',
];
