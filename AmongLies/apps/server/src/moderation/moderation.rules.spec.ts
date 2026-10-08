import {
  RateLimiter,
  isSuspendedAt,
  sanitizeReport,
  suspensionEnd,
} from './moderation.rules.js';

const NOW = Date.parse('2026-10-08T12:00:00Z');

describe('suspensionEnd', () => {
  it('suma días a ahora', () => {
    expect(suspensionEnd(3, NOW)).toBe('2026-10-11T12:00:00.000Z');
  });

  it('null es permanente', () => {
    expect(suspensionEnd(null, NOW)).toBe('infinity');
  });

  it('días inválidos (0, negativos, decimales raros, > 365) no sirven', () => {
    expect(suspensionEnd(0, NOW)).toBeNull();
    expect(suspensionEnd(-1, NOW)).toBeNull();
    expect(suspensionEnd(366, NOW)).toBeNull();
    expect(suspensionEnd(Number.NaN, NOW)).toBeNull();
    expect(suspensionEnd(1.5, NOW)).toBeNull();
  });
});

describe('isSuspendedAt', () => {
  it('sin fecha no está suspendido', () => {
    expect(isSuspendedAt(null, NOW)).toBe(false);
  });

  it('suspendido hasta una fecha futura, y ya no después', () => {
    expect(isSuspendedAt('2026-10-09T00:00:00Z', NOW)).toBe(true);
    expect(isSuspendedAt('2026-10-08T11:59:59Z', NOW)).toBe(false);
  });

  it('"infinity" es para siempre', () => {
    expect(isSuspendedAt('infinity', NOW)).toBe(true);
  });
});

describe('sanitizeReport', () => {
  it('acepta un motivo válido y recorta el detalle a 300', () => {
    expect(
      sanitizeReport({ reason: 'insults', details: `  ${'a'.repeat(400)}  ` }),
    ).toEqual({ reason: 'insults', details: 'a'.repeat(300) });
  });

  it('el detalle es opcional', () => {
    expect(sanitizeReport({ reason: 'spam' })).toEqual({
      reason: 'spam',
      details: '',
    });
  });

  it('motivo inventado o datos que no son objeto', () => {
    expect(sanitizeReport({ reason: 'me cae mal' })).toBeNull();
    expect(sanitizeReport(null)).toBeNull();
    expect(sanitizeReport('insults')).toBeNull();
  });
});

describe('RateLimiter', () => {
  it('deja hacer hasta el máximo dentro de la ventana y después de que pasa', () => {
    const limiter = new RateLimiter(2, 1000);
    expect(limiter.take('a', 0)).toBe(true);
    expect(limiter.take('a', 100)).toBe(true);
    expect(limiter.take('a', 200)).toBe(false);
    expect(limiter.take('b', 200)).toBe(true);
    expect(limiter.take('a', 1001)).toBe(true);
  });
});
