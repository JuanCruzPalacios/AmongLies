import { DRAWING_ASPECT } from '../constants/drawing';

/** Pasos más chicos que esto (en anchos de lienzo) no suman nada al dibujo. */
const MIN_STEP = 0.002;

export type InkPoint = [number, number];

/**
 * Valida los puntos que manda el cliente: pares de números, recortados al
 * lienzo y redondeados a milésimas. Devuelve null si el formato no sirve.
 */
export function parsePoints(raw: unknown, maxPoints: number): number[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length % 2 !== 0)
    return null;
  if (!raw.every((n) => typeof n === 'number' && Number.isFinite(n)))
    return null;
  return (raw as number[])
    .slice(0, maxPoints * 2)
    .map((n) => Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000);
}

/** Distancia en anchos de lienzo (y se normaliza sobre el alto, que es menor). */
function distance([x0, y0]: InkPoint, [x1, y1]: InkPoint): number {
  return Math.hypot(x1 - x0, (y1 - y0) / DRAWING_ASPECT);
}

function toPairs(points: number[]): InkPoint[] {
  const pairs: InkPoint[] = [];
  for (let i = 0; i < points.length; i += 2)
    pairs.push([points[i], points[i + 1]]);
  return pairs;
}

/** Tinta que gasta un recorrido, desde `from` si el trazo ya venía de antes. */
export function inkLength(points: number[], from: InkPoint | null = null): number {
  let prev = from;
  let total = 0;
  for (const point of toPairs(points)) {
    if (prev) total += distance(prev, point);
    prev = point;
  }
  return total;
}

/**
 * Se queda con los puntos que entran en la tinta que queda. El último segmento
 * se corta justo donde se termina la tinta. `prev` es el último punto del
 * trazo (null si el trazo recién empieza: su primer punto no gasta).
 */
export function clipToInk(
  prev: InkPoint | null,
  points: number[],
  inkLeft: number,
): { points: number[]; used: number } {
  const accepted: number[] = [];
  let used = 0;
  if (inkLeft <= 0) return { points: accepted, used };

  let last = prev;
  for (const point of toPairs(points)) {
    if (!last) {
      accepted.push(...point);
      last = point;
      continue;
    }
    const step = distance(last, point);
    if (step < MIN_STEP) continue;

    const left = inkLeft - used;
    if (step > left) {
      const t = left / step;
      const cut: InkPoint = [
        Math.round((last[0] + (point[0] - last[0]) * t) * 1000) / 1000,
        Math.round((last[1] + (point[1] - last[1]) * t) * 1000) / 1000,
      ];
      accepted.push(...cut);
      used = inkLeft;
      break;
    }
    accepted.push(...point);
    used += step;
    last = point;
  }
  return { points: accepted, used };
}
