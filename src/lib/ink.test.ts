import { describe, expect, it } from 'vitest';
import { drawStroke } from './ink';
import type { Stroke } from './types';

const stroke = (points: Stroke['points']): Stroke => ({
  id: 's1',
  color: '#1f2933',
  size: 3,
  points,
});

describe('drawStroke', () => {
  it('não quebra com traço vazio', () => {
    const calls: unknown[] = [];
    const ctx = {
      fillStyle: '',
      strokeStyle: '',
      beginPath: () => calls.push('begin'),
      arc: () => calls.push('arc'),
      fill: () => calls.push('fill'),
      moveTo: () => undefined,
      lineTo: () => undefined,
      closePath: () => undefined,
    } as unknown as CanvasRenderingContext2D;
    expect(() => drawStroke(ctx, stroke([]), 800, 1200)).not.toThrow();
    expect(calls).toHaveLength(0);
  });

  it('desenha um ponto único como círculo proporcional à pressão', () => {
    const radii: number[] = [];
    const ctx = {
      fillStyle: '',
      strokeStyle: '',
      beginPath: () => undefined,
      arc: (_x: number, _y: number, r: number) => radii.push(r),
      fill: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      closePath: () => undefined,
    } as unknown as CanvasRenderingContext2D;

    drawStroke(ctx, stroke([{ x: 0.5, y: 0.5, p: 0.2 }]), 800, 1200);
    drawStroke(ctx, stroke([{ x: 0.5, y: 0.5, p: 1 }]), 800, 1200);

    expect(radii).toHaveLength(2);
    expect(radii[1]).toBeGreaterThan(radii[0]);
  });

  it('mais pressão produz traço mais largo', () => {
    const widths: number[] = [];
    const ctx = {
      fillStyle: '',
      strokeStyle: '',
      beginPath: () => undefined,
      arc: () => undefined,
      fill: () => undefined,
      moveTo: (x: number, y: number) => widths.push(Math.hypot(x - 400, y - 600)),
      lineTo: () => undefined,
      closePath: () => undefined,
    } as unknown as CanvasRenderingContext2D;

    drawStroke(
      ctx,
      stroke([
        { x: 0.5, y: 0.5, p: 0.1 },
        { x: 0.6, y: 0.5, p: 0.1 },
      ]),
      800,
      1200,
    );
    const light = Math.max(...widths);
    widths.length = 0;
    drawStroke(
      ctx,
      stroke([
        { x: 0.5, y: 0.5, p: 1 },
        { x: 0.6, y: 0.5, p: 1 },
      ]),
      800,
      1200,
    );
    expect(Math.max(...widths)).toBeGreaterThan(light);
  });
});
