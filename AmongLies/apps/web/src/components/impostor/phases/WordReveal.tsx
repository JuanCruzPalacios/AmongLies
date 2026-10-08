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

  const eliminated = gameState.eliminatedPlayerIds
    .map((id) => room.players.find((p) => p.id === id))
    .filter(Boolean);

  const isEliminated = (id: string) => gameState.eliminatedPlayerIds.includes(id);

  // Results from previous rounds (not current) to show who was expelled
  const prevResults = gameState.results.filter(
    (r) => r.partida === gameState.partida && r.ronda < gameState.roundWithinPartida
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, rotateY: 90 }}
      animate={{ opacity: 1, scale: 1, rotateY: 0 }}
      transition={{ type: "spring", duration: 0.6 }}
      className="text-center space-y-3"
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
            {gameState.category && (
              <p className="mt-3 text-sm">
                <span className="text-text-muted">{t("game.impostor.category_hint")} </span>
                <span className="font-bold text-accent">{gameState.category}</span>
              </p>
            )}

            {/* Co-impostors — tachados si fueron expulsados */}
            {fellowImpostors.length > 0 && (
              <div className="mt-4 pt-4 border-t border-accent/20">
                <p className="text-accent text-sm mb-2">
                  {t("game.impostor.fellow_impostors")}
                </p>
                <div className="flex justify-center gap-3 flex-wrap">
                  {fellowImpostors.map((p) => {
                    const expelled = isEliminated(p!.id);
                    return (
                      <div
                        key={p!.id}
                        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 relative ${
                          expelled
                            ? "bg-bg-surface-light opacity-50"
                            : "bg-accent/10"
                        }`}
                      >
                        <Avatar avatarId={p!.avatarId} size="sm" />
                        <span className={`text-sm font-medium ${expelled ? "line-through text-text-muted" : ""}`}>
                          {p!.nickname}
                        </span>
                        {expelled && (
                          <span className="text-xs text-danger font-bold ml-1">expulsado</span>
                        )}
                      </div>
                    );
                  })}
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

      {/* Historial de expulsados esta partida (rondas anteriores) */}
      {prevResults.length > 0 && eliminated.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-bg-surface border border-border rounded-2xl px-4 py-3"
        >
          <p className="text-text-muted text-xs uppercase tracking-wider mb-2">
            Expulsados esta partida
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {prevResults.map((r, i) => {
              if (!r.votedOutId) return (
                <span key={i} className="text-xs text-text-muted bg-bg-surface-light rounded-lg px-2 py-1">
                  Ronda {r.ronda} — Empate
                </span>
              );
              const expelled = room.players.find((p) => p.id === r.votedOutId);
              if (!expelled) return null;
              return (
                <div key={i} className="flex items-center gap-1.5 bg-bg-surface-light rounded-lg px-2 py-1">
                  <Avatar avatarId={expelled.avatarId} size="sm" />
                  <span className="text-xs text-text-secondary line-through">{expelled.nickname}</span>
                  <span className="text-xs text-text-muted">R{r.ronda}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
