export function formatIDR(amount: number | undefined | null): string {
  const n = typeof amount === 'number' ? amount : 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Sama seperti formatIDR, tapi nilai kosong jadi "-" bukan "Rp 0".
 * Dipakai di tabel/ringkasan keuangan, di mana "belum ada data" dan "nol rupiah"
 * artinya berbeda.
 */
export function formatIDRorDash(amount: number | undefined | null): string {
  if (amount === null || amount === undefined) return '-';
  return formatIDR(amount);
}

export function formatNumber(n: number | undefined | null): string {
  return new Intl.NumberFormat('id-ID').format(typeof n === 'number' ? n : 0);
}

export function formatDateTime(value: string | undefined | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}
