import { useCallback, useEffect, useRef, useState } from 'react';
import type { Stroke, StrokePoint } from '../lib/types';
import { PAGE_WIDTH, drawStroke, newStrokeId, pointFromEvent } from '../lib/ink';

interface Props {
  ink: Stroke[];
  onChange: (ink: Stroke[]) => void;
  color: string;
  size: number;
  tool: 'pen' | 'eraser';
  /** aceita só a caneta e ignora o toque do dedo (evita marcas da mão) */
  penOnly?: boolean;
}

const ERASER_RADIUS = 0.028;

export default function InkCanvas({ ink, onChange, color, size, tool, penOnly = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveRef = useRef<Stroke | null>(null);
  const drawingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const erasingRef = useRef(false);
  const dprRef = useRef(1);
  const [penSeen, setPenSeen] = useState(false);

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = canvas.width / dprRef.current;
    const height = canvas.height / dprRef.current;
    ctx.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const scale = width / PAGE_WIDTH;
    for (const stroke of ink) drawStroke(ctx, stroke, width, height, scale);
    if (liveRef.current) drawStroke(ctx, liveRef.current, width, height, scale);
  }, [ink]);

  // repinta quando a tinta muda (carregar página, desfazer, apagar)
  useEffect(() => {
    repaint();
  }, [repaint]);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    dprRef.current = dpr;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    repaint();
  }, [repaint]);

  useEffect(() => {
    resize();
    const observer = new ResizeObserver(() => resize());
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [resize]);

  const eraseAt = useCallback(
    (point: StrokePoint) => {
      const remaining = ink.filter(
        (stroke) => !stroke.points.some((p) => Math.hypot(p.x - point.x, p.y - point.y) <= ERASER_RADIUS),
      );
      if (remaining.length === ink.length) return;
      onChange(remaining);
    },
    [ink, onChange],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (event.pointerType === 'pen') {
      if (!penSeen) setPenSeen(true);
    } else {
      // dedo: só desenha se o modo "só caneta" estiver desligado
      // (ou se a caneta nunca foi usada neste aparelho)
      if (penOnly || penSeen) return;
    }

    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    pointerIdRef.current = event.pointerId;
    drawingRef.current = true;
    const point = pointFromEvent(event.nativeEvent, canvas);

    if (tool === 'eraser') {
      erasingRef.current = true;
      eraseAt(point);
      return;
    }

    liveRef.current = { id: newStrokeId(), color, size, points: [point] };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !drawingRef.current || pointerIdRef.current !== event.pointerId) return;
    event.preventDefault();

    const native = event.nativeEvent;
    const coalesced =
      typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [];
    const events = coalesced.length ? coalesced : [native];

    if (erasingRef.current) {
      const last = events[events.length - 1];
      eraseAt(pointFromEvent(last, canvas));
      return;
    }

    const live = liveRef.current;
    if (!live) return;

    // se o evento não trouxe pressão (alguns navegadores zera no meio do traço),
    // repete a última pressão para não abrir um "degrau" na espessura
    const lastPressure = live.points[live.points.length - 1]?.p ?? 0.5;
    for (const item of events) {
      const point = pointFromEvent(item, canvas);
      if (!(item.pressure > 0)) point.p = lastPressure;
      live.points.push(point);
    }
    repaint();
  };

  const finish = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    drawingRef.current = false;
    pointerIdRef.current = null;

    const live = liveRef.current;
    liveRef.current = null;
    erasingRef.current = false;

    if (live && live.points.length) onChange([...ink, live]);
    repaint();
  };

  return (
    <canvas
      ref={canvasRef}
      className="ink-canvas"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onContextMenu={(event) => event.preventDefault()}
      style={{ touchAction: 'none', cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
    />
  );
}
