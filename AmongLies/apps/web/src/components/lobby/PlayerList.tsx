"use client";

import { Avatar } from "@/components/ui";
import { useRoomStore } from "@/stores/roomStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useTranslation } from "@/hooks/useTranslation";
import { getSocket } from "@/lib/socket";

export function PlayerList() {
  const { t } = useTranslation();
  const room = useRoomStore((s) => s.room);
  const myId = usePlayerStore((s) => s.playerId);

  if (!room) return null;

  const isAdmin = room.adminId === myId;

  function handleKick(playerId: string) {
    getSocket().emit("room:kick", { playerId });
  }

  function handleTransferAdmin(playerId: string) {
    getSocket().emit("room:transfer-admin", { playerId });
  }

  return (
    <div className="bg-bg-surface border border-border rounded-2xl p-4">
      <h3 className="font-display font-bold text-sm text-text-secondary mb-3 uppercase tracking-wider">
        {t("lobby.players")} ({room.players.length})
      </h3>
      <div className="space-y-2">
        {room.players.map((player) => (
          <div
            key={player.id}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
              !player.isConnected ? "opacity-40" : ""
            } ${player.id === myId ? "bg-primary/10 border border-primary/20" : "hover:bg-bg-surface-light"}`}
          >
            <Avatar avatarId={player.avatarId} size="sm" />
            <span className="flex-1 font-medium truncate text-sm">
              {player.nickname}
              {player.id === myId && (
                <span className="text-text-muted text-xs ml-1">{t("lobby.you")}</span>
              )}
              {!player.isConnected && (
                <span className="text-warning text-xs ml-1">{t("lobby.disconnected")}</span>
              )}
            </span>
            {player.isAdmin && (
              <span className="text-warning text-xs" title="Admin">
                👑
              </span>
            )}
            {isAdmin && player.id !== myId && (
              <div className="flex gap-1">
                <button
                  onClick={() => handleTransferAdmin(player.id)}
                  className="text-text-muted hover:text-warning text-xs cursor-pointer p-1"
                  title="Transfer admin"
                >
                  👑
                </button>
                <button
                  onClick={() => handleKick(player.id)}
                  className="text-text-muted hover:text-danger text-xs cursor-pointer p-1"
                  title="Kick"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
