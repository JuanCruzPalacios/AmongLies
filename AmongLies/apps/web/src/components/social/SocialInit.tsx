"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { FriendProfile, Presence, RoomInvite } from "@amonglies/shared";
import { connectSocket, getSocket } from "@/lib/socket";
import { useAuthStore } from "@/stores/authStore";
import { useSocialStore, type Toast } from "@/stores/socialStore";
import { useTranslation } from "@/hooks/useTranslation";
import { Avatar } from "@/components/ui";

/**
 * Amigos en tiempo real para toda la app: con sesión iniciada se conecta el
 * socket y se escuchan la lista, la presencia, las solicitudes y las invitaciones.
 */
export function SocialInit() {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const socket = getSocket();
    const store = useSocialStore.getState;
    const onState = store().setState;
    const onPresence = ({ userId, presence }: { userId: string; presence: Presence }) =>
      store().setPresence(userId, presence);
    const onRequest = (from: FriendProfile) => store().pushToast({ id: `request:${from.userId}`, kind: "request", from });
    const onInvite = (invite: RoomInvite) => store().pushToast({ id: invite.id, kind: "invite", invite });
    socket.on("social:state", onState);
    socket.on("social:presence", onPresence);
    socket.on("social:request-received", onRequest);
    socket.on("social:invited", onInvite);
    return () => {
      socket.off("social:state", onState);
      socket.off("social:presence", onPresence);
      socket.off("social:request-received", onRequest);
      socket.off("social:invited", onInvite);
    };
  }, []);

  useEffect(() => {
    if (user) connectSocket();
    else useSocialStore.getState().reset();
  }, [user]);

  return <Toasts />;
}

const TOAST_MS = 15000;

function Toasts() {
  const toasts = useSocialStore((s) => s.toasts);
  return (
    <div className="fixed bottom-24 lg:bottom-5 right-4 z-[60] flex flex-col gap-2 w-[min(22rem,calc(100vw-2rem))]">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastCard({ toast }: { toast: Toast }) {
  const { t } = useTranslation();
  const router = useRouter();
  const dismiss = useSocialStore((s) => s.dismissToast);

  useEffect(() => {
    const ms = toast.kind === "invite" ? Math.min(TOAST_MS, toast.invite.expiresAt - Date.now()) : TOAST_MS;
    const id = setTimeout(() => dismiss(toast.id), Math.max(0, ms));
    return () => clearTimeout(id);
  }, [toast, dismiss]);

  const from = toast.kind === "invite" ? toast.invite.from : toast.from;
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      className="bg-bg-surface border border-primary/40 rounded-2xl p-3 shadow-lg flex items-center gap-3"
    >
      <Avatar avatarId={from.avatarId} size="sm" />
      <p className="flex-1 text-sm min-w-0">
        <span className="font-semibold">@{from.username}</span>{" "}
        <span className="text-text-secondary">
          {toast.kind === "invite" ? t("social.toast.invite") : t("social.toast.request")}
        </span>
      </p>
      <button
        type="button"
        className="shrink-0 px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-semibold cursor-pointer"
        onClick={() => {
          dismiss(toast.id);
          router.push(toast.kind === "invite" ? `/room/${toast.invite.roomCode}` : "/amigos");
        }}
      >
        {toast.kind === "invite" ? t("social.join") : t("social.toast.see")}
      </button>
      <button
        type="button"
        aria-label={t("social.toast.close")}
        className="shrink-0 text-text-muted hover:text-text-primary text-lg leading-none cursor-pointer px-1"
        onClick={() => dismiss(toast.id)}
      >
        ×
      </button>
    </motion.div>
  );
}
