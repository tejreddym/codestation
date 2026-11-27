/**
 * Canvas Overlay Models and Vector Rendering Engine for Video Thumbnail Maker.
 * 100% browser-side processing, zero server uploads.
 */

export type ShapeType = 'rect' | 'pill' | 'badge' | 'circle' | 'arrow';
export type ArrowDirection = 'right' | 'left' | 'up' | 'down';
export type IconType = 'play' | 'fire' | 'alert' | 'star' | 'check' | 'lightning';

export interface BaseLayer {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  opacity?: number;
  rotation?: number;
}

export interface TextLayer extends BaseLayer {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fill: string;
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  badgeBg?: string;
  badgePadding?: number;
}

export interface ShapeLayer extends BaseLayer {
  type: 'shape';
  shapeType: ShapeType;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  direction?: ArrowDirection;
}

export interface IconLayer extends BaseLayer {
  type: 'icon';
  iconType: IconType;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  size?: number;
}

export type OverlayLayer = TextLayer | ShapeLayer | IconLayer;

export type ThumbnailPresetId = 'youtube-impact' | 'tech-clean' | 'breaking-alert' | 'gaming-badge';

/**
 * Normalizes coordinates and dimensions, handling inverted or negative drag handles.
 * Ensures width and height are positive and clamped to a minimum threshold.
 */
export function normalizeLayerBounds(
  x: number,
  y: number,
  width: number,
  height: number,
  canvasWidth?: number,
  canvasHeight?: number
): { x: number; y: number; width: number; height: number } {
  let normX = x;
  let normY = y;
  let normW = width;
  let normH = height;

  if (normW < 0) {
    normX += normW;
    normW = Math.abs(normW);
  }
  if (normH < 0) {
    normY += normH;
    normH = Math.abs(normH);
  }

  normW = Math.max(10, Math.round(normW));
  normH = Math.max(10, Math.round(normH));
  normX = Math.round(normX);
  normY = Math.round(normY);

  if (canvasWidth && canvasWidth > 0) {
    normX = Math.max(-normW + 10, Math.min(canvasWidth - 10, normX));
  }
  if (canvasHeight && canvasHeight > 0) {
    normY = Math.max(-normH + 10, Math.min(canvasHeight - 10, normY));
  }

  return { x: normX, y: normY, width: normW, height: normH };
}

/**
 * Tests which layer contains the given (x, y) point, searching top-to-bottom.
 * Visible layers rendered last are on top.
 */
export function hitTestLayers(layers: OverlayLayer[], x: number, y: number): OverlayLayer | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (layer.visible === false) continue;
    const lx = layer.x ?? 0;
    const ly = layer.y ?? 0;
    const lw = layer.width ?? ('size' in layer && layer.size ? layer.size : 50);
    const lh = layer.height ?? ('size' in layer && layer.size ? layer.size : 50);
    if (
      x >= lx &&
      x <= lx + lw &&
      y >= ly &&
      y <= ly + lh
    ) {
      return layer;
    }
  }
  return null;
}

/**
 * Reorders layers in the stack with boundary clamping.
 */
export function reorderLayers(
  layers: OverlayLayer[],
  layerId: string,
  action: 'bringToFront' | 'sendToBack' | 'moveUp' | 'moveDown'
): OverlayLayer[] {
  const index = layers.findIndex(l => l.id === layerId);
  if (index === -1) return [...layers];

  const next = [...layers];
  const [target] = next.splice(index, 1);

  if (action === 'bringToFront') {
    next.push(target);
  } else if (action === 'sendToBack') {
    next.unshift(target);
  } else if (action === 'moveUp') {
    const targetIndex = Math.min(next.length, index + 1);
    next.splice(targetIndex, 0, target);
  } else if (action === 'moveDown') {
    const targetIndex = Math.max(0, index - 1);
    next.splice(targetIndex, 0, target);
  }

  return next;
}

/**
 * Robust cross-environment rounded rectangle path builder.
 */
export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  if (w === 0 || h === 0) return;
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));

  if (typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(x, y, w, h, r);
    return;
  }
  if (typeof ctx.arcTo === 'function' && r > 0) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    return;
  }
  ctx.rect(x, y, w, h);
}

/**
 * Computes polygon points for an arrow pointing in any of the 4 cardinal directions.
 */
export function getArrowPathPoints(
  x: number,
  y: number,
  w: number,
  h: number,
  direction: ArrowDirection = 'right'
): [number, number][] {
  if (direction === 'right') {
    const shaftH = h * 0.45;
    const headW = w * 0.45;
    const shaftTop = y + (h - shaftH) / 2;
    const shaftBottom = shaftTop + shaftH;
    const headLeft = x + w - headW;
    return [
      [x, shaftTop],
      [headLeft, shaftTop],
      [headLeft, y],
      [x + w, y + h / 2],
      [headLeft, y + h],
      [headLeft, shaftBottom],
      [x, shaftBottom],
    ];
  } else if (direction === 'left') {
    const shaftH = h * 0.45;
    const headW = w * 0.45;
    const shaftTop = y + (h - shaftH) / 2;
    const shaftBottom = shaftTop + shaftH;
    const headRight = x + headW;
    return [
      [x + w, shaftBottom],
      [headRight, shaftBottom],
      [headRight, y + h],
      [x, y + h / 2],
      [headRight, y],
      [headRight, shaftTop],
      [x + w, shaftTop],
    ];
  } else if (direction === 'up') {
    const shaftW = w * 0.45;
    const headH = h * 0.45;
    const shaftLeft = x + (w - shaftW) / 2;
    const shaftRight = shaftLeft + shaftW;
    const headBottom = y + headH;
    return [
      [shaftRight, y + h],
      [shaftRight, headBottom],
      [x + w, headBottom],
      [x + w / 2, y],
      [x, headBottom],
      [shaftLeft, headBottom],
      [shaftLeft, y + h],
    ];
  } else {
    // down
    const shaftW = w * 0.45;
    const headH = h * 0.45;
    const shaftLeft = x + (w - shaftW) / 2;
    const shaftRight = shaftLeft + shaftW;
    const headTop = y + h - headH;
    return [
      [shaftLeft, y],
      [shaftLeft, headTop],
      [x, headTop],
      [x + w / 2, y + h],
      [x + w, headTop],
      [shaftRight, headTop],
      [shaftRight, y],
    ];
  }
}

/**
 * Calculates polygon points for 5-point star.
 */
export function getStarPathPoints(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number
): [number, number][] {
  const points: [number, number][] = [];
  const step = Math.PI / 5;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + i * step;
    points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
  }
  return points;
}

/**
 * Calculates polygon points for lightning bolt.
 */
export function getLightningPathPoints(x: number, y: number, w: number, h: number): [number, number][] {
  return [
    [x + w * 0.55, y + h * 0.05],
    [x + w * 0.15, y + h * 0.52],
    [x + w * 0.48, y + h * 0.52],
    [x + w * 0.38, y + h * 0.95],
    [x + w * 0.85, y + h * 0.42],
    [x + w * 0.52, y + h * 0.42],
  ];
}

/**
 * Renders a shape layer onto canvas context.
 */
export function renderShapeLayer(ctx: CanvasRenderingContext2D, layer: ShapeLayer): void {
  const x = layer.x ?? 0;
  const y = layer.y ?? 0;
  const w = layer.width ?? 50;
  const h = layer.height ?? 50;
  const { shapeType, fill, stroke, strokeWidth, radius, direction } = layer;
  ctx.save();
  ctx.beginPath();

  if (shapeType === 'rect') {
    if (radius && radius > 0) {
      drawRoundedRect(ctx, x, y, w, h, radius);
    } else {
      ctx.rect(x, y, w, h);
    }
  } else if (shapeType === 'pill') {
    const r = Math.min(w, h) / 2;
    drawRoundedRect(ctx, x, y, w, h, r);
  } else if (shapeType === 'badge') {
    const r = radius !== undefined ? radius : Math.max(6, Math.min(16, Math.min(w, h) * 0.15));
    drawRoundedRect(ctx, x, y, w, h, r);
  } else if (shapeType === 'circle') {
    if (w > 0 && h > 0) {
      ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2);
    }
  } else if (shapeType === 'arrow') {
    const points = getArrowPathPoints(x, y, w, h, direction);
    if (points.length > 0) {
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i][0], points[i][1]);
      }
      ctx.closePath();
    }
  }

  if (fill !== undefined) {
    ctx.fillStyle = fill;
  }
  ctx.fill();

  if (stroke && (strokeWidth ?? 0) > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth ?? 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Renders an icon layer onto canvas context.
 */
export function renderIconLayer(ctx: CanvasRenderingContext2D, layer: IconLayer): void {
  const x = layer.x ?? 0;
  const y = layer.y ?? 0;
  const size = layer.size ?? 40;
  const w = layer.width ?? size;
  const h = layer.height ?? size;
  const { iconType, fill, stroke, strokeWidth } = layer;
  ctx.save();
  if (fill !== undefined) ctx.fillStyle = fill;
  if (stroke && (strokeWidth ?? 0) > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth ?? 2;
    ctx.lineJoin = 'round';
  }

  ctx.beginPath();
  if (iconType === 'play') {
    ctx.moveTo(x + w * 0.22, y + h * 0.15);
    ctx.lineTo(x + w * 0.85, y + h * 0.50);
    ctx.lineTo(x + w * 0.22, y + h * 0.85);
    ctx.closePath();
    ctx.fill();
    if (stroke && (strokeWidth ?? 0) > 0) ctx.stroke();
  } else if (iconType === 'fire') {
    ctx.moveTo(x + w * 0.50, y + h * 0.98);
    if (typeof ctx.bezierCurveTo === 'function') {
      ctx.bezierCurveTo(x + w * 0.85, y + h * 0.95, x + w * 0.95, y + h * 0.65, x + w * 0.70, y + h * 0.45);
      ctx.bezierCurveTo(x + w * 0.65, y + h * 0.35, x + w * 0.65, y + h * 0.20, x + w * 0.50, y + h * 0.05);
      ctx.bezierCurveTo(x + w * 0.40, y + h * 0.22, x + w * 0.45, y + h * 0.35, x + w * 0.35, y + h * 0.42);
      ctx.bezierCurveTo(x + w * 0.15, y + h * 0.55, x + w * 0.15, y + h * 0.85, x + w * 0.50, y + h * 0.98);
    } else {
      ctx.lineTo(x + w * 0.85, y + h * 0.75);
      ctx.lineTo(x + w * 0.65, y + h * 0.20);
      ctx.lineTo(x + w * 0.50, y + h * 0.05);
      ctx.lineTo(x + w * 0.35, y + h * 0.42);
      ctx.lineTo(x + w * 0.15, y + h * 0.75);
      ctx.lineTo(x + w * 0.50, y + h * 0.98);
    }
    ctx.closePath();
    ctx.fill();
    if (stroke && (strokeWidth ?? 0) > 0) ctx.stroke();
  } else if (iconType === 'alert') {
    // Triangle
    ctx.moveTo(x + w * 0.50, y + h * 0.08);
    ctx.lineTo(x + w * 0.95, y + h * 0.90);
    ctx.lineTo(x + w * 0.05, y + h * 0.90);
    ctx.closePath();
    ctx.fill();
    if (stroke && (strokeWidth ?? 0) > 0) ctx.stroke();

    // Inner exclamation mark
    ctx.beginPath();
    ctx.fillStyle = stroke || '#000000';
    const barW = Math.max(2, w * 0.08);
    drawRoundedRect(ctx, x + (w - barW) / 2, y + h * 0.36, barW, h * 0.26, barW / 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.74, barW / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (iconType === 'star') {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const points = getStarPathPoints(cx, cy, Math.min(w, h) / 2, Math.min(w, h) * 0.22);
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.closePath();
    ctx.fill();
    if (stroke && (strokeWidth ?? 0) > 0) ctx.stroke();
  } else if (iconType === 'check') {
    ctx.lineWidth = strokeWidth ?? Math.max(3, w * 0.15);
    ctx.strokeStyle = fill;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(x + w * 0.15, y + h * 0.52);
    ctx.lineTo(x + w * 0.40, y + h * 0.80);
    ctx.lineTo(x + w * 0.88, y + h * 0.22);
    ctx.stroke();
  } else if (iconType === 'lightning') {
    const points = getLightningPathPoints(x, y, w, h);
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.closePath();
    ctx.fill();
    if (stroke && (strokeWidth ?? 0) > 0) ctx.stroke();
  }

  ctx.restore();
}

/**
 * Splits text into lines on newlines.
 */
export function getMultilineText(text: string): string[] {
  return text.split('\n');
}

/**
 * Renders a multiline text layer with optional stroke outline, shadow, and background badge.
 */
export function renderTextLayer(ctx: CanvasRenderingContext2D, layer: TextLayer): void {
  const x = layer.x ?? 0;
  const y = layer.y ?? 0;
  const w = layer.width ?? 100;
  const h = layer.height ?? 50;
  const text = layer.text ?? '';
  const fontFamily = layer.fontFamily || 'Inter';
  const fontSize = layer.fontSize ?? 24;
  const fill = layer.fill !== undefined ? layer.fill : '#ffffff';
  const {
    strokeColor,
    strokeWidth,
    shadowColor,
    shadowBlur,
    shadowOffsetX,
    shadowOffsetY,
    badgeBg,
    badgePadding,
  } = layer;

  const lines = getMultilineText(text);
  const lineHeight = Math.round(fontSize * 1.25);

  ctx.save();

  // Draw background badge if enabled
  if (badgeBg) {
    const pad = badgePadding ?? 8;
    ctx.fillStyle = badgeBg;
    drawRoundedRect(ctx, x - pad, y - pad, w + pad * 2, h + pad * 2, 8);
    ctx.fill();
  }

  // Setup font & shadow
  ctx.font = `${fontSize}px ${fontFamily}, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  lines.forEach((line, index) => {
    const lineY = y + index * lineHeight;

    // Apply shadow during stroke or fill
    if (shadowColor && (shadowBlur ?? 0) > 0) {
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = shadowBlur ?? 6;
      ctx.shadowOffsetX = shadowOffsetX ?? 2;
      ctx.shadowOffsetY = shadowOffsetY ?? 2;
    } else {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    // Stroke outline first so it does not occlude text fill
    if (strokeColor && (strokeWidth ?? 0) > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth ?? 2;
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeText(line, x, lineY);
    }

    // Reset shadow for fill if stroke already casted shadow
    if (strokeColor && (strokeWidth ?? 0) > 0) {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = fill;
    ctx.fillText(line, x, lineY);
  });

  ctx.restore();
}

/**
 * Renders all visible layers onto a canvas context.
 */
export function renderOverlayCanvas(
  ctx: CanvasRenderingContext2D,
  layers: OverlayLayer[],
  width: number,
  height: number
): void {
  for (const layer of layers) {
    if (layer.visible === false) continue;
    ctx.save();

    if (layer.opacity !== undefined && layer.opacity >= 0 && layer.opacity <= 1) {
      ctx.globalAlpha = layer.opacity;
    }

    if (layer.rotation && layer.rotation !== 0) {
      const cx = (layer.x ?? 0) + (layer.width ?? 50) / 2;
      const cy = (layer.y ?? 0) + (layer.height ?? 50) / 2;
      ctx.translate(cx, cy);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    if (layer.type === 'text') {
      renderTextLayer(ctx, layer);
    } else if (layer.type === 'shape') {
      renderShapeLayer(ctx, layer);
    } else if (layer.type === 'icon') {
      renderIconLayer(ctx, layer);
    }

    ctx.restore();
  }
}

/**
 * Offscreen composite rendering: draws base image + visible overlay layers and exports blob.
 */
export async function exportCompositeImage(
  baseImage: HTMLImageElement | HTMLCanvasElement,
  layers: OverlayLayer[],
  format: 'image/png' | 'image/jpeg' = 'image/png',
  quality = 0.92
): Promise<Blob> {
  const width = ('naturalWidth' in baseImage && baseImage.naturalWidth) ? baseImage.naturalWidth : baseImage.width;
  const height = ('naturalHeight' in baseImage && baseImage.naturalHeight) ? baseImage.naturalHeight : baseImage.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize 2D canvas context for composite export.');
  }

  // Draw base image
  ctx.drawImage(baseImage, 0, 0, width, height);

  // Render visible overlay layers
  renderOverlayCanvas(ctx, layers, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob) {
          reject(new Error('Failed to export composite image to blob.'));
        } else {
          resolve(blob);
        }
      },
      format,
      format === 'image/jpeg' ? quality : undefined
    );
  });
}

/**
 * 1-Click Coordinated Thumbnail Presets.
 * Proportional scaling to given canvasWidth and canvasHeight.
 */
export function createThumbnailPreset(
  presetId: ThumbnailPresetId,
  canvasWidth: number,
  canvasHeight: number
): OverlayLayer[] {
  const w = canvasWidth;
  const h = canvasHeight;

  switch (presetId) {
    case 'youtube-impact':
      return [
        {
          id: `preset-yt-pill-${Date.now()}`,
          type: 'shape',
          shapeType: 'pill',
          x: Math.round(w * 0.05),
          y: Math.round(h * 0.08),
          width: Math.round(w * 0.36),
          height: Math.round(h * 0.12),
          fill: '#dc2626',
          stroke: '#ffffff',
          strokeWidth: 3,
          visible: true,
        },
        {
          id: `preset-yt-pill-txt-${Date.now()}`,
          type: 'text',
          text: 'DON\'T MISS THIS',
          fontFamily: 'Impact',
          fontSize: Math.max(16, Math.round(h * 0.075)),
          fill: '#ffffff',
          strokeColor: '#000000',
          strokeWidth: 2,
          x: Math.round(w * 0.08),
          y: Math.round(h * 0.095),
          width: Math.round(w * 0.30),
          height: Math.round(h * 0.09),
          visible: true,
        },
        {
          id: `preset-yt-headline-${Date.now()}`,
          type: 'text',
          text: 'INSANE RESULT!\nWATCH TILL END',
          fontFamily: 'Impact',
          fontSize: Math.max(24, Math.round(h * 0.14)),
          fill: '#facc15',
          strokeColor: '#000000',
          strokeWidth: Math.max(4, Math.round(h * 0.015)),
          shadowColor: 'rgba(0,0,0,0.85)',
          shadowBlur: 16,
          shadowOffsetX: 4,
          shadowOffsetY: 4,
          x: Math.round(w * 0.05),
          y: Math.round(h * 0.58),
          width: Math.round(w * 0.70),
          height: Math.round(h * 0.35),
          visible: true,
        },
        {
          id: `preset-yt-arrow-${Date.now()}`,
          type: 'shape',
          shapeType: 'arrow',
          direction: 'right',
          fill: '#ef4444',
          stroke: '#ffffff',
          strokeWidth: 4,
          x: Math.round(w * 0.72),
          y: Math.round(h * 0.30),
          width: Math.round(w * 0.22),
          height: Math.round(h * 0.18),
          visible: true,
        },
      ];

    case 'tech-clean':
      return [
        {
          id: `preset-tech-pill-${Date.now()}`,
          type: 'shape',
          shapeType: 'pill',
          x: Math.round(w * 0.06),
          y: Math.round(h * 0.08),
          width: Math.round(w * 0.38),
          height: Math.round(h * 0.11),
          fill: '#0f172a',
          stroke: '#38bdf8',
          strokeWidth: 3,
          visible: true,
        },
        {
          id: `preset-tech-icon-${Date.now()}`,
          type: 'icon',
          iconType: 'lightning',
          fill: '#38bdf8',
          size: Math.round(h * 0.07),
          x: Math.round(w * 0.08),
          y: Math.round(h * 0.095),
          width: Math.round(w * 0.06),
          height: Math.round(h * 0.08),
          visible: true,
        },
        {
          id: `preset-tech-tag-${Date.now()}`,
          type: 'text',
          text: 'PERFORMANCE BENCHMARK',
          fontFamily: 'Inter',
          fontSize: Math.max(14, Math.round(h * 0.048)),
          fill: '#38bdf8',
          x: Math.round(w * 0.15),
          y: Math.round(h * 0.11),
          width: Math.round(w * 0.27),
          height: Math.round(h * 0.06),
          visible: true,
        },
        {
          id: `preset-tech-title-${Date.now()}`,
          type: 'text',
          text: '10X FASTER CODE',
          fontFamily: 'Inter',
          fontSize: Math.max(22, Math.round(h * 0.13)),
          fill: '#ffffff',
          strokeColor: '#0f172a',
          strokeWidth: 4,
          shadowColor: 'rgba(0,0,0,0.7)',
          shadowBlur: 12,
          x: Math.round(w * 0.06),
          y: Math.round(h * 0.70),
          width: Math.round(w * 0.85),
          height: Math.round(h * 0.20),
          visible: true,
        },
      ];

    case 'breaking-alert':
      return [
        {
          id: `preset-alert-bar-${Date.now()}`,
          type: 'shape',
          shapeType: 'rect',
          x: 0,
          y: 0,
          width: w,
          height: Math.round(h * 0.16),
          fill: '#dc2626',
          visible: true,
        },
        {
          id: `preset-alert-icon-${Date.now()}`,
          type: 'icon',
          iconType: 'alert',
          fill: '#ffffff',
          size: Math.round(h * 0.10),
          x: Math.round(w * 0.03),
          y: Math.round(h * 0.03),
          width: Math.round(w * 0.07),
          height: Math.round(h * 0.10),
          visible: true,
        },
        {
          id: `preset-alert-hdr-${Date.now()}`,
          type: 'text',
          text: 'BREAKING NEWS UPDATE',
          fontFamily: 'Impact',
          fontSize: Math.max(18, Math.round(h * 0.09)),
          fill: '#ffffff',
          x: Math.round(w * 0.11),
          y: Math.round(h * 0.035),
          width: Math.round(w * 0.85),
          height: Math.round(h * 0.10),
          visible: true,
        },
        {
          id: `preset-alert-box-${Date.now()}`,
          type: 'shape',
          shapeType: 'badge',
          radius: 12,
          fill: 'rgba(0, 0, 0, 0.82)',
          stroke: '#dc2626',
          strokeWidth: 3,
          x: Math.round(w * 0.05),
          y: Math.round(h * 0.65),
          width: Math.round(w * 0.90),
          height: Math.round(h * 0.26),
          visible: true,
        },
        {
          id: `preset-alert-sub-${Date.now()}`,
          type: 'text',
          text: 'MAJOR POLICY CHANGE!',
          fontFamily: 'Impact',
          fontSize: Math.max(22, Math.round(h * 0.15)),
          fill: '#facc15',
          strokeColor: '#000000',
          strokeWidth: 6,
          x: Math.round(w * 0.08),
          y: Math.round(h * 0.69),
          width: Math.round(w * 0.84),
          height: Math.round(h * 0.20),
          visible: true,
        },
      ];

    case 'gaming-badge':
      return [
        {
          id: `preset-gaming-pill-${Date.now()}`,
          type: 'shape',
          shapeType: 'pill',
          x: Math.round(w * 0.05),
          y: Math.round(h * 0.08),
          width: Math.round(w * 0.34),
          height: Math.round(h * 0.14),
          fill: '#7c3aed',
          stroke: '#a855f7',
          strokeWidth: 4,
          visible: true,
        },
        {
          id: `preset-gaming-icon-${Date.now()}`,
          type: 'icon',
          iconType: 'fire',
          fill: '#f97316',
          size: Math.round(h * 0.10),
          x: Math.round(w * 0.07),
          y: Math.round(h * 0.095),
          width: Math.round(w * 0.07),
          height: Math.round(h * 0.10),
          visible: true,
        },
        {
          id: `preset-gaming-txt1-${Date.now()}`,
          type: 'text',
          text: 'WORLD RECORD',
          fontFamily: 'Impact',
          fontSize: Math.max(16, Math.round(h * 0.07)),
          fill: '#ffffff',
          strokeColor: '#4c1d95',
          strokeWidth: 3,
          x: Math.round(w * 0.15),
          y: Math.round(h * 0.11),
          width: Math.round(w * 0.22),
          height: Math.round(h * 0.08),
          visible: true,
        },
        {
          id: `preset-gaming-title-${Date.now()}`,
          type: 'text',
          text: 'SOLO VS SQUAD',
          fontFamily: 'Impact',
          fontSize: Math.max(26, Math.round(h * 0.18)),
          fill: '#4ade80',
          strokeColor: '#1e1b4b',
          strokeWidth: 8,
          shadowColor: '#4ade80',
          shadowBlur: 18,
          x: Math.round(w * 0.05),
          y: Math.round(h * 0.65),
          width: Math.round(w * 0.90),
          height: Math.round(h * 0.25),
          visible: true,
        },
      ];
  }
}
