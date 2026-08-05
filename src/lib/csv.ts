/**
 * Ekspor CSV sisi klien.
 *
 * Panel admin berjalan lokal menembak API produksi, jadi tidak ada endpoint
 * ekspor di server . merakit berkasnya di browser dari data yang sudah diambil
 * jauh lebih murah daripada menambah rute baru khusus untuk itu.
 */

/**
 * Membungkus satu sel CSV.
 *
 * Awalan tanda kutip tunggal pada sel yang diawali =, +, -, atau @ adalah
 * pencegahan injeksi rumus: Excel/Sheets mengeksekusi isi sel semacam itu
 * sebagai formula, dan nilai-nilai ini berasal dari input pengguna (nama,
 * alamat, catatan).
 */
function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCSV(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))];
  // BOM UTF-8: tanpa ini Excel di Windows membaca "Menunggu konfirmasi" dan
  // nama ber-aksen sebagai mojibake.
  return '﻿' + lines.join('\r\n');
}

export function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
