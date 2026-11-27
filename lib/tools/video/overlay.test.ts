// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ThumbnailOverlayEditor from '@/components/ThumbnailOverlayEditor';
import {
  createThumbnailPreset,
  drawRoundedRect,
  exportCompositeImage,
  getArrowPathPoints,
  getLightningPathPoints,
  getMultilineText,
  getStarPathPoints,
  hitTestLayers,
  normalizeLayerBounds,
  renderIconLayer,
  renderOverlayCanvas,
  renderShapeLayer,
  renderTextLayer,
  reorderLayers,
  type IconLayer,
  type OverlayLayer,
  type ShapeLayer,
  type TextLayer,
} from './overlay';

describe('Video Thumbnail Overlay Engine', () => {
  describe('normalizeLayerBounds', () => {
    it('handles negative width and height from inverted drag handles', () => {
      // Pulled from top-right to bottom-left: width is negative
      const normalizedW = normalizeLayerBounds(100, 100, -60, 40);
      expect(normalizedW).toEqual({ x: 40, y: 100, width: 60, height: 40 });

      // Pulled from bottom-left to top-right: height is negative
      const normalizedH = normalizeLayerBounds(50, 80, 70, -50);
      expect(normalizedH).toEqual({ x: 50, y: 30, width: 70, height: 50 });

      // Both negative
      const normalizedBoth = normalizeLayerBounds(150, 150, -80, -60);
      expect(normalizedBoth).toEqual({ x: 70, y: 90, width: 80, height: 60 });
    });

    it('clamps minimum dimensions to prevent invisible zero/sub-pixel layers', () => {
      const clamped = normalizeLayerBounds(10, 20, 2, 4);
      expect(clamped.width).toBe(10);
      expect(clamped.height).toBe(10);
    });

    it('constrains within canvas boundary bounds when supplied', () => {
      const bounded = normalizeLayerBounds(1250, 700, 100, 100, 1280, 720);
      expect(bounded.x).toBeLessThanOrEqual(1270);
      expect(bounded.y).toBeLessThanOrEqual(710);
    });
  });

  describe('hitTestLayers', () => {
    const textLayer: TextLayer = {
      id: 'text-1',
      type: 'text',
      x: 10,
      y: 10,
      width: 100,
      height: 50,
      text: 'Title',
      fontFamily: 'Inter',
      fontSize: 24,
      fill: '#ffffff',
      visible: true,
    };

    const shapeLayer: ShapeLayer = {
      id: 'shape-1',
      type: 'shape',
      shapeType: 'rect',
      x: 50,
      y: 40,
      width: 120,
      height: 80,
      fill: '#ff0000',
      visible: true,
    };

    const iconLayer: IconLayer = {
      id: 'icon-1',
      type: 'icon',
      iconType: 'play',
      x: 200,
      y: 200,
      width: 40,
      height: 40,
      fill: '#ffffff',
      visible: false, // Hidden layer
    };

    const layers: OverlayLayer[] = [textLayer, shapeLayer, iconLayer];

    it('returns the topmost layer at coordinates when layers overlap', () => {
      // Point (60, 45) is inside both text-1 (10..110, 10..60) and shape-1 (50..170, 40..120)
      // shape-1 is at higher index (rendered on top), so it should be returned
      const hit = hitTestLayers(layers, 60, 45);
      expect(hit?.id).toBe('shape-1');
    });

    it('returns underlying layer when point misses the top layer', () => {
      // Point (20, 20) is inside text-1 but outside shape-1
      const hit = hitTestLayers(layers, 20, 20);
      expect(hit?.id).toBe('text-1');
    });

    it('ignores hidden layers', () => {
      // Point (210, 210) is inside icon-1, but icon-1 is visible: false
      const hit = hitTestLayers(layers, 210, 210);
      expect(hit).toBeNull();
    });

    it('returns null for coordinates with no layers', () => {
      expect(hitTestLayers(layers, 500, 500)).toBeNull();
    });
  });

  describe('reorderLayers', () => {
    const layerA: OverlayLayer = { id: 'a', type: 'text', x: 0, y: 0, width: 10, height: 10, text: 'A', fontFamily: 'Inter', fontSize: 12, fill: '#fff', visible: true };
    const layerB: OverlayLayer = { id: 'b', type: 'text', x: 0, y: 0, width: 10, height: 10, text: 'B', fontFamily: 'Inter', fontSize: 12, fill: '#fff', visible: true };
    const layerC: OverlayLayer = { id: 'c', type: 'text', x: 0, y: 0, width: 10, height: 10, text: 'C', fontFamily: 'Inter', fontSize: 12, fill: '#fff', visible: true };

    const layers = [layerA, layerB, layerC];

    it('brings target layer to front', () => {
      const result = reorderLayers(layers, 'a', 'bringToFront');
      expect(result.map(l => l.id)).toEqual(['b', 'c', 'a']);
    });

    it('sends target layer to back', () => {
      const result = reorderLayers(layers, 'c', 'sendToBack');
      expect(result.map(l => l.id)).toEqual(['c', 'a', 'b']);
    });

    it('moves target layer up one step', () => {
      const result = reorderLayers(layers, 'a', 'moveUp');
      expect(result.map(l => l.id)).toEqual(['b', 'a', 'c']);
    });

    it('moves target layer down one step', () => {
      const result = reorderLayers(layers, 'c', 'moveDown');
      expect(result.map(l => l.id)).toEqual(['a', 'c', 'b']);
    });

    it('clamps boundaries gracefully when moving past ends', () => {
      // layerA is already at back (index 0)
      const moveDownBack = reorderLayers(layers, 'a', 'moveDown');
      expect(moveDownBack.map(l => l.id)).toEqual(['a', 'b', 'c']);

      // layerC is already at front (last index)
      const moveUpFront = reorderLayers(layers, 'c', 'moveUp');
      expect(moveUpFront.map(l => l.id)).toEqual(['a', 'b', 'c']);
    });

    it('returns duplicate array if layer id is not found', () => {
      const unchanged = reorderLayers(layers, 'non-existent', 'bringToFront');
      expect(unchanged.map(l => l.id)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('Vector path calculations', () => {
    it('calculates arrow points for all 4 cardinal directions', () => {
      const rightPoints = getArrowPathPoints(0, 0, 100, 50, 'right');
      expect(rightPoints.length).toBe(7);
      // Tip should be at (100, 25)
      expect(rightPoints[3]).toEqual([100, 25]);

      const leftPoints = getArrowPathPoints(0, 0, 100, 50, 'left');
      expect(leftPoints.length).toBe(7);
      // Tip should be at (0, 25)
      expect(leftPoints[3]).toEqual([0, 25]);

      const upPoints = getArrowPathPoints(0, 0, 50, 100, 'up');
      expect(upPoints.length).toBe(7);
      // Tip should be at (25, 0)
      expect(upPoints[3]).toEqual([25, 0]);

      const downPoints = getArrowPathPoints(0, 0, 50, 100, 'down');
      expect(downPoints.length).toBe(7);
      // Tip should be at (25, 100)
      expect(downPoints[3]).toEqual([25, 100]);
    });

    it('calculates 5-point star points with 10 alternating vertices', () => {
      const star = getStarPathPoints(50, 50, 40, 20);
      expect(star.length).toBe(10);
      // First point is top vertex (-PI/2) at (50, 50 - 40) = (50, 10)
      expect(Math.round(star[0][0])).toBe(50);
      expect(Math.round(star[0][1])).toBe(10);
    });

    it('calculates lightning bolt polygon points', () => {
      const lightning = getLightningPathPoints(0, 0, 100, 100);
      expect(lightning.length).toBe(6);
      expect(lightning[0][0]).toBeGreaterThan(0);
      expect(lightning[0][1]).toBeGreaterThan(0);
    });
  });

  describe('Text formatting and metrics', () => {
    it('splits multiline text by newline character', () => {
      expect(getMultilineText('Line 1\nLine 2\nLine 3')).toEqual(['Line 1', 'Line 2', 'Line 3']);
      expect(getMultilineText('Single line')).toEqual(['Single line']);
    });
  });

  describe('Canvas Rendering & Mock execution', () => {
    function createMockContext() {
      return {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        bezierCurveTo: vi.fn(),
        arc: vi.fn(),
        arcTo: vi.fn(),
        ellipse: vi.fn(),
        rect: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        fillText: vi.fn(),
        strokeText: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        drawImage: vi.fn(),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        font: '',
        textAlign: 'left',
        textBaseline: 'top',
        shadowColor: '',
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        globalAlpha: 1,
      } as unknown as CanvasRenderingContext2D;
    }

    it('renders rounded rectangles cleanly', () => {
      const ctx = createMockContext();
      drawRoundedRect(ctx, 10, 10, 100, 50, 8);
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.moveTo).toHaveBeenCalled();
      expect(ctx.arcTo).toHaveBeenCalledTimes(4);
      expect(ctx.closePath).toHaveBeenCalled();
    });

    it('renders text layer with stroke drawn before fill', () => {
      const ctx = createMockContext();
      const textLayer: TextLayer = {
        id: 'txt',
        type: 'text',
        x: 20,
        y: 30,
        width: 150,
        height: 60,
        text: 'Headline\nSubtitle',
        fontFamily: 'Impact',
        fontSize: 32,
        fill: '#facc15',
        strokeColor: '#000000',
        strokeWidth: 4,
        shadowColor: 'rgba(0,0,0,0.5)',
        shadowBlur: 8,
        visible: true,
      };

      renderTextLayer(ctx, textLayer);

      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.strokeText).toHaveBeenCalledWith('Headline', 20, 30);
      expect(ctx.fillText).toHaveBeenCalledWith('Headline', 20, 30);
      expect(ctx.restore).toHaveBeenCalled();
    });

    it('renders all shape layer types (rect, pill, badge, circle, arrow)', () => {
      const types: Array<'rect' | 'pill' | 'badge' | 'circle' | 'arrow'> = [
        'rect',
        'pill',
        'badge',
        'circle',
        'arrow',
      ];

      for (const shapeType of types) {
        const ctx = createMockContext();
        const shapeLayer: ShapeLayer = {
          id: `shape-${shapeType}`,
          type: 'shape',
          shapeType,
          x: 10,
          y: 10,
          width: 80,
          height: 40,
          fill: '#3b82f6',
          stroke: '#1e40af',
          strokeWidth: 2,
          radius: 6,
          direction: 'right',
          visible: true,
        };
        renderShapeLayer(ctx, shapeLayer);
        expect(ctx.fill).toHaveBeenCalled();
        expect(ctx.stroke).toHaveBeenCalled();
      }
    });

    it('renders all icon types (play, fire, alert, star, check, lightning)', () => {
      const icons: Array<'play' | 'fire' | 'alert' | 'star' | 'check' | 'lightning'> = [
        'play',
        'fire',
        'alert',
        'star',
        'check',
        'lightning',
      ];

      for (const iconType of icons) {
        const ctx = createMockContext();
        const iconLayer: IconLayer = {
          id: `icon-${iconType}`,
          type: 'icon',
          iconType,
          x: 10,
          y: 10,
          width: 50,
          height: 50,
          fill: '#f59e0b',
          stroke: '#b45309',
          strokeWidth: 2,
          visible: true,
        };
        renderIconLayer(ctx, iconLayer);
        expect(ctx.save).toHaveBeenCalled();
        expect(ctx.restore).toHaveBeenCalled();
      }
    });

    it('renders overlay canvas with layer transforms, skipping hidden layers', () => {
      const ctx = createMockContext();
      const layers: OverlayLayer[] = [
        {
          id: '1',
          type: 'text',
          x: 10,
          y: 10,
          width: 100,
          height: 40,
          text: 'Visible',
          fontFamily: 'Inter',
          fontSize: 16,
          fill: '#fff',
          visible: true,
          rotation: 45,
          opacity: 0.8,
        },
        {
          id: '2',
          type: 'shape',
          shapeType: 'circle',
          x: 50,
          y: 50,
          width: 60,
          height: 60,
          fill: '#ef4444',
          visible: false, // Hidden
        },
      ];

      renderOverlayCanvas(ctx, layers, 800, 600);
      expect(ctx.rotate).toHaveBeenCalled();
      expect(ctx.fillText).toHaveBeenCalledWith('Visible', 10, 10);
    });
  });

  describe('createThumbnailPreset', () => {
    const presets = ['youtube-impact', 'tech-clean', 'breaking-alert', 'gaming-badge'] as const;

    it.each(presets)('generates valid layers positioned within bounds for preset: %s', presetId => {
      const width = 1280;
      const height = 720;
      const layers = createThumbnailPreset(presetId, width, height);

      expect(layers.length).toBeGreaterThan(0);
      for (const layer of layers) {
        expect(layer.id).toBeTruthy();
        expect(layer.visible).toBe(true);
        expect(layer.width).toBeGreaterThan(0);
        expect(layer.height).toBeGreaterThan(0);
        expect(layer.x).toBeGreaterThanOrEqual(0);
        expect(layer.y).toBeGreaterThanOrEqual(0);
        expect(layer.x + layer.width).toBeLessThanOrEqual(width + 20);
        expect(layer.y + layer.height).toBeLessThanOrEqual(height + 20);
      }
    });
  });

  describe('exportCompositeImage', () => {
    it('creates offscreen canvas, renders base image and visible layers to blob', async () => {
      const mockBlob = new Blob(['mock-data'], { type: 'image/png' });
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({
          drawImage: vi.fn(),
          save: vi.fn(),
          restore: vi.fn(),
          fillText: vi.fn(),
        }),
        toBlob: vi.fn((callback: (b: Blob | null) => void) => callback(mockBlob)),
      };

      const origCreateElement = document.createElement.bind(document);
      const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement;
        return origCreateElement(tag);
      });

      const baseCanvas = {
        width: 1280,
        height: 720,
      } as unknown as HTMLCanvasElement;

      const layers: OverlayLayer[] = [
        {
          id: 'txt',
          type: 'text',
          x: 10,
          y: 10,
          width: 100,
          height: 40,
          text: 'Composite',
          fontFamily: 'Inter',
          fontSize: 20,
          fill: '#fff',
          visible: true,
        },
      ];

      const blob = await exportCompositeImage(baseCanvas, layers, 'image/png');
      expect(blob).toBe(mockBlob);
      expect(mockCanvas.width).toBe(1280);
      expect(mockCanvas.height).toBe(720);
      spy.mockRestore();
    });
  });

  describe('ThumbnailOverlayEditor Component', () => {
    afterEach(() => {
      cleanup();
      vi.restoreAllMocks();
    });

    it('renders editor workspace with toolbar, canvas stage, and initial preset layers', () => {
      const onClose = vi.fn();
      render(
        React.createElement(ThumbnailOverlayEditor, {
          src: 'blob:mock-image',
          name: 'frame-001.png',
          initialWidth: 1280,
          initialHeight: 720,
          onClose,
        })
      );

      expect(screen.getByText('Canvas Overlay Studio')).toBeTruthy();
      expect(screen.getByRole('button', { name: '← Back to Frames' })).toBeTruthy();
      expect(screen.getByRole('button', { name: '+ Add Heading' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Pill' })).toBeTruthy();
      expect(screen.getByRole('button', { name: '▶ Play' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Download Thumbnail' })).toBeTruthy();
    });

    it('adds text layer when Add Heading is clicked', async () => {
      const user = userEvent.setup();
      render(
        React.createElement(ThumbnailOverlayEditor, {
          src: 'blob:mock-image',
          name: 'frame-001.png',
          initialWidth: 1280,
          initialHeight: 720,
          onClose: vi.fn(),
        })
      );

      const addBtn = screen.getByRole('button', { name: '+ Add Heading' });
      await user.click(addBtn);

      expect(screen.getAllByText(/NEW TITLE/).length).toBeGreaterThan(0);
      expect(screen.getByText(/EDIT TEXT/i)).toBeTruthy();
    });

    it('applies 1-click presets when clicked', async () => {
      const user = userEvent.setup();
      render(
        React.createElement(ThumbnailOverlayEditor, {
          src: 'blob:mock-image',
          name: 'frame-001.png',
          initialWidth: 1280,
          initialHeight: 720,
          onClose: vi.fn(),
        })
      );

      const techBtn = screen.getByRole('button', { name: 'Tech' });
      await user.click(techBtn);

      // Tech preset contains '10X FASTER CODE'
      expect(screen.getAllByText(/10X FASTER/i).length).toBeGreaterThan(0);
    });

    it('calls onClose when Back to Frames button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        React.createElement(ThumbnailOverlayEditor, {
          src: 'blob:mock-image',
          name: 'frame-001.png',
          initialWidth: 1280,
          initialHeight: 720,
          onClose,
        })
      );

      await user.click(screen.getByRole('button', { name: '← Back to Frames' }));
      expect(onClose).toHaveBeenCalled();
    });
  });
});

