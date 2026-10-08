import { REPORT_REASONS, type ReportReason } from '@amonglies/shared';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Hasta cuándo queda suspendida una cuenta (`null` = permanente). Inválido → null. */
export function suspensionEnd(days: number | null, now: number): string | null {
  if (days === null) return 'infinity';
  if (!Number.isInteger(days) || days < 1 || days > 365) return null;
  return new Date(now + days * DAY_MS).toISOString();
}

export function isSuspendedAt(until: string | null, now: number): boolean {
  if (!until) return false;
  if (until === 'infinity') return true;
  return Date.parse(until) > now;
}

export function sanitizeReport(
  input: unknown,
): { reason: ReportReason; details: string } | null {
  if (typeof input !== 'object' || input === null) return null;
  const { reason, details } = input as { reason?: unknown; details?: unknown };
  if (!(REPORT_REASONS as readonly unknown[]).includes(reason)) return null;
  return {
    reason: reason as ReportReason,
    details: typeof details === 'string' ? details.trim().slice(0, 300) : '',
  };
}

/** Cuántas veces se puede hacer algo por clave en una ventana de tiempo. */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  take(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter(
      (t) => now - t < this.windowMs,
    );
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}
