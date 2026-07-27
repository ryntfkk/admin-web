'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Paperclip } from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { getErrorMessage } from '@/types/api';
import type { ReportDetailRow, ReportMessageRow } from '@/types/admin';
import { nstr, ntime } from '@/lib/sql';
import { formatDateTime } from '@/lib/format';
import { toast } from '@/lib/store/toastStore';
import {
  REPORT_STATUS_LABELS,
  REPORT_TYPE_LABELS,
  reportStatusVariant,
  reportTypeVariant,
} from '@/lib/enums';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldGrid } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EntityPage, EntitySection, type EntityTab } from '@/components/ui/entity-page';
import ThreadPanel, { CANNED_REPLIES, type ThreadMessage } from '@/components/common/ThreadPanel';

export default function ReportDetailPage() {
  const { id: reportId } = useParams<{ id: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['report-detail', reportId],
    queryFn: async () => {
      const res = await fetchAPI<ReportDetailRow>(`/admin/reports/${reportId}`);
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const tabs: EntityTab[] = data
    ? [
        { id: 'ringkasan', label: 'Ringkasan', content: <SummaryTab report={data} /> },
        { id: 'percakapan', label: 'Percakapan', content: <ReportThread reportId={reportId} /> },
        {
          id: 'penanganan',
          label: 'Penanganan',
          content: <ResolutionTab report={data} reportId={reportId} />,
        },
      ]
    : [];

  return (
    <EntityPage
      backHref="/dashboard/reports"
      backLabel="Semua laporan"
      isLoading={isLoading}
      error={error}
      title={data ? `Laporan ${data.reason_category}` : '—'}
      subtitle={
        data && (
          <span>
            Dari {data.reporter_name} · dibuat {formatDateTime(data.created_at)}
          </span>
        )
      }
      badges={
        data && (
          <>
            <Badge variant={reportStatusVariant(data.status)}>
              {REPORT_STATUS_LABELS[data.status] || data.status}
            </Badge>
            <Badge variant={reportTypeVariant(data.target_type)}>
              {REPORT_TYPE_LABELS[data.target_type] || data.target_type}
            </Badge>
          </>
        )
      }
      tabs={tabs}
    />
  );
}

function SummaryTab({ report }: { report: ReportDetailRow }) {
  return (
    <div className="space-y-4">
      <EntitySection title="Laporan">
        <FieldGrid columns={3}>
          <Field label="Pelapor" value={report.reporter_name} />
          <Field label="No. HP pelapor" value={nstr(report.reporter_phone)} />
          <Field label="Target" value={nstr(report.target_name)} />
          <Field label="Kategori" value={report.reason_category} />
          <Field label="Dibuat" value={formatDateTime(report.created_at)} />
          <Field label="ID Laporan" value={report.id} mono />
        </FieldGrid>
      </EntitySection>

      {nstr(report.description) && (
        <EntitySection title="Keterangan pelapor">
          <p className="text-sm whitespace-pre-wrap">{nstr(report.description)}</p>
        </EntitySection>
      )}

      {nstr(report.target_details) && (
        <EntitySection title="Detail target">
          <p className="text-sm whitespace-pre-wrap">{nstr(report.target_details)}</p>
        </EntitySection>
      )}

      {report.evidence_urls && report.evidence_urls.length > 0 && (
        <EntitySection
          title={
            <span className="flex items-center gap-1.5">
              <Paperclip className="size-4" />
              Bukti ({report.evidence_urls.length})
            </span>
          }
        >
          <div className="flex flex-wrap gap-2">
            {report.evidence_urls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="overflow-hidden rounded-lg border border-border hover:border-primary"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Bukti ${i + 1}`} className="size-24 object-cover" />
              </a>
            ))}
          </div>
        </EntitySection>
      )}
    </div>
  );
}

function ReportThread({ reportId }: { reportId: string }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['report-messages', reportId],
    refetchInterval: 7000,
    queryFn: async () => {
      const res = await fetchAPI<ReportMessageRow[]>(`/admin/reports/${reportId}/messages`);
      if (!res.success) throw new Error(getErrorMessage(res));
      return res.data ?? [];
    },
  });

  const send = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetchAPI(`/admin/reports/${reportId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, message_type: 'text' }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-messages', reportId] });
      // Balasan pertama bisa mengubah status OPEN → REVIEWING.
      qc.invalidateQueries({ queryKey: ['report-detail', reportId] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const messages: ThreadMessage[] | undefined = data?.map((m) => ({
    id: m.id,
    fromAdmin: m.sender_type === 'admin',
    authorLabel: m.sender_type === 'admin' ? 'Admin CS' : 'Pelapor',
    content: m.message_type === 'image' ? m.content : m.content,
    createdAt: m.created_at,
  }));

  return (
    <ThreadPanel
      title="Percakapan dengan pelapor"
      messages={messages}
      isLoading={isLoading}
      onSend={(content) => send.mutate(content)}
      isSending={send.isPending}
      cannedReplies={CANNED_REPLIES}
      emptyNote="Belum ada pesan. Balasan pertama Anda akan memindahkan status laporan ke Ditinjau."
    />
  );
}

function ResolutionTab({ report, reportId }: { report: ReportDetailRow; reportId: string }) {
  const qc = useQueryClient();
  const [adminNotes, setAdminNotes] = useState('');
  const [confirming, setConfirming] = useState<'ACTIONED' | 'DISMISSED' | null>(null);

  const resolve = useMutation({
    mutationFn: async (action: 'ACTIONED' | 'DISMISSED') => {
      const res = await fetchAPI(`/admin/reports/${reportId}/resolve`, {
        method: 'PUT',
        body: JSON.stringify({ status: action, note: adminNotes }),
      });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success('Laporan diselesaikan');
      setConfirming(null);
      qc.invalidateQueries({ queryKey: ['report-detail', reportId] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (report.status === 'ACTIONED' || report.status === 'DISMISSED') {
    return (
      <EntitySection title="Sudah ditangani">
        <FieldGrid columns={3}>
          <Field label="Keputusan" value={REPORT_STATUS_LABELS[report.status] || report.status} />
          <Field label="Ditangani oleh" value={nstr(report.resolved_by)} />
          <Field
            label="Waktu"
            value={ntime(report.resolved_at) ? formatDateTime(ntime(report.resolved_at)) : null}
          />
        </FieldGrid>
        {nstr(report.resolution_note) && (
          <p className="mt-3 text-sm whitespace-pre-wrap">{nstr(report.resolution_note)}</p>
        )}
      </EntitySection>
    );
  }

  return (
    <>
      <EntitySection
        title="Form penanganan"
        description="“Tindaklanjuti” berarti laporan terbukti dan sudah ditindak; “Abaikan” berarti tidak ditemukan pelanggaran. Keduanya menutup tiket."
      >
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="report-notes">Catatan admin</Label>
            <Textarea
              id="report-notes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Catatan penanganan atau alasan diabaikan…"
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirming('DISMISSED')}>
              Abaikan
            </Button>
            <Button disabled={!adminNotes.trim()} onClick={() => setConfirming('ACTIONED')}>
              Tindaklanjuti
            </Button>
          </div>
        </div>
      </EntitySection>

      <ConfirmDialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        onConfirm={() => confirming && resolve.mutate(confirming)}
        title={confirming === 'ACTIONED' ? 'Tandai sudah ditindaklanjuti?' : 'Abaikan laporan ini?'}
        description={
          confirming === 'ACTIONED'
            ? 'Tiket ditutup dan pelapor diberi tahu bahwa laporannya sudah ditindak.'
            : 'Tiket ditutup tanpa tindakan terhadap pihak terlapor. Pelapor tetap diberi tahu.'
        }
        confirmLabel={confirming === 'ACTIONED' ? 'Tindaklanjuti' : 'Abaikan'}
        loading={resolve.isPending}
      />
    </>
  );
}
