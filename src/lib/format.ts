export function formatIDR(amount: number | undefined | null): string {
  const n = typeof amount === 'number' ? amount : 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
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
