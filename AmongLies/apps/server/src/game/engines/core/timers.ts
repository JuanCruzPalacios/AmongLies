interface TimerEntry {
  callback: () => void;
  /** ms que faltan cuando el timer está pausado. */
  remaining: number;
  /** Momento en que vence, mientras corre. */
  dueAt: number;
  handle: ReturnType<typeof setTimeout> | null;
}

/** Timers con nombre que se pueden pausar y reanudar conservando el tiempo restante. */
export class PausableTimers {
  private timers = new Map<string, TimerEntry>();
  private paused = false;

  set(name: string, ms: number, callback: () => void): void {
    this.clear(name);
    const entry: TimerEntry = {
      callback,
      remaining: ms,
      dueAt: 0,
      handle: null,
    };
    this.timers.set(name, entry);
    if (!this.paused) this.schedule(name, entry);
  }

  clear(name: string): void {
    const entry = this.timers.get(name);
    if (entry?.handle) clearTimeout(entry.handle);
    this.timers.delete(name);
  }

  clearAll(): void {
    for (const name of [...this.timers.keys()]) this.clear(name);
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    const now = Date.now();
    for (const entry of this.timers.values()) {
      if (entry.handle) clearTimeout(entry.handle);
      entry.handle = null;
      entry.remaining = Math.max(0, entry.dueAt - now);
    }
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    for (const [name, entry] of this.timers) this.schedule(name, entry);
  }

  private schedule(name: string, entry: TimerEntry): void {
    entry.dueAt = Date.now() + entry.remaining;
    entry.handle = setTimeout(() => {
      this.timers.delete(name);
      entry.callback();
    }, entry.remaining);
  }
}
