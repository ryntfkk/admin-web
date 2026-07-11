'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, User } from 'lucide-react';
import { fetchAPI, qs } from '@/lib/api';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type { ChatRoomRow, ChatMessageRow } from '@/types/admin';
import { nstr, ntime } from '@/lib/sql';
import { formatDateTime } from '@/lib/format';
import { Pagination } from '@/components/ui/pagination';
import { CenteredSpinner, EmptyState } from '@/components/ui/feedback';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

const PER_PAGE = 20;

export default function ChatPage() {
  const [page, setPage] = useState(1);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['chat-rooms', page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<ChatRoomRow>>(
        `/admin/chat/rooms${qs({ page, per_page: PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Chat</h1>
        <p className="text-sm text-muted-foreground">Lihat percakapan chat pengguna</p>
      </div>

      {isLoading ? (
        <CenteredSpinner />
      ) : rows.length === 0 ? (
        <EmptyState title="Tidak ada chat" note="Belum ada percakapan chat." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pelanggan</TableHead>
                <TableHead>Mitra</TableHead>
                <TableHead>Pesan Terakhir</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((room) => (
                <TableRow key={room.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <User className="size-4 text-muted-foreground" />
                      {room.customer_name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <User className="size-4 text-muted-foreground" />
                      {room.partner_name}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[250px] truncate text-muted-foreground">
                    {nstr(room.last_message) || '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {ntime(room.last_message_at) ? formatDateTime(ntime(room.last_message_at)!) : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      onClick={() => setSelectedRoom(selectedRoom === room.id ? null : room.id)}
                      className="flex items-center gap-1 rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20"
                    >
                      <MessageSquare className="size-4" />
                      {selectedRoom === room.id ? 'Tutup' : 'Lihat'}
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />
        </>
      )}

      {selectedRoom && <ChatHistory roomId={selectedRoom} />}
    </div>
  );
}

function ChatHistory({ roomId }: { roomId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['chat-messages', roomId],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<ChatMessageRow>>(
        `/admin/chat/rooms/${roomId}/messages${qs({ per_page: 100 })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const messages = data?.data ?? [];

  if (isLoading) {
    return <CenteredSpinner />;
  }

  return (
    <div className="mt-4 rounded-lg border bg-card p-4">
      <h3 className="mb-4 text-sm font-medium">Riwayat Chat</h3>
      <div className="max-h-[400px] overflow-y-auto rounded-md border p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <p className="text-center text-muted-foreground">Tidak ada pesan</p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender_role === 'customer' ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 ${
                    msg.sender_role === 'customer'
                      ? 'bg-muted text-foreground'
                      : 'bg-primary text-primary-foreground'
                  }`}
                >
                  <div className="mb-1 text-xs font-medium opacity-70">
                    {msg.sender_name} ({msg.sender_role})
                  </div>
                  <div className="text-sm">{msg.content}</div>
                  <div className="mt-1 text-xs opacity-50">{formatDateTime(msg.created_at)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
