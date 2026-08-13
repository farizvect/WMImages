export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const scaleForCanvas = (value, canvasWidth, referenceWidth = 1200) => value * canvasWidth / referenceWidth;

export function getContainRect(imageWidth, imageHeight, areaWidth, areaHeight) {
  const scale = Math.min(areaWidth / imageWidth, areaHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return { x: (areaWidth - width) / 2, y: (areaHeight - height) / 2, width, height, scale };
}

export function getWatermarkRect({ type, measuredWidth = 0, fontSize = 48, padding = 12, imageWidth = 0, imageHeight = 0, scale = 1 }) {
  if (type === 'image') return { width: imageWidth * scale, height: imageHeight * scale };
  return { width: measuredWidth + padding * 2, height: fontSize + padding * 2 };
}

export function resolvePosition(position, area, mark, margin = 24) {
  const x = { left: margin, center: (area.width - mark.width) / 2, right: area.width - mark.width - margin };
  const y = { top: margin, center: (area.height - mark.height) / 2, bottom: area.height - mark.height - margin };
  if (position === 'center') return { x: x.center, y: y.center };
  const [vertical, horizontal] = position.split('-');
  return { x: x[horizontal], y: y[vertical] };
}

export function buildRepeatedPositions(areaWidth, areaHeight, markWidth, markHeight, gapX = 48, gapY = 36, max = Infinity) {
  const points = [];
  const stepX = Math.max(1, markWidth + gapX);
  const stepY = Math.max(1, markHeight + gapY);
  let row = 0;
  for (let y = -markHeight; y < areaHeight + markHeight; y += stepY) {
    const offset = row % 2 ? stepX / 2 : 0;
    for (let x = -markWidth - offset; x < areaWidth + markWidth; x += stepX) {
      points.push({ x, y });
      if (points.length >= max) return points;
    }
    row++;
  }
  return points;
}

export function makeExportName(originalName = 'image', format = 'png') {
  const base = originalName.replace(/\.[^.]+$/, '') || 'image';
  const ext = format === 'jpeg' ? 'jpg' : format;
  return `${base}-watermarked.${ext}`;
}

export const WATERMARK_STYLES = ['single', 'tiled', 'rows', 'bands', 'dense'];

export function normalizeStyle(style) {
  return WATERMARK_STYLES.includes(style) ? style : 'single';
}

export function resolveStyleRotation(style, sliderRotation = 0) {
  const normalized = normalizeStyle(style);
  if (normalized === 'single') return sliderRotation;
  if (normalized === 'bands') return -30 + sliderRotation;
  return 0;
}

export function parseWatermarkLines(value) {
  const lines = String(value ?? '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  return lines.length ? lines : [' '];
}

const MAX_MARKS = 2000;

export function buildRowsLayout(width, height, markWidth, markHeight, lines, gap = 24) {
  const rows = [];
  const step = Math.max(1, markHeight + gap);
  const rowCount = Math.ceil((height + markHeight * 2) / step);
  for (let i = 0; i < rowCount; i++) {
    const y = -markHeight / 2 + i * step;
    const text = lines[i % lines.length];
    const x = i % 2 ? width * 0.08 : 0;
    rows.push({ x, y, rotation: 0, text, lineIndex: i % lines.length });
  }
  return rows.slice(0, MAX_MARKS);
}

export function buildBandsLayout(width, height, markWidth, markHeight, gap = null, rotation = -30) {
  const marks = [];
  const radians = (rotation * Math.PI) / 180;
  const diagonal = Math.hypot(width, height);
  const step = Math.max(1, markHeight + (gap ?? markHeight * 1.2));
  const count = Math.ceil((diagonal * 2) / step) + 2;
  for (let i = 0; i < count; i++) {
    const centerX = -diagonal / 2 + i * step * Math.cos(radians);
    const centerY = diagonal / 2 + i * step * Math.sin(radians);
    marks.push({ x: centerX, y: centerY, rotation, text: null, lineIndex: 0 });
  }
  return marks.slice(0, MAX_MARKS);
}

export function buildTiledLayout(width, height, markWidth, markHeight, gapX = null, gapY = null) {
  const gx = gapX ?? markWidth * 0.55;
  const gy = gapY ?? markHeight * 0.75;
  const points = buildRepeatedPositions(width, height, markWidth, markHeight, gx, gy, MAX_MARKS);
  return points.map((point, index) => ({
    x: point.x, y: point.y, rotation: 0, text: null, lineIndex: index % 2,
  }));
}

export function buildDenseLayout(width, height, markWidth, markHeight, gapX = null, gapY = null) {
  const gx = gapX ?? markWidth * 0.22;
  const gy = gapY ?? markHeight * 0.35;
  const points = buildRepeatedPositions(width, height, markWidth, markHeight, gx, gy, MAX_MARKS);
  return points.map((point, index) => ({
    x: point.x, y: point.y, rotation: 0, text: null, lineIndex: index % 2,
  }));
}

export function buildStyleLayout({ style, width, height, markWidth, markHeight, lines, gapX, gapY, gap, rotation }) {
  const normalized = normalizeStyle(style);
  if (normalized === 'rows') return buildRowsLayout(width, height, markWidth, markHeight, lines, gap);
  if (normalized === 'bands') return buildBandsLayout(width, height, markWidth, markHeight, gap, rotation);
  if (normalized === 'tiled') return buildTiledLayout(width, height, markWidth, markHeight, gapX, gapY);
  if (normalized === 'dense') return buildDenseLayout(width, height, markWidth, markHeight, gapX, gapY);
  return [];
}
