"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import type { Room } from "@amonglies/shared";
import { AVATARS, MIN_NICKNAME_LENGTH, MAX_NICKNAME_LENGTH, getGameDefinition } from "@amonglies/shared";
import { useRoomStore } from "@/stores/roomStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useSocket } from "@/hooks/useSocket";
import { useGame } from "@/hooks/useGame";
import { useTranslation } from "@/hooks/useTranslation";
import { Header } from "@/components/layout/Header";
import { PlayerList } from "@/components/lobby/PlayerList";
import { Chat } from "@/components/lobby/Chat";
import { GameSelector } from "@/components/lobby/GameSelector";
import { GameSettings } from "@/components/lobby/GameSettings";
import { ImpostorGame } from "@/components/impostor/ImpostorGame";
import { Button, Input, Avatar } from "@/components/ui";
import { getSocket, connectSocket } from "@/lib/socket";

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomCode = (params.code as string).toUpperCase();
  const { t } = useTranslation();

  const room = useRoomStore((s) => s.room);
  const { setRoom, setConnecting, setError, isConnecting, error } = useRoomStore();
  const { nickname, avatarId, playerId: myId, locale, hydrated: mounted, setNickname, setAvatarId, loadFromStorage } = usePlayerStore();
  const { isConnected } = useSocket();
  const { gameState, sendAction, resetGame } = useGame();

  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [gameError, setGameError] = useState<string | null>(null);
  const [nicknameError, setNicknameError] = useState("");

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    const socket = getSocket();
    const errorKeys: Record<string, string> = {
      no_word_lists_selected: t("game.impostor.no_word_lists"),
      word_already_used: t("game.impostor.error.word_used"),
      word_is_secret: t("game.impostor.error.word_secret"),
    };
    const handler = ({ message, code }: { message: string; code?: string }) => {
      setGameError(errorKeys[message] ?? t(`error.${code}`, undefined, message));
      setTimeout(() => setGameError(null), 4000);
    };
    socket.on("game:error", handler);
    return () => { socket.off("game:error", handler); };
  }, [t]);

  function validateNickname(): boolean {
    if (nickname.length < MIN_NICKNAME_LENGTH || nickname.length > MAX_NICKNAME_LENGTH) {
      setNicknameError(t("landing.error.nickname"));
      return false;
    }
    setNicknameError("");
    return true;
  }

  function handleJoinViaLink() {
    if (!validateNickname()) return;
    setConnecting(true);
    setError(null);
    const socket = connectSocket();

    const timeout = setTimeout(() => {
      socket.off("room:joined", onJoined);
      socket.off("room:error", onRoomError);
      setConnecting(false);
      setError(t("landing.error.timeout"));
    }, 10000);

    function onJoined({ room, playerId }: { room: Room; playerId: string }) {
      clearTimeout(timeout);
      socket.off("room:error", onRoomError);
      usePlayerStore.getState().setPlayerId(playerId);
      setRoom(room);
      setConnecting(false);
    }

    function onRoomError({ message, code }: { message: string; code: string }) {
      clearTimeout(timeout);
      socket.off("room:joined", onJoined);
      setError(t(`error.${code}`, undefined, message));
      setConnecting(false);
    }

    socket.once("room:joined", onJoined);
    socket.once("room:error", onRoomError);

    const emit = () => socket.emit("room:join", { code: roomCode, nickname, avatarId, locale });
    if (socket.connected) emit();
    else socket.once("connect", emit);
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/room/${room!.code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCopyCode() {
    navigator.clipboard.writeText(room!.code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  function handleStartGame() {
    setGameError(null);
    getSocket().emit("game:start");
  }

  function handleLeave() {
    getSocket().emit("room:leave");
    useRoomStore.getState().setRoom(null);
    resetGame();
    router.push("/");
  }

  if (!mounted) {
    return (
      <div className="flex flex-col min-h-dvh">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-4xl animate-pulse">🎭</div>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex flex-col min-h-dvh">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md space-y-6"
          >
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold mb-1">
                {t("landing.join")}
              </h2>
              <p className="text-text-muted text-sm">
                Sala{" "}
                <span className="font-mono text-primary tracking-widest font-bold">
                  {roomCode}
                </span>
              </p>
            </div>

            <Input
              label={t("landing.nickname")}
              placeholder={t("landing.nickname.placeholder")}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={MAX_NICKNAME_LENGTH}
              error={nicknameError}
            />

            <div>
              <label className="text-sm font-medium text-text-secondary mb-3 block">
                {t("landing.avatar")}
              </label>
              <div className="grid grid-cols-8 gap-2">
                {AVATARS.map((avatar) => (
                  <Avatar
                    key={avatar.id}
                    avatarId={avatar.id}
                    size="sm"
                    selected={avatarId === avatar.id}
                    onClick={() => setAvatarId(avatar.id)}
                  />
                ))}
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-danger text-sm"
              >
                {error}
              </motion.div>
            )}

            <div className="space-y-3">
              <Button
                size="lg"
                className="w-full"
                onClick={handleJoinViaLink}
                isLoading={isConnecting}
                disabled={isConnecting}
              >
                {t("landing.join.button")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => router.push("/")}
              >
                Volver al inicio
              </Button>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  const isAdmin = room.adminId === myId;
  const isPlaying = room.state === "playing";
  const minPlayers = (room.selectedGameId && getGameDefinition(room.selectedGameId)?.minPlayers) || 4;
  const canStart = isAdmin && room.selectedGameId && room.players.length >= minPlayers;

  // La pantalla final se sigue mostrando aunque la sala ya haya vuelto al lobby.
  if (gameState && (isPlaying || gameState.phase === "game-end")) {
    return (
      <div className="h-dvh flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 min-h-0 flex flex-col">
          <ImpostorGame
            gameState={gameState}
            sendAction={sendAction}
            room={room}
            myId={myId!}
            onBackToLobby={() => {
              resetGame();
              if (isAdmin) getSocket().emit("game:back-to-lobby");
            }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh">
      <Header />
      <main className="flex-1 px-4 pb-8 max-w-6xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-3 mb-6 mt-2"
        >
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-bg-surface border border-border rounded-xl px-4 py-2">
              <span className="text-text-muted text-xs block">{t("lobby.code")}</span>
              <span className="font-mono text-2xl font-bold text-primary tracking-widest">
                {room.code}
              </span>
            </div>
            <Button variant="secondary" size="sm" onClick={handleCopyCode}>
              {codeCopied ? "Copiado!" : "Copiar código"}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleCopyLink}>
              {copied ? t("lobby.copied") : t("lobby.copy")}
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLeave}>
            {t("lobby.leave")}
          </Button>
        </motion.div>

        {gameError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-danger text-sm mb-4"
          >
            {gameError}
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-3 space-y-4">
            <PlayerList />
            <Chat />
          </div>

          <div className="lg:col-span-6 space-y-4">
            <GameSelector />
            {room.selectedGameId && <GameSettings />}
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div className="bg-bg-surface border border-border rounded-2xl p-4">
              {isAdmin ? (
                <div className="space-y-3">
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={handleStartGame}
                    disabled={!canStart}
                  >
                    {t("lobby.start")}
                  </Button>
                  {!room.selectedGameId && (
                    <p className="text-text-muted text-xs text-center">
                      {t("lobby.select_game")}
                    </p>
                  )}
                  {room.players.length < minPlayers && (
                    <p className="text-warning text-xs text-center">
                      {t("lobby.min_players", { min: minPlayers })}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="animate-pulse text-4xl mb-2">⏳</div>
                  <p className="text-text-secondary text-sm">
                    {t("lobby.waiting")}
                  </p>
                </div>
              )}
            </div>

            {!isConnected && (
              <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-danger text-xs text-center">
                Desconectado del servidor...
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
