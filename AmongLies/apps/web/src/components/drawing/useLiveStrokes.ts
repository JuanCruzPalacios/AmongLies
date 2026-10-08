"use client";

import { useEffect, useState } from "react";
import type { DrawEvent, Stroke } from "@amonglies/shared";
import { getSocket } from "@/lib/socket";

function apply(strokes: Stroke[], event: DrawEvent): Stroke[] {
  if (event.kind === "start") return [...strokes, event.stroke];
  const last = strokes[strokes.length - 1];
  if (!last) return strokes;
  return [...strokes.slice(0, -1), { ...last, points: [...last.points, ...event.points] }];
}

/**
 * El dibujo de la partida: lo que mandó el servidor en el último estado más
 * los trazos que van llegando en vivo. `ignoreLive` para quien está dibujando,
 * que ya ve sus trazos sin esperar al servidor.
 */
export function useLiveStrokes(serverStrokes: Stroke[], ignoreLive: boolean): Stroke[] {
  const [live, setLive] = useState({ base: serverStrokes, strokes: serverStrokes });
  // Cada estado nuevo del servidor es la verdad: reemplaza lo acumulado en vivo.
  if (live.base !== serverStrokes) setLive({ base: serverStrokes, strokes: serverStrokes });

  useEffect(() => {
    if (ignoreLive) return;
    const socket = getSocket();
    const handler = (event: DrawEvent) => setLive((prev) => ({ ...prev, strokes: apply(prev.strokes, event) }));
    socket.on("game:draw", handler);
    return () => {
      socket.off("game:draw", handler);
    };
  }, [ignoreLive]);

  return live.strokes;
}
