"use client";

import { useRef, useEffect } from "react";
import type { ImpostorPlayerView, Room, GameAction } from "@amonglies/shared";
import { WordReveal } from "./phases/WordReveal";
import { TurnsChat } from "./phases/TurnsChat";
import { TurnsVoice } from "./phases/TurnsVoice";
import { Discussion } from "./phases/Discussion";
import { Voting } from "./phases/Voting";
import { VoteResults } from "./phases/VoteResults";
import { GameEnd } from "./phases/GameEnd";
import { PartidaEnd } from "./phases/PartidaEnd";
import { Avatar } from "@/components/ui";
import { useTranslation } from "@/hooks/useTranslation";
import { useRoomStore } from "@/stores/roomStore";
import { getSocket } from "@/lib/socket";

interface Props {
  gameState: ImpostorPlayerView;
  sendAction: (action: GameAction) => void;
  room: Room;
  myId: string;
  gameEnded: boolean;
  gameResults: unknown;
  onBackToLobby: () => void;
}

export function ImpostorGame({ gameState, sendAction, room, myId, gameEnded, gameResults, onBackToLobby }: Props) {
  const { t } = useTranslation();
  const chatMessages = useRoomStore((s) => s.room?.chat ?? []);
  const listRef = useRef<HTMLDivElement>(null);

  const isEliminated = gameState.eliminatedPlayerIds?.includes(myId) ?? false;
  const hideChat = gameState.phase === "game-end";

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [chatMessages.length]);

  const phaseContent = (() => {
    switch (gameState.phase) {
      case "word-reveal":
        return <WordReveal gameState={gameState} room={room} />;
      case "turns":
        return gameState.settings.communicationMode === "chat"
          ? <TurnsChat gameState={gameState} sendAction={sendAction} room={room} myId={myId} />
          : <TurnsVoice gameState={gameState} sendAction={sendAction} room={room} myId={myId} />;
      case "discussion":
        return <Discussion gameState={gameState} room={room} sendAction={sendAction} myId={myId} />;
      case "voting":
        return <Voting gameState={gameState} sendAction={sendAction} room={room} myId={myId} />;
      case "vote-results":
      case "round-end":
        return <VoteResults gameState={gameState} room={room} />;
      case "partida-end":
        return <PartidaEnd gameState={gameState} room={room} sendAction={sendAction} myId={myId} />;
      case "game-end":
        return <GameEnd gameState={gameState} room={room} results={gameResults} onBackToLobby={onBackToLobby} />;
      default:
        return <p className="text-text-muted text-center">Cargando...</p>;
    }
  })();

  return (
    <div className="flex-1 flex overflow-hidden h-full">
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-y-auto px-4 py-4 min-w-0">
        {/* Header bar: partida/ronda info + impostor badge */}
        <div className="flex items-center justify-between mb-4 max-w-2xl mx-auto w-full">
          <span className="text-text-muted text-sm font-display">
            {t("game.impostor.partida_label", {
              partida: gameState.partida,
              total: gameState.totalPartidas,
              ronda: gameState.roundWithinPartida,
            })}
          </span>
          {gameState.isImpostor && gameState.phase !== "game-end" && (
            <span className="bg-accent/20 border border-accent/50 text-accent text-xs font-bold px-3 py-1 rounded-full font-display tracking-wide">
              🕵️ IMPOSTOR
            </span>
          )}
        </div>
        <div className="w-full max-w-2xl mx-auto">
          {phaseContent}
        </div>
      </div>

      {/* Side chat panel */}
      {!hideChat && (
        <div className="hidden lg:flex w-68 xl:w-72 flex-col border-l border-border shrink-0" style={{ background: "var(--color-bg-surface)" }}>

          {/* Header */}
          <div className="px-4 py-3 border-b border-border shrink-0">
            <h3 className="font-display font-bold text-xs text-text-secondary uppercase tracking-widest">
              Chat
            </h3>
          </div>

          {/* Eliminated banner inside chat */}
          {isEliminated && (
            <div className="mx-3 mt-3 mb-1 bg-danger/10 border border-danger/30 rounded-xl px-3 py-2 flex items-center gap-2 shrink-0">
              <span className="text-lg">👻</span>
              <p className="text-danger text-xs font-semibold leading-tight">
                Fuiste eliminado.<br />
                <span className="font-normal text-text-muted">No podés chatear.</span>
              </p>
            </div>
          )}

          {/* Messages */}
          <div ref={listRef} className="flex-1 overflow-y-auto min-h-0 py-3 px-3 space-y-1">
            {chatMessages.length === 0 && (
              <p className="text-text-muted text-xs text-center py-10 opacity-60">Sin mensajes aún</p>
            )}
            {chatMessages.map((msg, idx) => {
              const isMe = msg.playerId === myId;
              const prevMsg = chatMessages[idx - 1];
              const isSameAuthor = prevMsg?.type === "player" && prevMsg.playerId === msg.playerId;

              if (msg.type === "system") {
                return (
                  <div key={msg.id} className="flex items-center gap-2 py-2">
                    <div className="flex-1 h-px bg-border opacity-50" />
                    <span className="text-text-muted text-xs font-mono opacity-70 shrink-0">{msg.message}</span>
                    <div className="flex-1 h-px bg-border opacity-50" />
                  </div>
                );
              }

              return (
                <div key={msg.id} className={`flex gap-2 items-end ${isMe ? "flex-row-reverse" : ""} ${isSameAuthor ? "mt-0.5" : "mt-2"}`}>
                  <div className="shrink-0 w-7 self-end">
                    {!isSameAuthor && !isMe && (
                      <Avatar avatarId={msg.playerAvatarId} size="sm" />
                    )}
                  </div>
                  <div className={`flex flex-col max-w-[78%] ${isMe ? "items-end" : "items-start"}`}>
                    {!isSameAuthor && (
                      <span className={`text-xs font-semibold mb-0.5 px-1 ${isMe ? "text-primary" : "text-text-secondary"}`}>
                        {isMe ? "Vos" : msg.playerNickname}
                      </span>
                    )}
                    <div className={`px-3 py-1.5 rounded-2xl text-sm leading-snug break-words ${
                      isMe
                        ? "bg-primary/20 text-text-primary rounded-br-sm"
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
          {isEliminated ? (
            <div className="p-3 border-t border-border shrink-0">
              <div className="w-full py-2.5 px-3 rounded-xl bg-bg-surface-light text-text-muted text-xs text-center border border-border">
                No podés chatear
              </div>
            </div>
          ) : (
            <SideChatInput onSend={(msg) => getSocket().emit("chat:send", { message: msg })} t={t} />
          )}
        </div>
      )}
    </div>
  );
}

function SideChatInput({ onSend, t }: { onSend: (msg: string) => void; t: (k: string) => string }) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSend() {
    const v = inputRef.current?.value.trim();
    if (!v) return;
    onSend(v);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="p-3 border-t border-border shrink-0 flex items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        onKeyDown={handleKeyDown}
        placeholder={t("chat.placeholder")}
        maxLength={200}
        className="flex-1 min-w-0 bg-bg-surface-light border border-border rounded-xl px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
      />
      <button
        onClick={handleSend}
        className="shrink-0 bg-primary hover:bg-primary-light text-white px-3 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors"
        aria-label="Enviar"
      >
        ↑
      </button>
    </div>
  );
}
