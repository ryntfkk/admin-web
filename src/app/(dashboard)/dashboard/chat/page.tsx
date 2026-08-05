'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, User } from 'lucide-react';
import { fetchAPI, qs } from '@/lib/api';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type { ChatRoomRow, ChatMessageRow } from '@/types/admin';
import { nstr, ntime } from '@/lib/sql';
import { formatDateTime } from '@/lib/format';
import { CenteredSpinner } from '@/components/ui/feedback';
import { DataTable, type Column } from '@/components/ui/data-table';

const PER_PAGE = 20;

export default function ChatPage() {
  // useSearchParams menuntut Suspense boundary di App Router; tanpa ini build
  // gagal dengan "missing suspense boundary with useSearchParams".
  return (
    <Suspense fallback={<CenteredSpinner />}>
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageInner() {
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  // ?room=<id> dipakai halaman detail transaksi untuk membuka langsung
  // percakapan pelanggan↔mitra dari pesanan yang sedang ditangani.
  const [selectedRoom, setSelectedRoom] = useState<string | null>(
    () => searchParams.get('room'),
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ['chat-rooms', page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<ChatRoomRow>>(
        `/admin/chat/rooms${qs({ page, per_page: PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const columns: Column<ChatRoomRow>[] = [
    {
      key: 'customer',
      header: 'Pelanggan',
      cell: (r) => (
        <span className="flex items-center gap-2 font-medium">
          <User className="size-4 text-muted-foreground" />
          {r.customer_name}
        </span>
      ),
    },
    {
      key: 'partner',
      header: 'Mitra',
      cell: (r) => (
        <span className="flex items-center gap-2 text-muted-foreground">
          <User className="size-4" />
          {r.partner_name}
        </span>
      ),
    },
    {
      key: 'last',
      header: 'Pesan terakhir',
      cell: (r) => (
        <span className="block max-w-[250px] truncate text-muted-foreground">
          {nstr(r.last_message) || '-'}
        </span>
      ),
      hideBelow: 'md',
    },
    {
      key: 'time',
      header: 'Tanggal',
      cell: (r) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {ntime(r.last_message_at) ? formatDateTime(ntime(r.last_message_at)!) : '-'}
        </span>
      ),
      hideBelow: 'lg',
    },
    {
      key: 'open',
      header: '',
      align: 'right',
      cell: (r) => (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <MessageSquare className="size-3.5" />
          {selectedRoom === r.id ? 'Tutup' : 'Lihat'}
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Chat</h1>
        <p className="text-sm text-muted-foreground">
          Percakapan pelanggan ↔ mitra. Klik baris untuk membuka isinya . setiap akses baca tercatat
          di Audit Log.
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={data?.data}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="Tidak ada chat"
        emptyNote="Belum ada percakapan chat."
        onRowClick={(room) => setSelectedRoom(selectedRoom === room.id ? null : room.id)}
        page={page}
        perPage={PER_PAGE}
        total={data?.pagination?.total ?? 0}
        onPageChange={setPage}
      />

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
                  className={`max-w-[70%] rounded-lg px-4 py-2 ${msg.sender_role === 'customer'
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
