import { clamp } from "./utils";

type BackdropPaint =
  | { type: "solid"; color: string }
  | { type: "linear"; angle: number; stops: { at: number; color: string }[] };

export type BackdropPreset = {
  // `css` is applied to .capture-canvas (empty = follow --page-color); `paint`
  // is the same backdrop expressed for canvas replication on full-page export.
  css: string;
  paint: BackdropPaint;
};

const lin = (angle: number, stops: [number, string][]): BackdropPreset => ({
  css: `linear-gradient(${angle}deg, ${stops.map(([at, c]) => `${c} ${at * 100}%`).join(", ")})`,
  paint: { type: "linear", angle, stops: stops.map(([at, color]) => ({ at, color })) }
});
const solid = (color: string): BackdropPreset => ({ css: color, paint: { type: "solid", color } });

export const BACKDROPS: Record<string, BackdropPreset> = {
  none: { css: "", paint: { type: "solid", color: "#ffffff" } },
  snow: solid("#f4f4f2"),
  graphite: solid("#1f2024"),
  indigo: lin(135, [[0, "#6366f1"], [1, "#4338ca"]]),
  sunset: lin(135, [[0, "#ff7e5f"], [1, "#feb47b"]]),
  ocean: lin(135, [[0, "#2193b0"], [1, "#6dd5ed"]]),
  grape: lin(135, [[0, "#654ea3"], [1, "#eaafc8"]]),
  mint: lin(135, [[0, "#11998e"], [1, "#38ef7d"]]),
  dusk: lin(160, [[0, "#0f2027"], [0.5, "#203a43"], [1, "#2c5364"]])
};

// Draw an image to cover the box (center-crop), like CSS `background-size: cover`.
function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number): void {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

// Fill the whole canvas with a backdrop so the padding area around the frame
// matches the live window. Mirrors the CSS background of .capture-canvas;
// `fallbackColor` is used when the preset is "none"/unknown (follow page color).
// `customImage` is the loaded user photo for the "custom" backdrop.
export function paintBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  backdropId: string,
  fallbackColor: string,
  customImage?: HTMLImageElement | null
): void {
  if (backdropId === "custom") {
    if (customImage) {
      drawCover(ctx, customImage, width, height);
    } else {
      ctx.fillStyle = fallbackColor;
      ctx.fillRect(0, 0, width, height);
    }
    return;
  }

  const preset = BACKDROPS[backdropId];

  if (!preset || preset.css === "") {
    ctx.fillStyle = fallbackColor;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  const paint = preset.paint;
  if (paint.type === "solid") {
    ctx.fillStyle = paint.color;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  // CSS linear-gradient angle: 0deg points up, increasing clockwise. Project the
  // gradient line through the box centre out to the matching corners.
  const radians = (paint.angle * Math.PI) / 180;
  const dirX = Math.sin(radians);
  const dirY = -Math.cos(radians);
  const halfLen = (Math.abs(width * dirX) + Math.abs(height * dirY)) / 2;
  const cx = width / 2;
  const cy = height / 2;

  const gradient = ctx.createLinearGradient(
    cx - dirX * halfLen,
    cy - dirY * halfLen,
    cx + dirX * halfLen,
    cy + dirY * halfLen
  );
  for (const stop of paint.stops) {
    gradient.addColorStop(clamp(stop.at, 0, 1), stop.color);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}
