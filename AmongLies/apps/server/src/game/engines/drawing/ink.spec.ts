import { clipToInk, inkLength, parsePoints } from '@amonglies/shared';

describe('parsePoints', () => {
  it('acepta pares de números y los redondea a milésimas', () => {
    expect(parsePoints([0.12345, 0.5, 1, 0], 10)).toEqual([0.123, 0.5, 1, 0]);
  });

  it('recorta los que se salen del lienzo', () => {
    expect(parsePoints([-0.5, 1.2, 0.3, 0.3], 10)).toEqual([0, 1, 0.3, 0.3]);
  });

  it('rechaza listas impares, vacías o con algo que no es número', () => {
    expect(parsePoints([0.1, 0.2, 0.3], 10)).toBeNull();
    expect(parsePoints([], 10)).toBeNull();
    expect(parsePoints([0.1, '0.2'], 10)).toBeNull();
    expect(parsePoints([0.1, NaN], 10)).toBeNull();
    expect(parsePoints([0.1, Infinity], 10)).toBeNull();
    expect(parsePoints('0.1,0.2', 10)).toBeNull();
    expect(parsePoints(null, 10)).toBeNull();
  });

  it('se queda con los primeros `max` puntos', () => {
    expect(parsePoints([0, 0, 0.1, 0.1, 0.2, 0.2], 2)).toEqual([
      0, 0, 0.1, 0.1,
    ]);
  });
});

describe('inkLength', () => {
  it('una línea de lado a lado gasta 1 ancho de lienzo', () => {
    expect(inkLength([0, 0.5, 1, 0.5])).toBeCloseTo(1);
  });

  it('de arriba a abajo gasta 3/4 (el lienzo es 4:3)', () => {
    expect(inkLength([0.5, 0, 0.5, 1])).toBeCloseTo(0.75);
  });

  it('suma los segmentos y cuenta desde el punto anterior si lo hay', () => {
    expect(inkLength([0.5, 0.5, 1, 0.5], [0, 0.5])).toBeCloseTo(1);
  });

  it('un solo punto no gasta tinta', () => {
    expect(inkLength([0.3, 0.3])).toBe(0);
  });
});

describe('clipToInk', () => {
  it('el primer punto de un trazo no gasta tinta', () => {
    expect(clipToInk(null, [0.2, 0.2], 0.5)).toEqual({
      points: [0.2, 0.2],
      used: 0,
    });
  });

  it('acepta todo si alcanza la tinta', () => {
    const r = clipToInk([0, 0.5], [0.25, 0.5, 0.5, 0.5], 1);
    expect(r.points).toEqual([0.25, 0.5, 0.5, 0.5]);
    expect(r.used).toBeCloseTo(0.5);
  });

  it('corta el último segmento justo donde se acaba la tinta', () => {
    const r = clipToInk([0, 0.5], [1, 0.5], 0.4);
    expect(r.points).toEqual([0.4, 0.5]);
    expect(r.used).toBeCloseTo(0.4);
  });

  it('gastar exactamente la tinta que queda no corta nada', () => {
    const r = clipToInk([0, 0.5], [0.5, 0.5], 0.5);
    expect(r.points).toEqual([0.5, 0.5]);
    expect(r.used).toBeCloseTo(0.5);
  });

  it('sin tinta no se acepta nada', () => {
    expect(clipToInk([0, 0], [0.5, 0.5], 0)).toEqual({ points: [], used: 0 });
    expect(clipToInk(null, [0.5, 0.5], 0)).toEqual({ points: [], used: 0 });
  });

  it('descarta pasos diminutos (mismo punto repetido)', () => {
    const r = clipToInk([0.5, 0.5], [0.5, 0.5, 0.5005, 0.5, 0.6, 0.5], 1);
    expect(r.points).toEqual([0.6, 0.5]);
    expect(r.used).toBeCloseTo(0.1);
  });
});
