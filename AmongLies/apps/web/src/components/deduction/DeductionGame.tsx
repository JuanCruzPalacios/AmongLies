"use client";

import { useRef, useEffect, useState, type ReactNode } from "react";
import type { GameView, Room, GameAction } from "@amonglies/shared";
import { Discussion } from "./Discussion";
import { Voting } from "./Voting";
import { VoteResults } from "./VoteResults";
import { GameEnd } from "./GameEnd";
import { PartidaEnd } from "./PartidaEnd";
import { Avatar } from "@/components/ui";
import { PauseOverlay } from "@/components/game/PauseOverlay";
import { ReportDialog, type ReportTarget } from "@/components/moderation/ReportDialog";
import { useTranslation } from "@/hooks/useTranslation";
import { useRoomStore } from "@/stores/roomStore";
import { getSocket } from "@/lib/socket";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  gameState: GameView;
  sendAction: (action: GameAction) => void;
  room: Room;
  myId: string;
  onBackToLobby: () => void;
  /** Pantalla de las fases propias del juego (revelación, turnos…). */
  renderActivity: (phase: string) => ReactNode;
  /** Resumen de la ronda que se muestra en la discusión (pistas, tiempos…). */
  summary?: ReactNode;
  /** Se muestra también durante la votación (p. ej. el dibujo). */
  showSummaryWhileVoting?: boolean;
  /** Arriba de los resultados de fin de partida y de juego (p. ej. el dibujo terminado). */
  endSummary?: ReactNode;
}

/**
 * Pantalla común de la familia Impostor: chat, eliminados, pausa y las fases
 * de discusión, votación y resultados. Cada juego aporta su actividad.
 */
export function DeductionGame({
  gameState,
  sendAction,
  room,
  myId,
  onBackToLobby,
  renderActivity,
  summary,
  showSummaryWhileVoting = false,
  endSummary,
}: Props) {
  const { t } = useTranslation();
  const chatMessages = useRoomStore((s) => s.room?.chat ?? []);
  const listRef = useRef<HTMLDivElement>(null);
  const mobileListRef = useRef<HTMLDivElement>(null);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  // Mensajes de jugadores ya vistos en el drawer mobile (para el contador de no leídos)
  const playerMessageCount = chatMessages.filter((m) => m.type === "player").length;
  const [seenCount, setSeenCount] = useState(playerMessageCount);
  const unreadCount = mobileChatOpen ? 0 : Math.max(0, playerMessageCount - seenCount);

  function closeMobileChat() {
    setMobileChatOpen(false);
    setSeenCount(playerMessageCount);
  }

  const isEliminated = gameState.eliminatedPlayerIds?.includes(myId) ?? false;
  const hideChat = gameState.phase === "game-end";

  // Desktop scroll
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [chatMessages.length]);

  // Mobile scroll when drawer is open
  useEffect(() => {
    if (mobileChatOpen && mobileListRef.current) {
      mobileListRef.current.scrollTop = mobileListRef.current.scrollHeight;
    }
  }, [chatMessages.length, mobileChatOpen]);

  const phaseContent = (() => {
    switch (gameState.phase) {
      case "discussion":
        return <Discussion gameState={gameState} room={room} sendAction={sendAction} myId={myId} summary={summary} />;
      case "voting":
        return (
          <>
            {showSummaryWhileVoting && <div className="mb-4">{summary}</div>}
            <Voting gameState={gameState} sendAction={sendAction} room={room} myId={myId} />
          </>
        );
      case "vote-results":
        return <VoteResults gameState={gameState} room={room} />;
      case "partida-end":
        return (
          <>
            {endSummary && <div className="mb-4">{endSummary}</div>}
            <PartidaEnd gameState={gameState} room={room} sendAction={sendAction} myId={myId} />
          </>
        );
      case "game-end":
        return (
          <>
            {endSummary && <div className="mb-4">{endSummary}</div>}
            <GameEnd gameState={gameState} room={room} onBackToLobby={onBackToLobby} />
          </>
        );
      default:
        return renderActivity(gameState.phase);
    }
  })();

  return (
    <div className="flex-1 flex overflow-hidden h-full relative">
      {gameState.paused && <PauseOverlay room={room} myId={myId} />}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-y-auto px-4 py-4 min-w-0">
        {/* Header bar */}
        <div className="flex items-center justify-between mb-2 max-w-2xl mx-auto w-full">
          <span className="text-text-muted text-sm font-display">
            {t("game.impostor.partida_label", {
              partida: gameState.partida,
              total: gameState.totalPartidas,
              ronda: gameState.roundWithinPartida,
            })}
          </span>
          <button
            type="button"
            onClick={() => setReportOpen((o) => !o)}
            className="ml-auto mr-2 text-xs text-text-muted hover:text-danger cursor-pointer"
            aria-expanded={reportOpen}
          >
            ⚑ {t("report.action")}
          </button>
          {gameState.isImpostor && gameState.phase !== "game-end" && (
            <span className="bg-accent/20 border border-accent/50 text-accent text-xs font-bold px-3 py-1 rounded-full font-display tracking-wide">
              🕵️ IMPOSTOR
            </span>
          )}
        </div>

        {reportOpen && (
          <div className="max-w-2xl mx-auto w-full mb-3 flex flex-wrap gap-2 items-center bg-bg-surface border border-border rounded-xl p-2">
            <span className="text-xs text-text-muted">{t("report.who")}</span>
            {room.players
              .filter((p) => p.id !== myId)
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setReportOpen(false);
                    setReportTarget({ kind: "player", playerId: p.id, name: p.nickname });
                  }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-bg-surface-light text-xs cursor-pointer hover:text-danger"
                >
                  <Avatar avatarId={p.avatarId} size="sm" /> {p.nickname}
                </button>
              ))}
          </div>
        )}
        <ReportDialog target={reportTarget} onClose={() => setReportTarget(null)} />

        {/* Eliminated strip — mobile only */}
        <EliminatedStrip gameState={gameState} room={room} className="lg:hidden mb-3 max-w-2xl mx-auto w-full" />

        <div className="w-full max-w-2xl mx-auto">
          {phaseContent}
        </div>
      </div>

      {/* ── Desktop side panel ─────────────────────────────────────────── */}
      {!hideChat && (
        <div className="hidden lg:flex w-68 xl:w-72 flex-col border-l border-border shrink-0" style={{ background: "var(--color-bg-surface)" }}>
          <div className="px-4 py-3 border-b border-border shrink-0">
            <h3 className="font-display font-bold text-xs text-text-secondary uppercase tracking-widest">Chat</h3>
          </div>

          {isEliminated && (
            <div className="mx-3 mt-3 mb-1 bg-danger/10 border border-danger/30 rounded-xl px-3 py-2 flex items-center gap-2 shrink-0">
              <span className="text-lg">👻</span>
              <p className="text-danger text-xs font-semibold leading-tight">
                Fuiste eliminado.<br />
                <span className="font-normal text-text-muted">No podés chatear.</span>
              </p>
            </div>
          )}

          <EliminatedStrip gameState={gameState} room={room} className="mx-3 mt-2 shrink-0" />

          <ChatMessages messages={chatMessages as ChatMsg[]} myId={myId} listRef={listRef} />

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

      {/* ── Mobile chat drawer ─────────────────────────────────────────── */}
      {!hideChat && (
        <>
          {/* Floating button */}
          <button
            onClick={() => setMobileChatOpen(true)}
            className="lg:hidden fixed bottom-5 right-5 z-40 w-14 h-14 bg-primary rounded-full shadow-lg flex items-center justify-center text-white text-2xl active:scale-95 transition-transform"
            aria-label="Abrir chat"
          >
            💬
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-danger text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Drawer */}
          <AnimatePresence>
            {mobileChatOpen && (
              <>
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={closeMobileChat}
                  className="lg:hidden fixed inset-0 bg-black/50 z-40"
                />

                {/* Sheet */}
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 30, stiffness: 300 }}
                  className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-3xl overflow-hidden"
                  style={{ height: "75dvh", background: "var(--color-bg-surface)" }}
                >
                  {/* Handle + header */}
                  <div className="shrink-0 px-4 pt-3 pb-2 border-b border-border flex items-center justify-between">
                    <div className="w-10 h-1 bg-border rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
                    <h3 className="font-display font-bold text-sm text-text-secondary uppercase tracking-widest">Chat</h3>
                    <button
                      onClick={closeMobileChat}
                      className="text-text-muted text-xl leading-none p-1"
                      aria-label="Cerrar"
                    >
                      ×
                    </button>
                  </div>

                  {isEliminated && (
                    <div className="mx-3 mt-2 bg-danger/10 border border-danger/30 rounded-xl px-3 py-2 flex items-center gap-2 shrink-0">
                      <span>👻</span>
                      <p className="text-danger text-xs font-semibold">
                        Fuiste eliminado — solo podés leer.
                      </p>
                    </div>
                  )}

                  <ChatMessages messages={chatMessages as ChatMsg[]} myId={myId} listRef={mobileListRef} />

                  {isEliminated ? (
                    <div className="p-3 border-t border-border shrink-0">
                      <div className="w-full py-2.5 px-3 rounded-xl bg-bg-surface-light text-text-muted text-xs text-center border border-border">
                        No podés chatear
                      </div>
                    </div>
                  ) : (
                    <SideChatInput onSend={(msg) => getSocket().emit("chat:send", { message: msg })} t={t} />
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

// ── Shared chat messages list ───────────────────────────────────────────────

type ChatMsg = { id: string; type: string; message: string; playerId: string; playerNickname: string; playerAvatarId: string };

function ChatMessages({
  messages,
  myId,
  listRef,
}: {
  messages: ChatMsg[];
  myId: string;
  listRef: React.RefObject<HTMLDivElement | null>;
}) {
  const chatMessages = messages;

  return (
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
  );
}

// ── Eliminated strip ────────────────────────────────────────────────────────

function EliminatedStrip({
  gameState,
  room,
  className = "",
}: {
  gameState: GameView;
  room: Room;
  className?: string;
}) {
  const eliminated = (gameState.eliminatedPlayerIds ?? [])
    .map((id) => room.players.find((p) => p.id === id))
    .filter(Boolean);

  if (eliminated.length === 0) return null;

  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-text-muted text-xs opacity-60 shrink-0">👻</span>
        {eliminated.map((p) => (
          <div key={p!.id} className="flex items-center gap-1 opacity-50" title={`${p!.nickname} — eliminado`}>
            <Avatar avatarId={p!.avatarId} size="sm" />
            <span className="text-xs text-text-muted line-through leading-none hidden sm:inline lg:hidden xl:inline">
              {p!.nickname}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Side chat input ─────────────────────────────────────────────────────────

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
        className="shrink-0 bg-primary hover:bg-primary-light text-white w-9 h-9 rounded-xl text-base font-bold cursor-pointer transition-colors flex items-center justify-center"
        aria-label="Enviar"
      >
        ↑
      </button>
    </div>
  );
}
