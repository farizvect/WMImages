# MW Images

Privacy-focused watermark editor yang berjalan 100% lokal di browser. Tidak memiliki backend, analytics, CDN, atau network request.

## Jalankan

```sh
cd /home/fariz/codes/mw-images
npm start
```

Buka `http://localhost:4173`. Server juga aktif di `0.0.0.0` sehingga bisa diakses via Tailscale: `http://100.107.247.13:4173` (tmux session `mw-images`).

## Fitur

### Watermark teks
- Input multiline (textarea) — setiap baris menjadi baris tersendiri
- Font, ukuran, weight, warna
- Opacity dan rotasi

### Watermark logo
- PNG transparan, JPG, atau WebP
- Skala editable

### 5 style watermark

| Style | Posisi | Rotasi | Kontrol khusus |
|---|---|---|---|
| **Single** | ✅ 9 preset + drag | ✅ penuh | — |
| **Tiled** | ❌ tetap | ❌ dikunci | — |
| **Text rows** | ❌ tetap | ❌ dikunci | **Jarak baris** |
| **Diagonal bands** | ❌ tetap | ✅ offset dari -30° | **Jarak pola** |
| **Dense grid** | ❌ tetap | ❌ dikunci | — |

Catatan:
- Style selain `Single` tidak bisa di-drag — posisi ditentukan layout.
- Rotasi hanya berlaku untuk `Single` dan `Diagonal bands`. Untuk bands, slider rotasi menambah offset dari sudut dasar -30°.
- `Jarak baris` (rows) mengontrol spasi antar baris; `Jarak pola` (bands) mengontrol jarak antar jalur diagonal.
- Layout maksimal 2000 instance per render untuk mencegah freeze.

### Export
- Resolusi asli (bukan resolusi preview)
- PNG / JPG / WEBP dengan quality control
- Preview dan export memakai fungsi render yang sama, jadi hasil konsisten

## Privasi

- Seluruh decoding, rendering, dan export terjadi di browser via Canvas API
- Tidak ada `fetch`, `XMLHttpRequest`, remote asset, analytics, atau backend
- File tidak pernah meninggalkan perangkat

## Tes

```sh
npm test
```

Menjalankan:
- `tests/editor.test.mjs` — parsing multiline, layout generator (rows/bands/tiled/dense), cap 2000, dispatcher, utility
- `tests/ui.test.mjs` — kontrak DOM (5 style button, textarea, gap controls, position wrapper)
