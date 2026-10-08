"use client";

import { useEffect, useRef } from "react";
import { DRAWING_ASPECT, type Stroke } from "@amonglies/shared";

interface Props {
  strokes: Stroke[];
  /** Si está, se puede dibujar: recibe cada punto normalizado (0–1). */
  onPointerStart?: (x: number, y: number) => void;
  onPointerMove?: (x: number, y: number) => void;
  onPointerEnd?: () => void;
  label: string;
}

function paint(ctx: CanvasRenderingContext2D, width: number, height: number, strokes: Stroke[]) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const stroke of strokes) {
    const p = stroke.points;
    if (p.length < 2) continue;
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineWidth = stroke.size * width;
    if (p.length === 2) {
      // Un toque sin arrastrar: un punto.
      ctx.beginPath();
      ctx.arc(p[0] * width, p[1] * height, (stroke.size * width) / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(p[0] * width, p[1] * height);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i] * width, p[i + 1] * height);
    ctx.stroke();
  }
}

/**
 * Lienzo 4:3 con coordenadas normalizadas: se ve igual en cualquier pantalla.
 * `touch-action: none` para que dibujar con el dedo no haga scroll.
 */
export function DrawingCanvas({ strokes, onPointerStart, onPointerMove, onPointerEnd, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const interactive = !!onPointerStart;

  // Repinta al cambiar los trazos o el tamaño (con la densidad de la pantalla).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const render = () => {
      const width = canvas.clientWidth;
      const height = width / DRAWING_ASPECT;
      const ratio = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(width * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      paint(ctx, width, height, strokes);
    };
    render();
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [strokes]);

  function point(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const rect = e.currentTarget.getBoundingClientRect();
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    return [clamp((e.clientX - rect.left) / rect.width), clamp((e.clientY - rect.top) / rect.height)];
  }

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      data-testid="drawing-canvas"
      className={`w-full rounded-2xl border border-border shadow-inner select-none ${interactive ? "cursor-crosshair" : ""}`}
      style={{ aspectRatio: `${DRAWING_ASPECT}`, touchAction: "none", background: "#ffffff" }}
      onPointerDown={(e) => {
        if (!interactive) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drawing.current = true;
        onPointerStart?.(...point(e));
      }}
      onPointerMove={(e) => {
        if (!drawing.current) return;
        onPointerMove?.(...point(e));
      }}
      onPointerUp={() => {
        if (!drawing.current) return;
        drawing.current = false;
        onPointerEnd?.();
      }}
      onPointerCancel={() => {
        if (!drawing.current) return;
        drawing.current = false;
        onPointerEnd?.();
      }}
    />
  );
}
