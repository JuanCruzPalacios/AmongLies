"use client";

import { motion } from "framer-motion";
import type { Room, TimePlayerView } from "@amonglies/shared";
import { Avatar } from "@/components/ui";
import { useTranslation } from "@/hooks/useTranslation";
import { formatSeconds } from "@/components/deduction/roundAnswer";

/** Al empezar la ronda: el objetivo para los inocentes, el aviso para el impostor. */
export function RoleReveal({ gameState, room }: { gameState: TimePlayerView; room: Room }) {
  const { t, locale } = useTranslation();
  const fellows = gameState.fellowImpostorIds
    .map((id) => room.players.find((p) => p.id === id))
    .filter((p) => p !== undefined);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`text-center rounded-3xl p-8 border-2 ${
        gameState.isImpostor ? "bg-accent/10 border-accent" : "bg-success/10 border-success"
      }`}
    >
      {gameState.isImpostor ? (
        <>
          <div className="text-6xl mb-4">🕵️</div>
          <h2 className="font-display text-3xl font-bold text-accent mb-2">{t("game.impostor.you_are_impostor")}</h2>
          <p className="text-text-secondary">{t("game.time.impostor_hint")}</p>
          {fellows.length > 0 && (
            <div className="mt-4 pt-4 border-t border-accent/20">
              <p className="text-accent text-sm mb-2">{t("game.impostor.fellow_impostors")}</p>
              <div className="flex justify-center gap-3 flex-wrap">
                {fellows.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 rounded-lg px-3 py-1.5 bg-accent/10">
                    <Avatar avatarId={p.avatarId} size="sm" />
                    <span className="text-sm font-medium">{p.nickname}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="text-6xl mb-4">⏱️</div>
          <p className="text-text-secondary mb-1">{t("game.time.target_is")}</p>
          <p className="font-display text-6xl font-black text-success">{formatSeconds(gameState.targetMs ?? 0, locale)}</p>
          <p className="text-text-secondary text-sm mt-3">{t("game.time.innocent_hint")}</p>
        </>
      )}
    </motion.div>
  );
}
