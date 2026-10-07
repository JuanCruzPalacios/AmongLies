"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket, connectSocket, disconnectSocket, type SessionReady } from "@/lib/socket";
import { t } from "@/lib/i18n";
import { useRoomStore } from "@/stores/roomStore";
import { usePlayerStore } from "@/stores/playerStore";

export function useSocket() {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(
    () => typeof window !== "undefined" && getSocket().connected
  );
  const { addPlayer, removePlayer, setRoom, setError, addChatMessage, updatePlayerConnection } = useRoomStore();

  useEffect(() => {
    const socket = getSocket();

    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    socket.on("room:player-joined", ({ player }) => {
      addPlayer(player);
    });

    socket.on("room:player-left", ({ playerId, newAdminId }) => {
      removePlayer(playerId, newAdminId);
    });

    socket.on("room:updated", ({ room }) => {
      setRoom(room);
    });

    // Reconexión automática (p. ej. se cortó el wifi): el servidor nos devuelve a la sala.
    function onSessionReady(data: SessionReady) {
      if (data.restored && data.room && data.playerId) {
        usePlayerStore.getState().setPlayerId(data.playerId);
        setRoom(data.room);
      }
    }

    function onSessionReplaced() {
      setRoom(null);
      setError(t("session.replaced", usePlayerStore.getState().locale));
      router.push("/");
    }

    socket.on("session:ready", onSessionReady);
    socket.on("session:replaced", onSessionReplaced);

    socket.on("room:kicked", () => {
      setRoom(null);
      disconnectSocket();
      router.push("/");
    });

    socket.on("chat:message", (message) => {
      addChatMessage(message);
    });

    socket.on("player:disconnected", ({ playerId }) => {
      updatePlayerConnection(playerId, false);
    });

    socket.on("player:reconnected", ({ playerId }) => {
      updatePlayerConnection(playerId, true);
    });

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room:player-joined");
      socket.off("room:player-left");
      socket.off("room:updated");
      socket.off("session:ready", onSessionReady);
      socket.off("session:replaced", onSessionReplaced);
      socket.off("room:kicked");
      socket.off("chat:message");
      socket.off("player:disconnected");
      socket.off("player:reconnected");
    };
  }, [router, addPlayer, removePlayer, setRoom, setError, addChatMessage, updatePlayerConnection]);

  return { isConnected, connect: connectSocket, disconnect: disconnectSocket };
}
