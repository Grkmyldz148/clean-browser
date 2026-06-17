import { paintBackdrop } from "./backdrop";
import type { AppearanceSettings, ExportResult, FullPageTile } from "./types";
import { clamp, cssVar } from "./utils";

// The live --frame-radius (px), falling back to the configured value.
export function currentFrameRadius(fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--frame-radius");
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

// Resample the captured frame to the chosen export scale and encode it in the
// chosen format + quality. Source is the native-resolution capture (an <img>
// for the visible shot, a <canvas> for the stitched full page); the logical
// size is in CSS px, so @1x/@2x/@3x map to real output resolution regardless
// of the display's device pixel ratio.
export function exportImage(
  source: CanvasImageSource,
  logicalWidth: number,
  logicalHeight: number,
  settings: AppearanceSettings
): ExportResult {
  const scale = clamp(Math.round(settings.exportScale) || 2, 1, 3);
  const MAX_DIM = 32000;
  let targetW = Math.max(1, Math.round(logicalWidth * scale));
  let targetH = Math.max(1, Math.round(logicalHeight * scale));

  // Keep the canvas within Chromium's per-side limit for very large @3x shots.
  const overflow = Math.max(targetW / MAX_DIM, targetH / MAX_DIM, 1);
  if (overflow > 1) {
    targetW = Math.floor(targetW / overflow);
    targetH = Math.floor(targetH / overflow);
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context unavailable");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, targetW, targetH);

  const format = settings.exportFormat;
  const mime = format === "jpeg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
  const quality = clamp(settings.exportQuality, 40, 100) / 100;
  const dataUrl = canvas.toDataURL(mime, format === "png" ? undefined : quality);
  const ext = format === "jpeg" ? "jpg" : format;
  return { dataUrl, ext, width: targetW, height: targetH };
}

// Stitch the captured page tiles into one tall image, lay the chrome bar on
// top, and reapply the live frame's matte padding, corner radius, and shadow so
// the export matches the on-screen window. Captured bitmaps are already at the
// device pixel ratio, so DIP-based settings get scaled by dpr to align.
export function composeFullPage(
  tiles: FullPageTile[],
  pageWidth: number,
  pageHeight: number,
  barImage: HTMLImageElement,
  settings: AppearanceSettings,
  backdropImage?: HTMLImageElement | null
): HTMLCanvasElement {
  const dpr = window.devicePixelRatio || 1;
  const pad = Math.round(settings.canvasPadding * dpr);
  const radius = currentFrameRadius(settings.frameRadius) * dpr;
  const shadowAlpha = settings.shadowOpacity / 100;
  const pageColor = cssVar("--page-color", settings.canvasColor);

  const innerWidth = Math.round(pageWidth * dpr);
  const pageHeightPx = Math.round(pageHeight * dpr);
  const barHeight = barImage.naturalHeight;
  const innerHeight = barHeight + pageHeightPx;

  const canvas = document.createElement("canvas");
  canvas.width = innerWidth + pad * 2;
  canvas.height = innerHeight + pad * 2;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context unavailable");
  }

  // Backdrop fills the padding area; the opaque frame is drawn on top after.
  paintBackdrop(ctx, canvas.width, canvas.height, settings.backdrop, pageColor, backdropImage);

  const frameX = pad;
  const frameY = pad;

  if (shadowAlpha > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(15, 18, 26, ${Math.min(0.6, shadowAlpha * 1.4)})`;
    ctx.shadowBlur = 60 * dpr;
    ctx.shadowOffsetY = 24 * dpr;
    roundedRectPath(ctx, frameX, frameY, innerWidth, innerHeight, radius);
    ctx.fillStyle = pageColor;
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  roundedRectPath(ctx, frameX, frameY, innerWidth, innerHeight, radius);
  ctx.clip();
  ctx.drawImage(barImage, frameX, frameY, innerWidth, barHeight);
  // Each tile sits at its absolute scroll offset; the rounded clip and the
  // canvas edge trim any overshoot from the final (partial) tile.
  for (const tile of tiles) {
    const top = frameY + barHeight + Math.round(tile.y * dpr);
    ctx.drawImage(tile.image, frameX, top, innerWidth, tile.image.naturalHeight);
  }
  ctx.restore();

  return canvas;
}
