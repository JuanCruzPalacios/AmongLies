"use client";

import { useEffect, useState } from "react";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3001";
/** Render duerme el servidor a los 15 min sin tráfico HTTP: con 4 min sobra. */
const KEEP_ALIVE_MS = 4 * 60 * 1000;

/** Mientras estás en una sala, avisa al servidor que hay gente (para que no se duerma). */
export function useServerKeepAlive(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const ping = () => void fetch(`${SERVER_URL}/health`, { cache: "no-store" }).catch(() => {});
    ping();
    const id = setInterval(ping, KEEP_ALIVE_MS);
    return () => clearInterval(id);
  }, [active]);
}

/** Hasta cuánto esperar al servidor al crear o unirse (si estaba dormido tarda ~1 min). */
export const CONNECT_TIMEOUT_MS = 70 * 1000;

/** true si se está conectando hace más de unos segundos (probablemente el servidor se está despertando). */
export function useWakeNotice(isConnecting: boolean): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!isConnecting) return;
    const id = setTimeout(() => setSlow(true), 4000);
    return () => {
      clearTimeout(id);
      setSlow(false);
    };
  }, [isConnecting]);
  return isConnecting && slow;
}
