import { PausableTimers } from './timers.js';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('PausableTimers', () => {
  it('ejecuta el callback cuando vence', () => {
    const timers = new PausableTimers();
    const cb = jest.fn();
    timers.set('a', 1000, cb);
    jest.advanceTimersByTime(999);
    expect(cb).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('pausado no vence nunca', () => {
    const timers = new PausableTimers();
    const cb = jest.fn();
    timers.set('a', 1000, cb);
    timers.pause();
    jest.advanceTimersByTime(60_000);
    expect(cb).not.toHaveBeenCalled();
  });

  it('al reanudar respeta el tiempo que quedaba (400 de 1000)', () => {
    const timers = new PausableTimers();
    const cb = jest.fn();
    timers.set('a', 1000, cb);
    jest.advanceTimersByTime(600);
    timers.pause();
    jest.advanceTimersByTime(10_000);
    timers.resume();
    jest.advanceTimersByTime(399);
    expect(cb).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('un timer creado durante la pausa arranca recién al reanudar', () => {
    const timers = new PausableTimers();
    const cb = jest.fn();
    timers.pause();
    timers.set('a', 500, cb);
    jest.advanceTimersByTime(5000);
    expect(cb).not.toHaveBeenCalled();
    timers.resume();
    jest.advanceTimersByTime(500);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('volver a setear el mismo nombre reemplaza al anterior', () => {
    const timers = new PausableTimers();
    const first = jest.fn();
    const second = jest.fn();
    timers.set('a', 1000, first);
    timers.set('a', 2000, second);
    jest.advanceTimersByTime(2000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('clear y clearAll cancelan sin ejecutar', () => {
    const timers = new PausableTimers();
    const a = jest.fn();
    const b = jest.fn();
    timers.set('a', 100, a);
    timers.set('b', 100, b);
    timers.clear('a');
    jest.advanceTimersByTime(50);
    timers.clearAll();
    jest.advanceTimersByTime(1000);
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it('pausar o reanudar dos veces no cambia el resultado', () => {
    const timers = new PausableTimers();
    const cb = jest.fn();
    timers.set('a', 1000, cb);
    jest.advanceTimersByTime(300);
    timers.pause();
    timers.pause();
    timers.resume();
    timers.resume();
    jest.advanceTimersByTime(699);
    expect(cb).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
