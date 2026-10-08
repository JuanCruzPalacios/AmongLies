"use client";

import type { ClientEvents, ModerationResult } from "@amonglies/shared";
import { getSocket, whenSessionReady } from "./socket";

type AdminEvent = Extract<keyof ClientEvents, `admin:${string}`>;
type Payload<E extends AdminEvent> = Parameters<ClientEvents[E]>[0];
type Result<E extends AdminEvent> = Parameters<Parameters<ClientEvents[E]>[1]>[0];

/** Acciones del panel de admin (el servidor verifica en la base que seas admin). */
export function adminCall<E extends AdminEvent>(event: E, data: Payload<E>): Promise<Result<E>> {
  return new Promise((resolve) => {
    whenSessionReady(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (getSocket().timeout(15000) as any).emit(event, data, (err: unknown, result: Result<E>) =>
        resolve(err ? ({ ok: false, error: "unavailable" } as ModerationResult as Result<E>) : result),
      );
    });
  });
}
