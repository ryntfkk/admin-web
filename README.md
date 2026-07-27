# POSKO24 Admin

Panel admin internal untuk POSKO Jasa. Berjalan **lokal** (tidak di-deploy); berbicara ke backend Go/Fiber di EC2.

> Bagian dari tiga aplikasi: `web` (Next.js di AWS Amplify) · `admin-web` (ini, lokal) · `backend` (Go di EC2).

## Menjalankan

```bash
npm install
npm run dev     # http://localhost:3100
```

Butuh `.env.local`:

```
NEXT_PUBLIC_API_URL=https://api.poskojasa.com/api/v1
```

Login memakai akun ber-role `admin`. Bila `active_role` belum `admin`, halaman login otomatis memanggil `/auth/switch-role`; login dibatalkan bila peralihan gagal.

## Tumpukan teknologi

| Bagian | Pilihan |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) · React 19 |
| Styling | Tailwind CSS v4 (CSS-first, token oklch di `src/app/globals.css`) + shadcn `base-nova` + `@base-ui/react` |
| State server | TanStack Query v5 |
| State klien | Zustand (`authStore`, `toastStore`, `commandStore`) |
| Klien API | `fetch` sendiri di `src/lib/api.ts` (refresh 401 otomatis, sekali coba ulang) |

> Baca `AGENTS.md` sebelum menulis kode: versi Next.js ini punya perubahan yang memutus kebiasaan lama, dokumentasinya ada di `node_modules/next/dist/docs/`.

## Struktur

```
src/
  app/(auth)/login            halaman login
  app/(dashboard)/            shell admin (sidebar + topbar) + semua halaman
  components/layout/          Sidebar, SidebarNav, MobileNav, Topbar, CommandPalette
  components/ui/              primitif: DataTable, Modal, Sheet, ConfirmDialog, Field, EntityPage, ...
  components/providers/       Query, Auth, Theme
  hooks/                      useDebouncedValue, useFocusTrap, useIsMounted, useLocalStorageState
  lib/                        api, nav, enums, format, theme, store/
```

## Catatan penting

- **Token akses hanya di memori** (Zustand, tanpa persist) — refresh token ada di cookie HttpOnly. Jangan pindahkan ke localStorage.
- **Setiap permintaan wajib** membawa header `X-Platform` + `X-App-Version` (lihat `src/lib/constants.ts`); backend menolak bila tidak ada.
- **`src/lib/sql.ts` adalah tambalan sementara**: sebagian endpoint admin masih mengembalikan baris sqlc mentah sehingga `sql.NullString` dkk. bocor ke JSON. Berkas ini dipensiunkan modul demi modul seiring backend memakai DTO.
- **Kosakata status** (label + warna badge) terpusat di `src/lib/enums.ts` — jangan duplikasi di halaman.
- **Aksi merusak** memakai `ConfirmDialog` (alasan wajib + ketik-ulang), bukan `window.confirm()`.
- **Warna status** pakai token semantik (`success`/`warning`/`info`/`destructive`), bukan kelas palet Tailwind mentah — agar benar di tema terang maupun gelap.

## Perintah

```bash
npm run dev      # server pengembangan :3100
npm run build    # build produksi
npm run lint     # ESLint
npx tsc --noEmit # pemeriksaan tipe
```
