"use client";

import { io, type Socket } from "socket.io-client";
import type { ClientEvents, ServerEvents, SocketAuth } from "@amonglies/shared";
import { getSessionToken } from "./session";

type TypedSocket = Socket<ServerEvents, ClientEvents>;
export type SessionReady = Parameters<ServerEvents["session:ready"]>[0];

let socket: TypedSocket | null = null;
let accessToken: string | null = null;
let sessionReady: SessionReady | null = null;

export function getSocket(): TypedSocket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3001";
    socket = io(url, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ["websocket", "polling"],
      // Se evalúa en cada (re)conexión: así el servidor reconoce al mismo jugador.
      auth: (cb) => {
        const auth: SocketAuth = { sessionToken: getSessionToken() };
        if (accessToken) auth.accessToken = accessToken;
        cb(auth);
      },
    }) as TypedSocket;
    socket.on("session:ready", (data) => {
      sessionReady = data;
    });
    socket.on("disconnect", () => {
      sessionReady = null;
    });
  }
  return socket;
}

export function connectSocket(): TypedSocket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}

/** Ejecuta `cb` cuando el servidor ya identificó a este jugador. */
export function whenSessionReady(cb: (data: SessionReady) => void): void {
  const s = connectSocket();
  if (sessionReady) cb(sessionReady);
  else s.once("session:ready", cb);
}

/**
 * Cambió la sesión de Supabase (login o logout). Si el socket ya estaba
 * conectado, se reconecta para que el servidor lo identifique con la cuenta.
 */
export function setAccessToken(token: string | null): void {
  if (token === accessToken) return;
  accessToken = token;
  if (socket?.connected) {
    socket.disconnect();
    socket.connect();
  }
}
