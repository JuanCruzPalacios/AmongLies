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
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom without touching the page scroll
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
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
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-border shrink-0">
        <h3 className="font-display font-bold text-xs text-text-secondary uppercase tracking-widest">
          {t("lobby.chat")}
        </h3>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 px-3 py-3 space-y-1">
        {room.chat.length === 0 && (
          <p className="text-text-muted text-xs text-center py-10 opacity-60">{t("chat.empty")}...</p>
        )}

        {room.chat.map((msg, idx) => {
          const isMe = msg.playerId === myId;
          const prevMsg = room.chat[idx - 1];
          const isSameAuthor = prevMsg?.type === "player" && prevMsg.playerId === msg.playerId;

          if (msg.type === "system") {
            return (
              <div key={msg.id} className="flex items-center gap-2 py-1.5">
                <div className="flex-1 h-px bg-border opacity-40" />
                <span className="text-text-muted text-xs opacity-60 min-w-0 text-center whitespace-pre-wrap [overflow-wrap:anywhere]">{msg.message}</span>
                <div className="flex-1 h-px bg-border opacity-40" />
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex gap-2 items-end ${isMe ? "flex-row-reverse" : ""} ${isSameAuthor ? "mt-0.5" : "mt-2"}`}
            >
              <div className="shrink-0 w-8 self-end">
                {!isSameAuthor && !isMe && (
                  <Avatar avatarId={msg.playerAvatarId} size="sm" />
                )}
              </div>
              <div className={`flex flex-col min-w-0 max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                {!isSameAuthor && (
                  <span className={`text-xs font-semibold mb-0.5 px-1 max-w-full truncate ${isMe ? "text-primary" : "text-text-secondary"}`}>
                    {isMe ? t("chat.you") : msg.playerNickname}
                  </span>
                )}
                <div className={`px-3 py-1.5 text-sm leading-snug break-words whitespace-pre-wrap [overflow-wrap:anywhere] max-w-full rounded-2xl ${
                  isMe
                    ? "bg-primary/25 text-text-primary rounded-br-sm"
                    : "bg-bg-surface-light text-text-primary rounded-bl-sm"
                }`}>
                  {msg.message}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border shrink-0 flex items-center gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("chat.placeholder")}
          maxLength={200}
          className="flex-1 min-w-0 bg-bg-surface-light border border-border rounded-xl px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!message.trim()}
          aria-label={t("chat.send")}
          className="shrink-0 bg-primary hover:bg-primary-light text-white w-9 h-9 rounded-xl text-base font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
