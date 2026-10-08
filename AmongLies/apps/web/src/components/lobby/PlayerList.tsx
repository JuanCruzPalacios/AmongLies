"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui";
import { ReportDialog, type ReportTarget } from "@/components/moderation/ReportDialog";
import { useRoomStore } from "@/stores/roomStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useTranslation } from "@/hooks/useTranslation";
import { getSocket } from "@/lib/socket";

export function PlayerList() {
  const { t } = useTranslation();
  const room = useRoomStore((s) => s.room);
  const myId = usePlayerStore((s) => s.playerId);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

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
              <span className="text-warning text-xs" title={t("lobby.admin")}>
                👑
              </span>
            )}
            {player.id !== myId && (
              <button
                onClick={() => setReportTarget({ kind: "player", playerId: player.id, name: player.nickname })}
                className="text-text-muted hover:text-danger text-xs cursor-pointer p-1"
                title={t("report.action")}
                aria-label={t("report.action_player", { name: player.nickname })}
              >
                ⚑
              </button>
            )}
            {isAdmin && player.id !== myId && (
              <div className="flex gap-1">
                <button
                  onClick={() => handleTransferAdmin(player.id)}
                  className="text-text-muted hover:text-warning text-xs cursor-pointer p-1"
                  title={t("lobby.transfer_admin")}
                  aria-label={t("lobby.transfer_admin_to", { name: player.nickname })}
                >
                  👑
                </button>
                <button
                  onClick={() => handleKick(player.id)}
                  className="text-text-muted hover:text-danger text-xs cursor-pointer p-1"
                  title={t("lobby.kick")}
                  aria-label={t("lobby.kick_player", { name: player.nickname })}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <ReportDialog target={reportTarget} onClose={() => setReportTarget(null)} />
    </div>
  );
}
