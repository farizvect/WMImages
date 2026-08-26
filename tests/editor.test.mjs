import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clamp,
  getContainRect,
  getWatermarkRect,
  resolvePosition,
  buildRepeatedPositions,
  makeExportName,
  scaleForCanvas,
  parseWatermarkLines,
  normalizeStyle,
  buildRowsLayout,
  buildBandsLayout,
  buildTiledLayout,
  buildStyleLayout,
  resolveStyleRotation,
} from '../src/editor-core.mjs';

test('multiline input preserves ordered non-empty rows', () => {
  assert.deepEqual(parseWatermarkLines('ALPHA\n\n BETA \nGAMMA'), ['ALPHA', 'BETA', 'GAMMA']);
});

test('empty multiline input falls back to one blank-safe row', () => {
  assert.deepEqual(parseWatermarkLines(' \n '), [' ']);
});

test('unknown style falls back to single', () => {
  assert.equal(normalizeStyle('unknown'), 'single');
  assert.equal(normalizeStyle('rows'), 'rows');
});

test('rows layout cycles multiline content through canvas height', () => {
  const rows = buildRowsLayout(1000, 600, 60, 26, ['A', 'B', 'C']);
  assert.ok(rows.length >= 7);
  assert.deepEqual(rows.slice(0, 4).map(row => row.text), ['A', 'B', 'C', 'A']);
  assert.ok(rows[0].y <= 0);
  assert.ok(rows.at(-1).y >= 600 - 60);
});

test('bands layout honors gap: wider gap means fewer bands', () => {
  const tight = buildBandsLayout(1000, 600, 240, 60, 10);
  const loose = buildBandsLayout(1000, 600, 240, 60, 160);
  assert.ok(tight.length > loose.length);
});

test('bands layout changes perpendicular spacing with gap', () => {
  const tight = buildBandsLayout(1000, 600, 240, 60, 10);
  const loose = buildBandsLayout(1000, 600, 240, 60, 160);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  assert.ok(distance(tight[0], tight[1]) < distance(loose[0], loose[1]));
});

test('bands layout extends beyond both horizontal canvas edges', () => {
  const marks = buildBandsLayout(1000, 600, 240, 60, 48);
  assert.ok(marks.some(mark => mark.x < 0));
  assert.ok(marks.some(mark => mark.x > 1000));
  assert.ok(marks.every(mark => mark.rotation === -30));
});

test('style dispatcher returns rows with alternating multiline text', () => {
  const layout = buildStyleLayout({ style:'rows', width:800, height:500, markWidth:300, markHeight:50, lines:['PRIVATE','DO NOT COPY'], gap:20, rotation:0 });
  assert.equal(layout[0].text, 'PRIVATE');
  assert.equal(layout[1].text, 'DO NOT COPY');
});

test('rotation applies to single, tiled, and diagonal bands', () => {
  assert.equal(resolveStyleRotation('single', 15), 15);
  assert.equal(resolveStyleRotation('tiled', 45), 45);
  assert.equal(resolveStyleRotation('bands', 10), -20);
  assert.equal(resolveStyleRotation('rows', 45), 0);
});

test('tiled layout routes through the style dispatcher and applies rotation', () => {
  const layout = buildStyleLayout({ style:'tiled', width:1000, height:600, markWidth:180, markHeight:50, lines:['X'], gap:60, rotation:30 });
  assert.ok(layout.length >= 12);
  assert.ok(layout.every(mark => mark.rotation === 30));
  assert.ok(layout.some(mark => mark.x < 0));
});

test('tiled layout honors pattern gap: wider gap means fewer marks', () => {
  const tight = buildStyleLayout({ style:'tiled', width:1000, height:600, markWidth:180, markHeight:50, lines:['X'], gap:10, rotation:0 });
  const loose = buildStyleLayout({ style:'tiled', width:1000, height:600, markWidth:180, markHeight:50, lines:['X'], gap:200, rotation:0 });
  assert.ok(tight.length > loose.length);
});

test('dense is no longer a supported style', () => {
  assert.equal(normalizeStyle('dense'), 'single');
});

test('generated layouts are capped at 2000 instances', () => {
  assert.ok(buildTiledLayout(100000, 100000, 1, 1).length <= 2000);
});

test('watermark units scale consistently with export width', () => {
  assert.equal(scaleForCanvas(54, 1200), 54);
  assert.equal(scaleForCanvas(54, 4000), 180);
});

test('clamp keeps values inside inclusive bounds', () => {
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(clamp(7, 0, 10), 7);
  assert.equal(clamp(99, 0, 10), 10);
});

test('contain rect preserves image aspect ratio and centers it', () => {
  assert.deepEqual(getContainRect(1600, 900, 800, 800), { x: 0, y: 175, width: 800, height: 450, scale: 0.5 });
  assert.deepEqual(getContainRect(800, 1200, 800, 600), { x: 200, y: 0, width: 400, height: 600, scale: 0.5 });
});

test('text watermark sizing uses measured width and padding', () => {
  assert.deepEqual(getWatermarkRect({ type: 'text', measuredWidth: 240, fontSize: 48, padding: 12 }), { width: 264, height: 72 });
});

test('preset positions respect margin and center', () => {
  const area = { width: 1000, height: 600 };
  const mark = { width: 200, height: 80 };
  assert.deepEqual(resolvePosition('bottom-right', area, mark, 30), { x: 770, y: 490 });
  assert.deepEqual(resolvePosition('center', area, mark, 30), { x: 400, y: 260 });
});

test('repeat mode produces a staggered grid covering the canvas', () => {
  const points = buildRepeatedPositions(500, 300, 100, 40, 40, 30);
  assert.ok(points.length >= 12);
  assert.notEqual(points[0].x, points[4].x);
  assert.ok(points.some(p => p.x < 0));
});

test('export name preserves base name and changes extension', () => {
  assert.equal(makeExportName('private.photo.PNG', 'jpeg'), 'private.photo-watermarked.jpg');
  assert.equal(makeExportName('image', 'png'), 'image-watermarked.png');
});
