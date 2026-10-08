"use client";

import { useState } from "react";
import type { SocialError } from "@amonglies/shared";
import { Avatar } from "@/components/ui";
import { PresenceBadge } from "./PresenceBadge";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/stores/authStore";
import { useSocialStore } from "@/stores/socialStore";
import { useTranslation } from "@/hooks/useTranslation";

/** En el lobby: invitar a los amigos conectados que no están ya en la sala. */
export function InviteFriends({ roomCode }: { roomCode: string }) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const friends = useSocialStore((s) => s.friends);
  const [sent, setSent] = useState<Record<string, "ok" | SocialError>>({});

  if (!user) return null;
  const available = friends.filter((f) => f.presence.status !== "offline" && f.presence.roomCode !== roomCode);

  return (
    <div className="bg-bg-surface border border-border rounded-2xl p-4">
      <h3 className="font-display font-bold text-xs text-text-secondary uppercase tracking-widest mb-3">
        {t("social.invite_friends")}
      </h3>
      {available.length === 0 ? (
        <p className="text-xs text-text-muted">{t("social.no_online_friends")}</p>
      ) : (
        <ul className="space-y-2">
          {available.map((f) => (
            <li key={f.userId} className="flex items-center gap-2">
              <Avatar avatarId={f.avatarId} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">@{f.username}</p>
                <PresenceBadge presence={f.presence} />
              </div>
              {sent[f.userId] === "ok" ? (
                <span className="text-xs text-success">{t("social.invited")}</span>
              ) : (
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold cursor-pointer"
                  title={sent[f.userId] ? t(`social.error.${sent[f.userId]}`) : undefined}
                  onClick={() =>
                    getSocket().emit("social:invite", { userId: f.userId }, (r) =>
                      setSent((s) => ({ ...s, [f.userId]: r.ok ? "ok" : r.error }))
                    )
                  }
                >
                  {t("social.invite")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
