# Watermark Styles Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Menambahkan beberapa preset gaya watermark, termasuk teks multi-baris yang diulang memenuhi gambar, tanpa mengubah prinsip local-only.

**Architecture:** Pisahkan kalkulasi layout watermark menjadi fungsi murni di `src/editor-core.mjs`, lalu jadikan `src/app.mjs` hanya sebagai penghubung state, kontrol UI, dan Canvas API. Setiap preset menghasilkan daftar instance `{ x, y, rotation, lineIndex }`; preview dan export memakai renderer yang sama agar hasil identik pada resolusi asli.

**Tech Stack:** Vanilla HTML/CSS, JavaScript ES modules, Canvas 2D API, Node built-in test runner. Tidak ada dependency, backend, CDN, atau network request baru.

---

## Problem

Editor sekarang hanya memiliki dua perilaku: satu watermark yang bisa diposisikan, atau pola grid berulang dari satu teks. User membutuhkan beberapa gaya siap pakai, terutama kumpulan teks multi-baris yang memenuhi seluruh permukaan gambar.

## Constraints

- Seluruh file gambar, logo, rendering, dan export tetap lokal di browser.
- Preview dan export resolusi asli harus memakai algoritma layout yang sama.
- Preset lama `single` tetap mendukung 9 posisi dan drag.
- Style selain `single` tidak dapat di-drag karena posisinya ditentukan layout.
- Tidak menambah framework atau package baru.
- UI tetap terminal/minimal dan responsif.

## Selected Styles

1. **Single** — satu watermark; preset posisi dan drag seperti sekarang.
2. **Tiled** — grid diagonal staggered; versi formal dari `Ulangi sebagai pola` saat ini.
3. **Text Rows** — setiap baris dari textarea menjadi satu baris horizontal besar; urutan baris diulang sampai tinggi gambar tertutup. Ini memenuhi contoh utama user.
4. **Diagonal Bands** — teks multi-baris digabung sebagai satu label dan disusun dalam beberapa jalur diagonal melintasi gambar.
5. **Dense Grid** — watermark kecil dengan jarak rapat dan offset per baris untuk proteksi screenshot/crop.

**Recommendation:** Implementasikan kelima style di atas. `Single` menjaga kompatibilitas; empat style tambahan memberi variasi berguna tanpa membuat editor kompleks.

**Falsification criteria:** Desain perlu diubah bila preview berbeda dari export, area tepi gambar tidak tertutup pada style berulang, input multi-baris kehilangan urutan, atau layout menjadi tidak responsif pada portrait/landscape ekstrem.

---

### Task 1: Define style model and multiline parsing

**Objective:** Membuat kontrak data stabil untuk semua style dan parsing teks multi-baris.

**Files:**
- Modify: `tests/editor.test.mjs`
- Modify: `src/editor-core.mjs`

**Step 1: Write failing tests**

Tambahkan import dan test:

```js
import { parseWatermarkLines, normalizeStyle } from '../src/editor-core.mjs';

test('multiline input preserves ordered non-empty rows', () => {
  assert.deepEqual(parseWatermarkLines('ALPHA\n\n BETA \nGAMMA'), [
    'ALPHA', 'BETA', 'GAMMA'
  ]);
});

test('empty multiline input falls back to one blank-safe row', () => {
  assert.deepEqual(parseWatermarkLines(' \n '), [' ']);
});

test('unknown style falls back to single', () => {
  assert.equal(normalizeStyle('unknown'), 'single');
  assert.equal(normalizeStyle('rows'), 'rows');
});
```

**Step 2: Verify RED**

Run:

```bash
cd /home/fariz/codes/mw-images
node --test tests/editor.test.mjs
```

Expected: FAIL karena `parseWatermarkLines` dan `normalizeStyle` belum diekspor.

**Step 3: Implement minimal pure helpers**

Tambahkan di `src/editor-core.mjs`:

```js
export const WATERMARK_STYLES = ['single', 'tiled', 'rows', 'bands', 'dense'];

export function normalizeStyle(style) {
  return WATERMARK_STYLES.includes(style) ? style : 'single';
}

export function parseWatermarkLines(value) {
  const lines = String(value ?? '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  return lines.length ? lines : [' '];
}
```

**Step 4: Verify GREEN**

Run `npm test`.

Expected: semua test lama dan baru PASS.

---

### Task 2: Add deterministic layout generators

**Objective:** Menghasilkan posisi watermark yang menutup canvas secara konsisten untuk setiap preset.

**Files:**
- Modify: `tests/editor.test.mjs`
- Modify: `src/editor-core.mjs`

**Step 1: Write failing tests for row coverage**

```js
import { buildRowsLayout, buildBandsLayout, buildDenseLayout } from '../src/editor-core.mjs';

test('rows layout cycles multiline content through canvas height', () => {
  const rows = buildRowsLayout(1000, 600, 60, 26, ['A', 'B', 'C']);
  assert.ok(rows.length >= 7);
  assert.deepEqual(rows.slice(0, 4).map(row => row.text), ['A', 'B', 'C', 'A']);
  assert.ok(rows[0].y <= 0);
  assert.ok(rows.at(-1).y >= 600 - 60);
});

test('bands layout extends beyond all canvas edges', () => {
  const marks = buildBandsLayout(1000, 600, 240, 60, 48);
  assert.ok(marks.some(mark => mark.x < 0));
  assert.ok(marks.some(mark => mark.x > 1000));
  assert.ok(marks.every(mark => mark.rotation === -30));
});

test('dense layout contains more marks than standard tiled layout', () => {
  const dense = buildDenseLayout(1000, 600, 180, 50);
  const tiled = buildRepeatedPositions(1000, 600, 180, 50, 99, 75);
  assert.ok(dense.length > tiled.length);
});
```

**Step 2: Verify RED**

Run `node --test tests/editor.test.mjs`.

Expected: FAIL karena generator baru belum ada.

**Step 3: Implement generators**

Implementasikan fungsi murni dengan output seragam:

```js
{ x, y, rotation, text, lineIndex }
```

Rules:

- `buildRowsLayout`: `rowStep = markHeight + rowGap`; mulai dari `-markHeight / 2`; text menggunakan modulo jumlah baris; posisi x bergantian antara margin kiri dan offset 8% canvas.
- `buildBandsLayout`: rotasi default `-30`; perlu overscan minimal satu diagonal canvas agar sudut tidak kosong; jarak vertikal berbasis `markHeight * 2.2`.
- `buildDenseLayout`: gunakan `buildRepeatedPositions` dengan gap sekitar `markWidth * 0.22` dan `markHeight * 0.35`.
- Tambahkan hard cap, misalnya 2.000 instance, untuk mencegah canvas freeze bila ukuran font sangat kecil.

**Step 4: Verify GREEN and edge cases**

Run `npm test`.

Expected: semua test PASS, termasuk canvas portrait, landscape, dan input satu baris.

---

### Task 3: Replace text input and repeat checkbox with style controls

**Objective:** Membuat multiline editing dan pemilihan style mudah dipahami.

**Files:**
- Modify: `index.html:48-58`
- Modify: `index.html:67-77`
- Modify: `src/styles.css`

**Step 1: Add static DOM contract test**

Buat `tests/ui.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('style picker exposes every supported preset', () => {
  for (const style of ['single', 'tiled', 'rows', 'bands', 'dense']) {
    assert.match(html, new RegExp(`data-style="${style}"`));
  }
});

test('watermark text supports multiple lines', () => {
  assert.match(html, /<textarea[^>]+id="watermarkText"/);
});
```

**Step 2: Verify RED**

Run `node --test tests/ui.test.mjs`.

Expected: FAIL karena picker dan textarea belum ada.

**Step 3: Update editor HTML**

- Ganti `<input id="watermarkText">` menjadi `<textarea id="watermarkText" rows="4">`.
- Tambahkan section `Style` berupa lima tombol/card compact:
  - `Single`
  - `Tiled`
  - `Text rows`
  - `Diagonal bands`
  - `Dense grid`
- Setiap tombol memakai `data-style` dan mini CSS preview, bukan gambar remote.
- Hapus checkbox `repeat`; style `tiled` menggantikan perilaku itu.
- Tambahkan kontrol kontekstual:
  - `Row gap` untuk `rows`.
  - `Pattern gap` untuk `tiled`, `bands`, dan `dense`.
  - `Angle` tetap menggunakan kontrol rotasi sekarang dan menjadi rotasi global/preset.
- Bungkus kontrol posisi dalam `#positionControls` agar dapat disembunyikan untuk style non-single.

**Step 4: Add CSS**

- `.style-grid`: dua kolom pada desktop, satu/dua kolom adaptif pada mobile.
- `.style-option.active`: lime background dan border hitam.
- `.style-preview`: garis/teks abstrak dari pseudo-elements, tanpa aset.
- `textarea`: monospace, resize vertical, tinggi minimum 80px.
- `.context-control[hidden] { display:none }`.

**Step 5: Verify GREEN**

Run `npm test`.

Expected: static DOM tests PASS.

---

### Task 4: Connect style state to the renderer

**Objective:** Menggunakan style picker dan multiline input di preview serta export.

**Files:**
- Modify: `src/app.mjs:1-62`
- Modify: `tests/editor.test.mjs`

**Step 1: Add failing style dispatch test**

Tambahkan pure helper `buildStyleLayout(options)` ke test:

```js
test('style dispatcher returns rows with alternating multiline text', () => {
  const layout = buildStyleLayout({
    style: 'rows', width: 800, height: 500,
    markWidth: 300, markHeight: 50,
    lines: ['PRIVATE', 'DO NOT COPY'], gap: 20, rotation: 0
  });
  assert.equal(layout[0].text, 'PRIVATE');
  assert.equal(layout[1].text, 'DO NOT COPY');
});
```

**Step 2: Verify RED**

Run the specific test; expected FAIL karena dispatcher belum ada.

**Step 3: Implement style dispatch**

Di `editor-core.mjs`, `buildStyleLayout` memilih generator berdasarkan `style`. Di `app.mjs`:

- Ubah defaults dari `repeat:false` menjadi `style:'single'`.
- Tambahkan `watermarkStyle`, `rowGap`, dan `patternGap` ke `els`.
- Tambahkan `setStyle(style)` untuk active state dan visibility kontrol.
- Ubah `drawMark` agar menerima optional `textOverride` dan `rotationOverride`.
- Ubah `drawScene`:
  - `single`: jalur lama, termasuk posisi dan drag.
  - style lainnya: panggil `buildStyleLayout`, lalu render setiap instance.
- `canDragAt` hanya aktif saat style `single`.
- `reset()` mengembalikan style ke `single`.
- Preview dan `exportImage()` tetap memanggil `drawScene`, sehingga tidak ada implementasi export terpisah.

**Step 4: Handle multiline measurement correctly**

Untuk `rows`, ukur masing-masing line dengan font aktif. Gunakan lebar maksimum sebagai mark width. Untuk `bands/tiled/dense`, gabungkan multiline sebagai `line.join(' · ')` agar setiap watermark tetap compact.

**Step 5: Verify GREEN**

Run:

```bash
npm test
node --check src/app.mjs
node --check src/editor-core.mjs
```

Expected: seluruh test PASS dan syntax valid.

---

### Task 5: Verify visual coverage and local-only privacy

**Objective:** Membuktikan setiap style berfungsi di browser nyata dan tidak menambah komunikasi jaringan.

**Files:**
- Modify: `README.md`
- Create temporary fixtures only under `/tmp`; jangan commit file gambar uji.

**Step 1: Generate local fixtures**

Buat tiga gambar sederhana via Python/Pillow atau SVG lokal:

- Landscape `1600×900`
- Portrait `900×1600`
- Square `1200×1200`

**Step 2: Browser verification**

Jalankan server tmux existing dan uji tiap style:

1. Upload landscape.
2. Masukkan:

```text
PRIVATE PROPERTY
DO NOT REPOST
© MW IMAGES
```

3. Pilih `Text rows`; pastikan ketiga line berulang sesuai urutan dan memenuhi atas-bawah.
4. Pilih `Tiled`, `Diagonal bands`, dan `Dense grid`; pastikan tidak ada sudut kosong.
5. Export PNG lalu buka kembali; bandingkan posisi/rotasi dengan preview.
6. Ulangi untuk portrait dan square.
7. Cek mobile width `390×844`: style picker dan controls tidak overflow.

**Step 3: Privacy regression check**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
app = Path('src/app.mjs').read_text()
html = Path('index.html').read_text()
assert 'fetch(' not in app
assert 'XMLHttpRequest' not in app
assert 'http://' not in html
assert 'https://' not in html
print('privacy static checks: PASS')
PY
```

Expected: `privacy static checks: PASS`.

**Step 4: Full verification**

Run:

```bash
npm test
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4173/
curl -fsS -o /dev/null -w '%{http_code}\n' http://100.107.247.13:4173/
```

Expected:

- Seluruh Node tests PASS.
- Local URL returns `200`.
- Tailscale IP returns `200`.
- tmux session `mw-images` tetap aktif.

**Step 5: Update documentation**

Di `README.md`, dokumentasikan lima style, input multi-baris, gap controls, dan bahwa style non-single tidak draggable.

---

## Acceptance Criteria

- Ada lima pilihan style dengan preview visual.
- `Text rows` menerima minimal tiga baris dan mengulang urutannya sampai seluruh tinggi gambar tertutup.
- `Tiled`, `Diagonal bands`, dan `Dense grid` menutup area termasuk tepi canvas.
- Ukuran/gap relatif konsisten antara preview dan export resolusi asli.
- `Single` tetap mendukung drag serta 9 preset posisi.
- Style berulang tidak draggable dan UI posisi disembunyikan agar tidak membingungkan.
- PNG/JPG/WEBP export tetap bekerja.
- Tidak ada upload, backend, remote asset, analytics, atau network request.
- Semua test, syntax check, desktop render, mobile render, dan Tailscale HTTP check lulus.

## Execution Order

1. Model + parsing tests.
2. Layout generator tests.
3. UI contract tests.
4. Renderer integration.
5. Browser/privacy regression verification.
6. README update.

Tidak melakukan push GitHub atau publish eksternal.
