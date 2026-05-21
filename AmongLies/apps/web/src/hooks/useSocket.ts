"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket, connectSocket, disconnectSocket } from "@/lib/socket";
import { useRoomStore } from "@/stores/roomStore";
import { usePlayerStore } from "@/stores/playerStore";

export function useSocket() {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const { addPlayer, removePlayer, setRoom, addChatMessage, updatePlayerConnection } = useRoomStore();

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

    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room:player-joined");
      socket.off("room:player-left");
      socket.off("room:updated");
      socket.off("room:kicked");
      socket.off("chat:message");
      socket.off("player:disconnected");
      socket.off("player:reconnected");
    };
  }, [addPlayer, removePlayer, setRoom, addChatMessage, updatePlayerConnection]);

  return { isConnected, connect: connectSocket, disconnect: disconnectSocket };
}
