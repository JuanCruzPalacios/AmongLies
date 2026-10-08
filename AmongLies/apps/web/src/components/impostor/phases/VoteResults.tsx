"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SKIP_VOTE, type ImpostorPlayerView, type Room } from "@amonglies/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Avatar } from "@/components/ui";

interface Props {
  gameState: ImpostorPlayerView;
  room: Room;
}

export function VoteResults({ gameState, room }: Props) {
  const { t } = useTranslation();
  // stage 0: "el expulsado es..."  (0–2.5s)
  // stage 1: ERA / NO ERA impostor  (2.5–5.5s)
  // stage 2: info completa          (5.5s+)
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 2500);
    const t2 = setTimeout(() => setStage(2), 5500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [gameState.partida, gameState.roundWithinPartida]);

  const lastResult = gameState.results[gameState.results.length - 1];
  if (!lastResult) return null;

  const votedOut = lastResult.votedOutId
    ? room.players.find((p) => p.id === lastResult.votedOutId)
    : null;

  // Server only sends impostorIds for the expelled impostor (if any mid-partida),
  // or all impostors when the partida is over.
  const revealedImpostors = lastResult.impostorIds
    .map((id) => room.players.find((p) => p.id === id))
    .filter(Boolean);

  const wasImpostor = votedOut
    ? lastResult.impostorIds.includes(votedOut.id)
    : false;

  // Partida-level winner (null = partida still ongoing)
  const partidaWinner = gameState.gameWinner;
  const isPartidaOver = partidaWinner !== null;

  // Recuento (lo manda el servidor; con voto secreto es lo único que se ve)
  const skipOption = { id: SKIP_VOTE, nickname: t("game.vote.skip"), avatarId: "ghost" };
  const tallyEntries = Object.entries(lastResult.voteCounts ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([playerId, count]) => ({
      player: playerId === SKIP_VOTE ? skipOption : room.players.find((p) => p.id === playerId),
      count,
    }))
    .filter((e) => e.player);

  // ── Helper strings ──────────────────────────────────────────────────────
  function stage1Headline() {
    if (!votedOut) return t("game.impostor.tie_no_expel");
    return wasImpostor ? "¡ERA EL IMPOSTOR!" : "¡NO ERA EL IMPOSTOR!";
  }

  function stage1Color() {
    if (!votedOut) return "text-text-secondary"; // tie
    return wasImpostor ? "text-success" : "text-danger";
  }

  function continuesOrWinsBanner() {
    if (!isPartidaOver) {
      // Partida still running — show neutral message
      return (
        <p className="text-text-muted text-sm mt-2">
          {lastResult.winner === "tie"
            ? "Nadie fue expulsado — la partida continúa"
            : wasImpostor
              ? "¡Buen trabajo! La partida continúa..."
              : "La partida continúa..."}
        </p>
      );
    }
    // Partida ended
    return (
      <p className={`font-display text-xl font-bold mt-2 ${
        partidaWinner === "players" ? "text-success" : "text-accent"
      }`}>
        {partidaWinner === "players"
          ? t("game.impostor.players_win")
          : t("game.impostor.impostor_wins")}
      </p>
    );
  }

  // Border/bg for the card
  const cardStyle = isPartidaOver
    ? partidaWinner === "players"
      ? "bg-success/10 border-success"
      : "bg-accent/10 border-accent"
    : votedOut
      ? wasImpostor
        ? "bg-success/10 border-success"
        : "bg-danger/10 border-danger"
      : "bg-bg-surface border-border"; // tie

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center"
    >
      <div className={`rounded-3xl p-8 border-2 ${cardStyle}`}>
        <AnimatePresence mode="wait">

          {/* ── Stage 0: who was expelled ───────────────────────────── */}
          {stage === 0 && (
            <motion.div
              key="expelled"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="min-h-48 flex flex-col items-center justify-center space-y-4"
            >
              <p className="text-text-muted text-xs uppercase tracking-widest">
                {t("game.impostor.voted_out_label")}
              </p>
              {votedOut ? (
                <>
                  <motion.div
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
                  >
                    <Avatar avatarId={votedOut.avatarId} size="xl" />
                  </motion.div>
                  <motion.h3
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="font-display text-3xl font-bold"
                  >
                    {votedOut.nickname}
                  </motion.h3>
                </>
              ) : (
                <>
                  <div className="text-6xl">🤝</div>
                  <p className="text-text-secondary text-lg">{t("game.impostor.tie_no_expel")}</p>
                </>
              )}
              <motion.div
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.1 }}
                className="text-text-muted text-2xl tracking-widest"
              >
                • • •
              </motion.div>
            </motion.div>
          )}

          {/* ── Stage 1: ERA o NO ERA impostor ──────────────────────── */}
          {stage === 1 && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="min-h-48 flex flex-col items-center justify-center space-y-4"
            >
              {votedOut && (
                <Avatar avatarId={votedOut.avatarId} size="xl" />
              )}
              <motion.p
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", bounce: 0.65, delay: 0.1 }}
                className={`font-display text-4xl sm:text-5xl font-black leading-tight ${stage1Color()}`}
              >
                {stage1Headline()}
              </motion.p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {continuesOrWinsBanner()}
              </motion.div>
            </motion.div>
          )}

          {/* ── Stage 2: full info ───────────────────────────────────── */}
          {stage === 2 && (
            <motion.div
              key="full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {votedOut && (
                <div className="flex justify-center mb-2">
                  <Avatar avatarId={votedOut.avatarId} size="xl" />
                </div>
              )}

              <p className={`font-display text-3xl font-black ${stage1Color()}`}>
                {stage1Headline()}
              </p>

              {continuesOrWinsBanner()}

              {/* Revealed impostors (only if server sent them) */}
              {revealedImpostors.length > 0 && (
                <div className="pt-3 border-t border-border/50 space-y-2">
                  <p className="text-text-muted text-xs uppercase tracking-wider">
                    {isPartidaOver ? t("game.impostor.impostors_were") : "Impostor expulsado"}
                  </p>
                  <div className="flex justify-center gap-3 flex-wrap">
                    {revealedImpostors.map((p) => (
                      <div key={p!.id} className="flex items-center gap-2 bg-accent/10 rounded-lg px-3 py-1.5">
                        <Avatar avatarId={p!.avatarId} size="sm" />
                        <span className="text-sm font-medium text-accent">{p!.nickname}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-text-secondary text-sm pt-1">
                    {t("game.impostor.word_was")}{" "}
                    <span className="font-bold text-primary">{lastResult.word}</span>
                  </p>
                </div>
              )}

              {/* Vote tally */}
              {tallyEntries.length > 0 && (
                <div className="pt-3 border-t border-border/50 space-y-3">
                  <div>
                    <p className="text-text-muted text-xs mb-2 uppercase tracking-wider">Recuento</p>
                    <div className="space-y-1.5">
                      {tallyEntries.map(({ player, count }) => {
                        const maxVotes = tallyEntries[0].count;
                        const pct = Math.round((count / maxVotes) * 100);
                        const isVotedOut = player!.id === lastResult.votedOutId;
                        return (
                          <div key={player!.id} className="flex items-center gap-2">
                            <Avatar avatarId={player!.avatarId} size="sm" />
                            <span className="text-xs text-text-secondary w-20 truncate">{player!.nickname}</span>
                            <div className="flex-1 h-2 bg-bg-surface-light rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${isVotedOut ? "bg-danger" : "bg-border"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`text-xs font-bold w-4 text-right ${isVotedOut ? "text-danger" : "text-text-muted"}`}>
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {lastResult.tieBreak && (
                    <p className="text-text-muted text-xs">{t(`game.vote.tiebreak.${lastResult.tieBreak}`)}</p>
                  )}
                  {Object.keys(gameState.votes).length > 0 && (
                  <div>
                    <p className="text-text-muted text-xs mb-1.5 uppercase tracking-wider">Quién votó a quién</p>
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {Object.entries(gameState.votes).map(([voterId, votedId]) => {
                        const voter = room.players.find((p) => p.id === voterId);
                        const voted = room.players.find((p) => p.id === votedId);
                        return (
                          <span key={voterId} className="text-xs bg-bg-surface-light rounded-lg px-2 py-1">
                            {voter?.nickname} → {votedId === SKIP_VOTE ? t("game.vote.skip") : voted?.nickname}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
