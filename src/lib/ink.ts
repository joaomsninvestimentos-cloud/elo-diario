import type { Stroke, StrokePoint } from './types';

export const PAGE_WIDTH = 800;

export interface PenStyle {
  color: string;
  size: number;
}

export const PEN_COLORS = ['#1f2933', '#2563eb', '#dc2626', '#059669', '#7c3aed', '#b45309'];
export const PEN_SIZES = [2, 3.5, 6, 10];

const TAU = Math.PI * 2;

/** Pontos por traço — usado para amostrar a pressão suavemente. */
const pressureFactor = (p: number) => 0.45 + p * 0.85;

/**
 * Desenha um traço com largura variável conforme a pressão da caneta.
 * Cada segmento é um quadrilátero preenchido (em vez de stroke de largura fixa),
 * o que dá o efeito de tinta real e mantém a renderização barata.
 */
export const drawStroke = (
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  width: number,
  height: number,
  scale = 1,
) => {
  const pts = stroke.points;
  if (!pts.length) return;
  const base = stroke.size * scale;
  ctx.fillStyle = stroke.color;
  ctx.strokeStyle = stroke.color;

  if (pts.length === 1) {
    const r = (base * pressureFactor(pts[0].p)) / 2;
    ctx.beginPath();
    ctx.arc(pts[0].x * width, pts[0].y * height, Math.max(r, 0.7), 0, TAU);
    ctx.fill();
    return;
  }

  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1];
    const b = pts[i];
    const ax = a.x * width;
    const ay = a.y * height;
    const bx = b.x * width;
    const by = b.y * height;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len === 0) continue;

    const wa = Math.max((base * pressureFactor(a.p)) / 2, 0.35);
    const wb = Math.max((base * pressureFactor(b.p)) / 2, 0.35);
    const nx = (-dy / len) * 0.5;
    const ny = (dx / len) * 0.5;

    ctx.beginPath();
    ctx.moveTo(ax + nx * wa * 2, ay + ny * wa * 2);
    ctx.lineTo(bx + nx * wb * 2, by + ny * wb * 2);
    ctx.lineTo(bx - nx * wb * 2, by - ny * wb * 2);
    ctx.lineTo(ax - nx * wa * 2, ay - ny * wa * 2);
    ctx.closePath();
    ctx.fill();

    if (i > 1) {
      // tampa as junções para o traço não ficar "serrilhado" em curvas
      ctx.beginPath();
      ctx.arc(ax, ay, wa, 0, TAU);
      ctx.fill();
    }
  }

  const last = pts[pts.length - 1];
  ctx.beginPath();
  ctx.arc(
    last.x * width,
    last.y * height,
    Math.max((base * pressureFactor(last.p)) / 2, 0.35),
    0,
    TAU,
  );
  ctx.fill();
};

export const renderInk = (
  canvas: HTMLCanvasElement,
  ink: Stroke[],
  scale = 1,
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const stroke of ink) drawStroke(ctx, stroke, canvas.width, canvas.height, scale);
};

/** Gera uma miniatura PNG do desenho para usar como prévia na lista. */
export const inkToDataUrl = (ink: Stroke[], width = 320, height = 440): string | null => {
  if (!ink.length) return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  renderInk(canvas, ink, width / PAGE_WIDTH);
  return canvas.toDataURL('image/png');
};

export const newStrokeId = () => crypto.randomUUID();

export const pointFromEvent = (
  event: PointerEvent,
  element: HTMLElement,
): StrokePoint => {
  const rect = element.getBoundingClientRect();
  const pressure = event.pointerType === 'pen' ? Math.max(event.pressure, 0.05) : 0.55;
  return {
    x: Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1),
    y: Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1),
    p: pressure,
  };
};
