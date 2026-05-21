"use client";

import { useState, useRef, useEffect } from "react";
import { Avatar } from "@/components/ui";
import { useRoomStore } from "@/stores/roomStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useTranslation } from "@/hooks/useTranslation";
import { getSocket } from "@/lib/socket";

export function Chat() {
  const { t } = useTranslation();
  const room = useRoomStore((s) => s.room);
  const myId = usePlayerStore((s) => s.playerId);
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [room?.chat.length]);

  if (!room) return null;

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
    <div className="bg-bg-surface border border-border rounded-2xl flex flex-col h-80">
      <h3 className="font-display font-bold text-sm text-text-secondary px-4 pt-4 pb-2 uppercase tracking-wider">
        {t("lobby.chat")}
      </h3>
      <div className="flex-1 overflow-y-auto px-4 space-y-2 min-h-0">
        {room.chat.length === 0 && (
          <p className="text-text-muted text-xs text-center py-8">...</p>
        )}
        {room.chat.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2 items-start ${
              msg.type === "system" ? "justify-center" : ""
            }`}
          >
            {msg.type === "player" && (
              <Avatar avatarId={msg.playerAvatarId} size="sm" />
            )}
            <div className="min-w-0 flex-1">
              {msg.type === "player" && (
                <span
                  className={`text-xs font-semibold ${
                    msg.playerId === myId ? "text-primary" : "text-text-secondary"
                  }`}
                >
                  {msg.playerNickname}
                </span>
              )}
              <p
                className={`text-sm break-words ${
                  msg.type === "system"
                    ? "text-text-muted italic text-xs"
                    : "text-text-primary"
                }`}
              >
                {msg.message}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
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
  );
}
