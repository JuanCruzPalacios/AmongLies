"use client";

import { motion } from "framer-motion";
import type { ImpostorPlayerView, Room } from "@amonglies/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Avatar } from "@/components/ui";

interface Props {
  gameState: ImpostorPlayerView;
  room: Room;
}

export function WordReveal({ gameState, room }: Props) {
  const { t } = useTranslation();

  const fellowImpostors = gameState.fellowImpostorIds
    .map((id) => room.players.find((p) => p.id === id))
    .filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, rotateY: 90 }}
      animate={{ opacity: 1, scale: 1, rotateY: 0 }}
      transition={{ type: "spring", duration: 0.6 }}
      className="text-center"
    >
      <div
        className={`rounded-3xl p-8 border-2 ${
          gameState.isImpostor
            ? "bg-accent/10 border-accent shadow-[0_0_40px_rgba(236,72,153,0.3)]"
            : "bg-success/10 border-success shadow-[0_0_40px_rgba(16,185,129,0.3)]"
        }`}
      >
        {gameState.isImpostor ? (
          <>
            <div className="text-6xl mb-4">🕵️</div>
            <h2 className="font-display text-3xl font-bold text-accent mb-2">
              {t("game.impostor.you_are_impostor")}
            </h2>
            <p className="text-text-secondary">
              {t("game.impostor.find_word")}
            </p>
            {fellowImpostors.length > 0 && (
              <div className="mt-4 pt-4 border-t border-accent/20">
                <p className="text-accent text-sm mb-2">
                  {t("game.impostor.fellow_impostors")}
                </p>
                <div className="flex justify-center gap-3">
                  {fellowImpostors.map((p) => (
                    <div key={p!.id} className="flex items-center gap-2 bg-accent/10 rounded-lg px-3 py-1.5">
                      <Avatar avatarId={p!.avatarId} size="sm" />
                      <span className="text-sm font-medium">{p!.nickname}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-6xl mb-4">📝</div>
            <h2 className="font-display text-xl font-bold text-text-secondary mb-2">
              {t("game.impostor.your_word")}
            </h2>
            <p className="font-display text-5xl font-bold text-success">
              {gameState.secretWord}
            </p>
          </>
        )}
      </div>
    </motion.div>
  );
}
