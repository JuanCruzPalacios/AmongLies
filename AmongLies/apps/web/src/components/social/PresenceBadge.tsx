"use client";

import type { Presence } from "@amonglies/shared";
import { useTranslation } from "@/hooks/useTranslation";

const DOT: Record<Presence["status"], string> = {
  offline: "bg-text-muted",
  online: "bg-success",
  lobby: "bg-primary",
  playing: "bg-accent",
};

export function PresenceBadge({ presence }: { presence: Presence }) {
  const { t } = useTranslation();
  return (
    <span className="flex items-center gap-1.5 text-xs text-text-muted">
      <span className={`w-2 h-2 rounded-full ${DOT[presence.status]}`} />
      {t(`social.presence.${presence.status}`)}
    </span>
  );
}
