/**
 * Tiempo objetivo de la ronda, en décimas de segundo, entre `minSeconds` y
 * `maxSeconds` (si vienen invertidos, se ordenan).
 */
export function pickTargetMs(
  minSeconds: number,
  maxSeconds: number,
  random: () => number = Math.random,
): number {
  const low = Math.min(minSeconds, maxSeconds) * 10;
  const high = Math.max(minSeconds, maxSeconds) * 10;
  return Math.round(low + random() * (high - low)) * 100;
}

/**
 * El cliente mide su tiempo con `performance.now()` (más preciso que la red),
 * pero no puede informar más de lo que realmente pasó en el servidor ni algo
 * que no sea un número: en esos casos vale el tiempo del servidor.
 */
export function acceptStopTime(
  reportedMs: unknown,
  serverElapsedMs: number,
): number {
  const elapsed = Math.max(0, Math.round(serverElapsedMs));
  if (typeof reportedMs !== 'number' || !Number.isFinite(reportedMs))
    return elapsed;
  return Math.min(elapsed, Math.max(0, Math.round(reportedMs)));
}
