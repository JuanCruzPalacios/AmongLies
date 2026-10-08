"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { Room } from "@amonglies/shared";
import { AVATARS, MIN_NICKNAME_LENGTH, MAX_NICKNAME_LENGTH, ROOM_CODE_LENGTH } from "@amonglies/shared";
import { Header } from "@/components/layout/Header";
import { Button, Input, Avatar } from "@/components/ui";
import { usePlayerStore } from "@/stores/playerStore";
import { useRoomStore } from "@/stores/roomStore";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/hooks/useTranslation";
import { connectSocket, whenSessionReady } from "@/lib/socket";
import { CONNECT_TIMEOUT_MS, useWakeNotice } from "@/lib/keepAlive";
import { PublicRooms } from "@/components/lobby/PublicRooms";

export default function Home() {
  const router = useRouter();
  const { t } = useTranslation();
  const { nickname, avatarId, locale, setNickname, setAvatarId, loadFromStorage } = usePlayerStore();
  const { setRoom, setConnecting, setError, isConnecting, error } = useRoomStore();
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const [joinCode, setJoinCode] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [nicknameError, setNicknameError] = useState("");
  const waking = useWakeNotice(isConnecting);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  function validateNickname(): boolean {
    if (nickname.length < MIN_NICKNAME_LENGTH || nickname.length > MAX_NICKNAME_LENGTH) {
      setNicknameError(t("landing.error.nickname"));
      return false;
    }
    setNicknameError("");
    return true;
  }


  function handleCreateRoom() {
    if (!validateNickname()) return;
    setConnecting(true);
    setError(null);
    const socket = connectSocket();

    const timeout = setTimeout(() => {
      socket.off("room:created", onCreated);
      socket.off("room:error", onRoomError);
      setConnecting(false);
      setError(t("landing.error.timeout"));
    }, CONNECT_TIMEOUT_MS);

    function onCreated({ room, playerId }: { room: Room; playerId: string }) {
      clearTimeout(timeout);
      socket.off("room:error", onRoomError);
      usePlayerStore.getState().setPlayerId(playerId);
      setRoom(room);
      setConnecting(false);
      router.push(`/room/${room.code}`);
    }

    function onRoomError({ message, code }: { message: string; code: string }) {
      clearTimeout(timeout);
      socket.off("room:created", onCreated);
      setError(t(`error.${code}`, undefined, message));
      setConnecting(false);
    }

    socket.once("room:created", onCreated);
    socket.once("room:error", onRoomError);

    whenSessionReady(() => socket.emit("room:create", { nickname, avatarId, locale }));
  }

  function handleJoinRoom(code: string = joinCode) {
    if (!validateNickname()) return;
    if (code.length !== ROOM_CODE_LENGTH) {
      setError(t("landing.error.code"));
      return;
    }
    setConnecting(true);
    setError(null);
    const socket = connectSocket();

    const timeout = setTimeout(() => {
      socket.off("room:joined", onJoined);
      socket.off("room:error", onRoomError);
      setConnecting(false);
      setError(t("landing.error.timeout"));
    }, CONNECT_TIMEOUT_MS);

    function onJoined({ room, playerId }: { room: Room; playerId: string }) {
      clearTimeout(timeout);
      socket.off("room:error", onRoomError);
      usePlayerStore.getState().setPlayerId(playerId);
      setRoom(room);
      setConnecting(false);
      router.push(`/room/${room.code}`);
    }

    function onRoomError({ message, code }: { message: string; code: string }) {
      clearTimeout(timeout);
      socket.off("room:joined", onJoined);
      setError(t(`error.${code}`, undefined, message));
      setConnecting(false);
    }

    socket.once("room:joined", onJoined);
    socket.once("room:error", onRoomError);

    whenSessionReady(() => socket.emit("room:join", { code: code.toUpperCase(), nickname, avatarId, locale }));
  }

  return (
    <div className="flex flex-col min-h-dvh">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <h1 className="font-display text-5xl sm:text-7xl font-bold mb-3 tracking-tight">
            <span className="text-primary">Among</span>
            <span className="text-accent">Lies</span>
          </h1>
          <p className="text-text-secondary text-lg sm:text-xl font-display">
            {t("landing.subtitle")}
          </p>
          <p className="text-text-muted text-sm mt-2 max-w-md mx-auto">
            {t("landing.description")}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-md space-y-6"
        >
          <div>
            <Input
              label={t("landing.nickname")}
              placeholder={t("landing.nickname.placeholder")}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={MAX_NICKNAME_LENGTH}
              error={nicknameError}
            />
          </div>

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
                  onClick={() => {
                    setAvatarId(avatar.id);
                    void updateProfile({ avatar_id: avatar.id });
                  }}
                />
              ))}
            </div>
          </div>

          {waking && (
            <p role="status" className="text-text-secondary text-sm text-center">
              {t("landing.waking")}
            </p>
          )}
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
              onClick={handleCreateRoom}
              isLoading={isConnecting}
              disabled={isConnecting}
            >
              {t("landing.create")}
            </Button>

            {!showJoin ? (
              <Button
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={() => setShowJoin(true)}
              >
                {t("landing.join")}
              </Button>
            ) : (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="flex gap-2"
              >
                <Input
                  placeholder={t("landing.join.placeholder")}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={ROOM_CODE_LENGTH}
                  className="flex-1 font-mono text-center tracking-widest text-lg uppercase"
                />
                <Button onClick={() => handleJoinRoom()} isLoading={isConnecting} disabled={isConnecting}>
                  {t("landing.join.button")}
                </Button>
              </motion.div>
            )}
          </div>
        </motion.div>
        <div className="mt-10 w-full flex justify-center">
          <PublicRooms onJoin={(code) => handleJoinRoom(code)} disabled={isConnecting} />
        </div>
      </main>

      <footer className="text-center py-4 text-text-muted text-xs">
        AmongLies &copy; {new Date().getFullYear()} &mdash; Among Lies Dev Team
      </footer>
    </div>
  );
}
