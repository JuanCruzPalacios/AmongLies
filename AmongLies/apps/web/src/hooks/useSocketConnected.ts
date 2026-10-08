"use client";

import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket";

/** Si el socket está conectado (para mostrar el estado de la conexión). */
export function useSocketConnected(): boolean {
  const [connected, setConnected] = useState(() => typeof window !== "undefined" && getSocket().connected);
  useEffect(() => {
    const socket = getSocket();
    const on = () => setConnected(true);
    const off = () => setConnected(false);
    socket.on("connect", on);
    socket.on("disconnect", off);
    return () => {
      socket.off("connect", on);
      socket.off("disconnect", off);
    };
  }, []);
  return connected;
}
