import { acceptStopTime, pickTargetMs } from './time.rules.js';

describe('pickTargetMs', () => {
  it('con azar 0 da el mínimo y con azar ~1 el máximo', () => {
    expect(pickTargetMs(5, 20, () => 0)).toBe(5000);
    expect(pickTargetMs(5, 20, () => 0.9999)).toBe(20000);
  });

  it('redondea a décimas de segundo', () => {
    expect(pickTargetMs(5, 20, () => 0.5)).toBe(12500);
    expect(pickTargetMs(5, 6, () => 0.333) % 100).toBe(0);
  });

  it('si mínimo y máximo vienen invertidos, los ordena', () => {
    expect(pickTargetMs(20, 5, () => 0)).toBe(5000);
  });

  it('con mínimo igual a máximo siempre da ese tiempo', () => {
    expect(pickTargetMs(8, 8, () => 0.7)).toBe(8000);
  });
});

describe('acceptStopTime', () => {
  it('acepta el tiempo del cliente si es menor o igual al del servidor', () => {
    expect(acceptStopTime(9876, 10000)).toBe(9876);
    expect(acceptStopTime(10000, 10000)).toBe(10000);
  });

  it('no deja informar más de lo que pasó en el servidor', () => {
    expect(acceptStopTime(10001, 10000)).toBe(10000);
    expect(acceptStopTime(999999, 3000)).toBe(3000);
  });

  it('un tiempo negativo cuenta como 0', () => {
    expect(acceptStopTime(-50, 3000)).toBe(0);
  });

  it.each([['12'], [null], [undefined], [NaN], [Infinity], [{ ms: 5 }]])(
    'si el cliente manda algo que no es un número (%p), vale el del servidor',
    (reported) => {
      expect(acceptStopTime(reported, 4321)).toBe(4321);
    },
  );

  it('redondea a milisegundos enteros', () => {
    expect(acceptStopTime(1234.6, 5000)).toBe(1235);
  });
});
