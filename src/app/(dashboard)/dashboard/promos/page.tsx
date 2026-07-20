'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil } from 'lucide-react';
import { fetchAPI, qs } from '@/lib/api';
import type { PaginatedData } from '@/types/api';
import { getErrorMessage } from '@/types/api';
import type { Promo, PromoFormValues } from '@/types/admin';
import { nstr, nint } from '@/lib/sql';
import { formatDateTime, formatIDR } from '@/lib/format';
import { toast } from '@/lib/store/toastStore';
import { PROMO_DISCOUNT_OPTIONS } from '@/lib/enums';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { CenteredSpinner, EmptyState } from '@/components/ui/feedback';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

const PER_PAGE = 20;

const emptyForm: PromoFormValues = {
  code: '',
  name: '',
  description: '',
  sponsor: 'platform',
  discount_type: 'percentage',
  value: 0,
  max_discount: 0,
  min_order_amount: 0,
  usage_limit: 0,
  per_user_limit: 0,
  valid_until: '',
  is_active: true,
};

export default function PromosPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<{ open: boolean; promo: Promo | null }>({
    open: false,
    promo: null,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['promos', page],
    queryFn: async () => {
      const res = await fetchAPI<PaginatedData<Promo>>(
        `/admin/promos${qs({ page, per_page: PER_PAGE })}`,
      );
      if (!res.success || !res.data) throw new Error(getErrorMessage(res));
      return res.data;
    },
  });

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Promo</h1>
          <p className="text-sm text-muted-foreground">Kelola kode promo &amp; diskon</p>
        </div>
        <Button onClick={() => setEditor({ open: true, promo: null })}>
          <Plus className="size-4" />
          Buat Promo
        </Button>
      </div>

      {isLoading ? (
        <CenteredSpinner />
      ) : rows.length === 0 ? (
        <EmptyState title="Belum ada promo" note="Buat kode promo pertama Anda." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Diskon</TableHead>
                <TableHead>Terpakai</TableHead>
                <TableHead>Berlaku s/d</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono font-medium">{p.code}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.discount_type === 'percentage'
                      ? `${p.value}%`
                      : formatIDR(p.value)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.used_count}
                    {p.usage_limit > 0 ? ` / ${p.usage_limit}` : ''}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(p.valid_until)}
                  </TableCell>
                  <TableCell>
                    {p.is_active ? (
                      <Badge variant="success">Aktif</Badge>
                    ) : (
                      <Badge variant="neutral">Nonaktif</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditor({ open: true, promo: p })}
                    >
                      <Pencil className="size-4" />
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />
        </>
      )}

      {editor.open && (
        <PromoEditor
          promo={editor.promo}
          onClose={() => setEditor({ open: false, promo: null })}
          onSaved={() => {
            setEditor({ open: false, promo: null });
            qc.invalidateQueries({ queryKey: ['promos'] });
          }}
        />
      )}
    </div>
  );
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function PromoEditor({
  promo,
  onClose,
  onSaved,
}: {
  promo: Promo | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!promo;
  const [form, setForm] = useState<PromoFormValues>(
    promo
      ? {
          code: promo.code,
          name: promo.name,
          description: nstr(promo.description) || '',
          sponsor: promo.sponsor || 'platform',
          discount_type: promo.discount_type,
          value: promo.value,
          max_discount: nint(promo.max_discount) || 0,
          min_order_amount: promo.min_order_amount,
          usage_limit: promo.usage_limit,
          per_user_limit: promo.per_user_limit,
          valid_until: toDatetimeLocal(promo.valid_until),
          is_active: promo.is_active,
        }
      : { ...emptyForm },
  );

  function set<K extends keyof PromoFormValues>(key: K, value: PromoFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        value: Number(form.value) || 0,
        max_discount: Number(form.max_discount) || 0,
        min_order_amount: Number(form.min_order_amount) || 0,
        usage_limit: Number(form.usage_limit) || 0,
        per_user_limit: Number(form.per_user_limit) || 0,
        valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : '',
      };
      const res = isEdit
        ? await fetchAPI(`/admin/promos/${promo!.id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          })
        : await fetchAPI('/admin/promos', { method: 'POST', body: JSON.stringify(payload) });
      if (!res.success) throw new Error(getErrorMessage(res));
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Promo diperbarui' : 'Promo dibuat');
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSave = form.code.trim() && form.name.trim() && form.valid_until && form.value > 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit Promo' : 'Buat Promo'}
      className="max-w-xl"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Kode</Label>
            <Input
              value={form.code}
              disabled={isEdit}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
              placeholder="HEMAT10"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Nama</Label>
            <Input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Diskon Perdana"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Deskripsi</Label>
          <Textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            className="min-h-16"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Tipe diskon</Label>
            <Select
              value={form.discount_type}
              disabled={isEdit}
              onChange={(e) => set('discount_type', e.target.value)}
            >
              {PROMO_DISCOUNT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Nilai {form.discount_type === 'percentage' ? '(%)' : '(Rp)'}</Label>
            <Input
              type="number"
              min={0}
              value={form.value}
              disabled={isEdit}
              onChange={(e) => set('value', Number(e.target.value))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Maks. diskon (Rp)</Label>
            <Input
              type="number"
              min={0}
              value={form.max_discount}
              disabled={isEdit}
              onChange={(e) => set('max_discount', Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Min. order (Rp)</Label>
            <Input
              type="number"
              min={0}
              value={form.min_order_amount}
              disabled={isEdit}
              onChange={(e) => set('min_order_amount', Number(e.target.value))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Kuota total (0 = tanpa batas)</Label>
            <Input
              type="number"
              min={0}
              value={form.usage_limit}
              disabled={isEdit}
              onChange={(e) => set('usage_limit', Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Kuota per user (0 = tanpa batas)</Label>
            <Input
              type="number"
              min={0}
              value={form.per_user_limit}
              disabled={isEdit}
              onChange={(e) => set('per_user_limit', Number(e.target.value))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Berlaku sampai</Label>
            <Input
              type="datetime-local"
              value={form.valid_until}
              onChange={(e) => set('valid_until', e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => set('is_active', e.target.checked)}
              className="size-4 rounded border-input"
            />
            Aktif
          </label>
        </div>

        {isEdit && (
          <p className="text-xs text-muted-foreground">
            Saat edit, hanya nama, deskripsi, masa berlaku, dan status yang diperbarui (batasan
            backend).
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button disabled={!canSave || save.isPending} onClick={() => save.mutate()}>
            {isEdit ? 'Simpan' : 'Buat'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
