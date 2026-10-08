"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { Avatar } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/hooks/useTranslation";
import { ALL_GAMES } from "@amonglies/shared";

interface Stats {
  game_id: string;
  games_played: number;
  partidas_played: number;
  partidas_as_impostor: number;
  partidas_won_as_impostor: number;
  partidas_as_innocent: number;
  partidas_won_as_innocent: number;
  correct_votes: number;
  innocent_votes: number;
  total_points: number;
}

export default function ProfilePage() {
  const { t, locale } = useTranslation();
  const { ready, user, profile } = useAuthStore();
  const [stats, setStats] = useState<Stats[] | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("player_stats")
      .select("*")
      .eq("user_id", user.id)
      .then(({ data }) => setStats((data as Stats[] | null) ?? []));
  }, [user]);

  if (ready && !user) {
    return (
      <AuthCard title={t("profile.title")}>
        <p className="text-center text-text-secondary text-sm">{t("profile.login_needed")}</p>
        <Link href="/login" className="block text-center text-sm text-primary hover:underline">{t("auth.login")}</Link>
      </AuthCard>
    );
  }

  const percent = (part: number, total: number) => (total > 0 ? `${Math.round((part / total) * 100)}%` : "—");

  return (
    <AuthCard title={t("profile.title")}>
      {profile && (
        <div className="flex flex-col items-center gap-2">
          <Avatar avatarId={profile.avatar_id} size="xl" />
          <span className="font-display text-xl font-bold">@{profile.username}</span>
        </div>
      )}

      {stats?.length === 0 && (
        <p className="text-center text-text-muted text-sm">{t("profile.no_stats")}</p>
      )}
      {/* Un bloque por juego jugado, en el orden del selector. */}
      {ALL_GAMES.map((game) => {
        const s = stats?.find((row) => row.game_id === game.id);
        if (!s) return null;
        return (
          <div key={game.id}>
            <h3 className="font-display font-bold text-xs text-text-secondary uppercase tracking-widest mb-3 text-center">
              {t("profile.stats")} · {game.emoji} {game.name[locale]}
            </h3>
            <dl className="grid grid-cols-2 gap-2">
              <Stat label={t("profile.games_played")} value={s.games_played} />
              <Stat label={t("profile.partidas_played")} value={s.partidas_played} />
              <Stat label={t("profile.wins_impostor")} value={`${s.partidas_won_as_impostor}/${s.partidas_as_impostor}`} />
              <Stat label={t("profile.wins_innocent")} value={`${s.partidas_won_as_innocent}/${s.partidas_as_innocent}`} />
              <Stat label={t("profile.vote_accuracy")} value={percent(s.correct_votes, s.innocent_votes)} />
              <Stat label={t("profile.total_points")} value={s.total_points} />
            </dl>
          </div>
        );
      })}
    </AuthCard>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-bg-surface-light border border-border rounded-xl px-3 py-2 text-center">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="font-display text-lg font-bold text-primary">{value}</dd>
    </div>
  );
}
