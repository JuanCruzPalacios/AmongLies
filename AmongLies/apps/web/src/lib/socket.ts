"use client";

import { io, type Socket } from "socket.io-client";
import type { ClientEvents, ServerEvents } from "@amonglies/shared";

type TypedSocket = Socket<ServerEvents, ClientEvents>;

let socket: TypedSocket | null = null;

export function getSocket(): TypedSocket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3001";
    socket = io(url, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ["websocket", "polling"],
    }) as TypedSocket;
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
