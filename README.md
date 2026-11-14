# Eri · downloader

Web downloader video **TikTok, Instagram, dan Facebook**. Tempel link, ambil videonya, simpan ke perangkat. Tampilan duotone editorial-manga, mobile-first.

> Dibuat sebagai proyek pribadi. Baca [Catatan legal](#catatan-legal) sebelum dipakai publik.

---

## Isi cepat

- [Fitur](#fitur)
- [Platform yang didukung](#platform-yang-didukung)
- [Jalanin di lokal](#jalanin-di-lokal)
- [Environment variables](#environment-variables)
- [Struktur proyek](#struktur-proyek)
- [Cara kerja](#cara-kerja)
- [Deploy ke Vercel](#deploy-ke-vercel)
- [Catatan legal](#catatan-legal)

---

## Fitur

- **Deteksi platform dari hostname**, bukan dari substring URL — `?x=tiktok.com` di domain lain tidak akan lolos.
- **Label kualitas jujur.** UI hanya menulis `HD` kalau sumbernya memang memberi varian HD terpisah. Kalau tidak, ditulis `SD`. Tidak ada klaim kualitas tanpa data.
- **Proxy bertanda tangan.** File di-stream lewat `/api/proxy` supaya download bebas masalah CORS dan hemat memori HP (tanpa `fetch` + `blob`).
- **Guard SSRF.** Proxy hanya menerima URL yang ditandatangani server, dan menolak alamat privat/loopback/link-local.
- **Mobile-first.** Input dan tombol aksi terlihat tanpa scroll di layar 360×640. Target sentuh minimal 44×44 px.
- **Aksesibilitas.** `aria-live` untuk hasil dan error, cincin fokus keyboard, `prefers-reduced-motion` dihormati.
- **Efek kursor cuma di desktop.** Tilt dan magnetic dinonaktifkan di perangkat sentuh.

---

## Platform yang didukung

| Platform | Sumber | Label kualitas | Catatan |
|---|---|---|---|
| TikTok | TikWM (utama), btch-downloader (cadangan) | `HD` / `SD` dari ukuran file asli | Banyak video TikTok hanya punya satu varian; itu dilabeli `SD` |
| Instagram | btch-downloader | `kualitas asli` | Tipe media dideteksi dari signature file, bukan dari ekstensi URL |
| Facebook | btch-downloader | `HD` kalau HD beda dari SD, selain itu `kualitas asli` | Backend kadang mengisi `HD` dan `Normal_video` dengan URL yang sama |

**YouTube tidak didukung.** Library yang dipakai hanya memberi satu link 360p, dan menawarkan 360p lebih buruk daripada tidak menawarkannya. Kalau butuh YouTube, itu perlu service terpisah dengan `yt-dlp` + `ffmpeg`.

---

## Jalanin di lokal

Butuh **Node.js 18+** (dites di Node 26).

```bash
git clone https://github.com/Greeezzz/Eri.git
cd Eri
npm install
npm run dev
```

Buka http://localhost:3000.

Di mode development, `PROXY_SECRET` boleh kosong — akan ada peringatan di console dan dipakai secret sementara. **Jangan begitu di production.**

### Perintah lain

```bash
npm run build   # build production
npm run start   # jalankan hasil build
npx tsc --noEmit  # cek tipe saja
```

---

## Environment variables

| Variabel | Wajib | Keterangan |
|---|---|---|
| `PROXY_SECRET` | Ya (production) | String acak minimal 32 karakter. Dipakai untuk menandatangani URL media (HMAC-SHA256). |

Kalau `PROXY_SECRET` kosong di production, `/api/download` akan balas error 500. Ini disengaja: tanpa secret, proxy tidak bisa memverifikasi permintaan dan berubah jadi open proxy.

Bikin secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Jangan commit secret.** File `.env*` sudah masuk `.gitignore`.

---

## Struktur proyek

```
app/
  api/download/route.ts   orkestrator: validasi → deteksi platform → extractor → normalisasi
  api/proxy/route.ts      stream video/thumbnail (URL bertanda tangan)
  page.tsx                UI utama
  layout.tsx              font (next/font), metadata
  eri.css                 seluruh styling, token duotone
lib/
  platform.ts             detectPlatform() via new URL()
  errors.ts               ApiError + pemetaan kode ke HTTP status
  sign.ts                 signMediaUrl() / verifyMediaSignature() (HMAC-SHA256)
  safe-fetch.ts           fetch dengan guard SSRF + validasi tiap hop redirect
  btch.ts                 client btch-downloader dengan failover antar backend
  types.ts                tipe bersama
  extractors/
    index.ts              registry platform → extractor
    tiktok.ts
    instagram.ts
    facebook.ts
```

---

## Cara kerja

```
Browser                /api/download              Sumber
   │                        │                       │
   │  GET ?url=<link>       │                       │
   ├───────────────────────>│                       │
   │                        │  deteksi platform     │
   │                        │  panggil extractor    │
   │                        ├──────────────────────>│
   │                        │<──────────────────────┤
   │                        │  normalisasi hasil    │
   │                        │  tandatangani URL     │
   │<───────────────────────┤                       │
   │  { downloadUrl: "/api/proxy?…&sig=…" }         │
   │                                                │
   │  GET /api/proxy?…&sig=…                        │
   ├───────────────────────>│  verifikasi sig       │
   │                        │  guard SSRF           │
   │                        ├──────────────────────>│
   │<───────────────────────┤  stream file          │
   │  file terunduh                                  │
```

### Kontrak API

`GET /api/download?url=<encoded>`

Sukses (`200`):

```json
{
  "success": true,
  "data": {
    "platform": "tiktok | instagram | facebook",
    "title": "judul video",
    "thumbnail": "/api/proxy?kind=thumb&u=…&exp=…&sig=…",
    "downloadUrl": "/api/proxy?kind=video&u=…&exp=…&sig=…&name=…",
    "quality": "HD | SD | UNKNOWN",
    "qualityNote": "varian HD TikTok",
    "mediaType": "video | image",
    "source": "tikwm | btch",
    "filename": "judul_video.mp4"
  }
}
```

Gagal:

```json
{ "success": false, "code": "NOT_FOUND", "message": "Video TikTok-nya ga ketemu…" }
```

| `code` | HTTP | Kapan |
|---|---|---|
| `INVALID_URL` | 400 | Kosong, bukan http(s), atau tidak bisa di-parse |
| `UNSUPPORTED_PLATFORM` | 400 | Host bukan TikTok/Instagram/Facebook |
| `NOT_FOUND` | 404 | Extractor jalan tapi tidak ada media (privat/dihapus) |
| `RATE_LIMITED` | 429 | Sumber menolak karena terlalu sering |
| `UPSTREAM_FAILED` | 502 | Sumber gagal |
| `TIMEOUT` | 504 | Melewati batas waktu |

### Keamanan proxy

`/api/proxy` bukan open proxy. Yang dijaga:

- URL media ditandatangani `HMAC-SHA256(secret, "${kind}|${url}|${exp}")`, berlaku 15 menit.
- Verifikasi pakai `timingSafeEqual`.
- Hanya `https:` yang diizinkan.
- Literal IP, `localhost`, `*.internal`, `*.local` ditolak.
- DNS di-resolve dan alamat privat/loopback/link-local ditolak (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, `::1`, `fc00::/7`, `fe80::/10`).
- Redirect diikuti manual, maksimal 3 kali, dan **setiap hop divalidasi ulang**.
- Nama file disanitasi sebelum masuk `Content-Disposition`.

---

## Deploy ke Vercel

1. Import repo ini di Vercel.
2. Tambahkan environment variable `PROXY_SECRET` (lihat [di atas](#environment-variables)) untuk Production, Preview, dan Development.
3. Deploy.

Tanpa `PROXY_SECRET`, situsnya akan tampil tapi setiap permintaan download balas 500.

Route `/api/download` dan `/api/proxy` memakai `runtime = 'nodejs'` karena butuh `node:crypto` dan `node:dns`.

---

## Catatan legal

- Download dari TikTok melanggar Terms of Service mereka.
- Instagram dan Facebook melarang scraping.
- Aman untuk pemakaian pribadi. Kalau dipublikasikan luas dan dipakai banyak orang, siap-siap kena rate limit atau blokir dari sumber.
- Proyek ini tidak menyimpan video di server. File di-stream langsung dari CDN sumber ke perangkat pengguna.

---

## Limitasi

- **Kualitas TikTok dibatasi TikTok.** Kalau sumber hanya menyimpan satu varian 540p, tidak ada cara mengambil 1080p — bukan masalah di sisi aplikasi ini. UI akan jujur menulis `SD`.
- **YouTube tidak ada.** Lihat [Platform yang didukung](#platform-yang-didukung).
- **Instagram dan Facebook bergantung pada `btch-downloader`**, yang backend-nya kadang tidak stabil. Kode ini sudah punya failover antar host, tapi kalau semua host mati, tidak ada sumber cadangan.
- **Konten privat tidak bisa diambil.** Stories dan postingan privat akan balas `NOT_FOUND`.

---

## Lisensi

Proyek pribadi. Tidak ada lisensi terbuka.
