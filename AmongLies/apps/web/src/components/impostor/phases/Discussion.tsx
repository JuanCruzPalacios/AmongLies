"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { ImpostorPlayerView, Room } from "@amonglies/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Avatar } from "@/components/ui";
import { useRoomStore } from "@/stores/roomStore";
import { usePlayerStore } from "@/stores/playerStore";
import { getSocket } from "@/lib/socket";

interface Props {
  gameState: ImpostorPlayerView;
  room: Room;
}

export function Discussion({ gameState, room }: Props) {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState(gameState.settings.discussionTimeSeconds);
  const [message, setMessage] = useState("");
  const chatMessages = useRoomStore((s) => s.room?.chat ?? []);
  const myId = usePlayerStore((s) => s.playerId);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress = timeLeft / gameState.settings.discussionTimeSeconds;

  function handleSend() {
    const trimmed = message.trim();
    if (!trimmed) return;
    getSocket().emit("chat:send", { message: trimmed });
    setMessage("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      {/* Timer + words summary */}
      <div className="bg-bg-surface border border-border rounded-3xl p-6">
        <h2 className="font-display text-2xl font-bold text-warning text-center mb-4">
          {t("game.impostor.discussion")}
        </h2>

        {/* Timer circle */}
        <div className="relative w-32 h-32 mx-auto mb-5">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" fill="none" stroke="var(--color-bg-surface-light)" strokeWidth="8" />
            <circle
              cx="60" cy="60" r="54" fill="none"
              stroke={timeLeft < 10 ? "var(--color-danger)" : "var(--color-warning)"}
              strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 54}`}
              strokeDashoffset={`${2 * Math.PI * 54 * (1 - progress)}`}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`font-mono text-3xl font-bold ${timeLeft < 10 ? "text-danger" : "text-warning"}`}>
              {minutes}:{seconds.toString().padStart(2, "0")}
            </span>
          </div>
        </div>

        {/* Words said this round */}
        {gameState.wordsUsed.length > 0 && (
          <div className="border-t border-border pt-4">
            <p className="text-text-muted text-xs mb-3 uppercase tracking-wider text-center">
              {t("game.impostor.words_said")}
            </p>
            <div className="space-y-1.5">
              {gameState.wordsUsed.map((entry, i) => {
                const player = room.players.find((p) => p.id === entry.playerId);
                return (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-bg-surface-light">
                    <Avatar avatarId={player?.avatarId || "fox"} size="sm" />
                    <span className="text-sm text-text-secondary flex-1">{player?.nickname}</span>
                    <span className="font-mono text-sm text-primary font-semibold">{entry.word}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Discussion chat */}
      <div className="bg-bg-surface border border-border rounded-2xl flex flex-col" style={{ height: "280px" }}>
        <h3 className="font-display font-bold text-sm text-text-secondary px-4 pt-3 pb-2 uppercase tracking-wider">
          {t("game.impostor.discussion_chat")}
        </h3>
        <div className="flex-1 overflow-y-auto px-4 space-y-2 min-h-0">
          {chatMessages.length === 0 && (
            <p className="text-text-muted text-xs text-center py-6">...</p>
          )}
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2 items-start ${msg.type === "system" ? "justify-center" : ""}`}
            >
              {msg.type === "player" && (
                <Avatar avatarId={msg.playerAvatarId} size="sm" />
              )}
              <div className="min-w-0 flex-1">
                {msg.type === "player" && (
                  <span className={`text-xs font-semibold ${msg.playerId === myId ? "text-primary" : "text-text-secondary"}`}>
                    {msg.playerNickname}
                  </span>
                )}
                <p className={`text-sm break-words ${msg.type === "system" ? "text-text-muted italic text-xs" : "text-text-primary"}`}>
                  {msg.message}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-border flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("chat.placeholder")}
            maxLength={200}
            className="flex-1 bg-bg-surface-light border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            className="bg-primary hover:bg-primary-light text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors"
          >
            {t("chat.send")}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
