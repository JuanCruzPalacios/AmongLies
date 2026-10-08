"use client";

import { useSocket } from "@/hooks/useSocket";

/**
 * Escucha los eventos de la sala (chat, jugadores, reconexión) en toda la app.
 * Si vivieran sólo en la página de la sala, lo que llega mientras se navega
 * hacia ella (p. ej. justo al unirse desde la home) se perdería.
 */
export function RoomEvents() {
  useSocket();
  return null;
}
