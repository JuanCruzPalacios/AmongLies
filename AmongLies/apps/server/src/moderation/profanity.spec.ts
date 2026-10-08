import { censor, containsProfanity } from '@amonglies/shared';

describe('containsProfanity', () => {
  it('detecta insultos en español e inglés', () => {
    expect(containsProfanity('sos un pelotudo')).toBe(true);
    expect(containsProfanity('what the fuck')).toBe(true);
  });

  it('no importan mayúsculas, acentos, letras estiradas ni leetspeak', () => {
    expect(containsProfanity('IMBÉCIL')).toBe(true);
    expect(containsProfanity('mieeeeerda')).toBe(true);
    expect(containsProfanity('p3l0tud0')).toBe(true);
    expect(containsProfanity('$hit')).toBe(true);
  });

  it('plurales y palabras pegadas conocidas', () => {
    expect(containsProfanity('idiotas')).toBe(true);
    expect(containsProfanity('hijodeputa')).toBe(true);
  });

  it('no marca palabras normales que contienen un insulto adentro', () => {
    for (const ok of [
      'computadora',
      'disputa',
      'Scunthorpe',
      'class',
      'mierdame',
      'putamen',
      'perro',
      'cocina',
      'hello',
      '',
    ])
      expect(containsProfanity(ok)).toBe(false);
  });
});

describe('censor', () => {
  it('reemplaza sólo el insulto por asteriscos, del mismo largo', () => {
    expect(censor('che, sos un IDIOTA jaja')).toBe('che, sos un ****** jaja');
  });

  it('respeta lo demás del texto (signos, emojis, espacios)', () => {
    expect(censor('¡mierda! 😅  ok')).toBe('¡******! 😅  ok');
  });

  it('varios insultos en el mismo mensaje', () => {
    expect(censor('fuck you, asshole')).toBe('**** you, *******');
  });

  it('sin insultos devuelve el mismo texto', () => {
    expect(censor('la computadora anda bien')).toBe('la computadora anda bien');
  });
});
