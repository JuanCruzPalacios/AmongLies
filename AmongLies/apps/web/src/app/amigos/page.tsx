"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FriendProfile, SocialError } from "@amonglies/shared";
import { AuthCard } from "@/components/auth/AuthCard";
import { Avatar, Input } from "@/components/ui";
import { PresenceBadge } from "@/components/social/PresenceBadge";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/stores/authStore";
import { useSocialStore } from "@/stores/socialStore";
import { useTranslation } from "@/hooks/useTranslation";

type Ack = { ok: true } | { ok: false; error: SocialError };

export default function FriendsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { ready, user } = useAuthStore();
  const { friends, incoming, outgoing, loaded } = useSocialStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FriendProfile[]>([]);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Búsqueda con una pequeña espera para no consultar en cada tecla.
  useEffect(() => {
    const q = query.trim();
    const id = setTimeout(() => {
      if (!q) {
        setResults([]);
        return;
      }
      getSocket().emit("social:search", { query: q }, setResults);
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  function report(result: Ack, okKey: string) {
    setMessage(result.ok ? { text: t(okKey), ok: true } : { text: t(`social.error.${result.error}`), ok: false });
  }

  if (ready && !user) {
    return (
      <AuthCard title={t("social.title")}>
        <p className="text-center text-text-secondary text-sm">{t("social.login_needed")}</p>
        <Link href="/login" className="block text-center text-sm text-primary hover:underline">{t("auth.login")}</Link>
      </AuthCard>
    );
  }

  const known = new Set([...friends, ...incoming, ...outgoing].map((p) => p.userId));

  return (
    <AuthCard title={t("social.title")}>
      <section className="space-y-2">
        <Input
          label={t("social.search")}
          placeholder={t("social.search_placeholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={21}
        />
        {results.length > 0 && (
          <ul className="space-y-1">
            {results.map((p) => (
              <Row key={p.userId} profile={p}>
                {known.has(p.userId) ? (
                  <span className="text-xs text-text-muted">{t("social.already_listed")}</span>
                ) : (
                  <SmallButton
                    onClick={() =>
                      getSocket().emit("social:request", { username: p.username }, (r) => report(r, "social.request_sent"))
                    }
                  >
                    {t("social.add")}
                  </SmallButton>
                )}
              </Row>
            ))}
          </ul>
        )}
        {message && (
          <p role="status" className={`text-sm text-center ${message.ok ? "text-success" : "text-danger"}`}>
            {message.text}
          </p>
        )}
      </section>

      {incoming.length > 0 && (
        <Section title={t("social.incoming")}>
          {incoming.map((p) => (
            <Row key={p.userId} profile={p}>
              <SmallButton onClick={() => getSocket().emit("social:respond", { userId: p.userId, accept: true }, (r) => report(r, "social.accepted"))}>
                {t("social.accept")}
              </SmallButton>
              <SmallButton variant="ghost" onClick={() => getSocket().emit("social:respond", { userId: p.userId, accept: false }, () => setMessage(null))}>
                {t("social.reject")}
              </SmallButton>
            </Row>
          ))}
        </Section>
      )}

      <Section title={`${t("social.friends")} (${friends.length})`}>
        {loaded && friends.length === 0 && <p className="text-sm text-text-muted text-center py-2">{t("social.no_friends")}</p>}
        {friends.map((f) => (
          <Row key={f.userId} profile={f} subtitle={<PresenceBadge presence={f.presence} />}>
            {f.presence.status === "lobby" && f.presence.roomCode && (
              <SmallButton onClick={() => router.push(`/room/${f.presence.roomCode}`)}>{t("social.join")}</SmallButton>
            )}
            <SmallButton
              variant="ghost"
              onClick={() => {
                if (window.confirm(t("social.remove_confirm", { name: f.username })))
                  getSocket().emit("social:remove", { userId: f.userId }, () => setMessage(null));
              }}
            >
              {t("social.remove")}
            </SmallButton>
          </Row>
        ))}
      </Section>

      {outgoing.length > 0 && (
        <Section title={t("social.outgoing")}>
          {outgoing.map((p) => (
            <Row key={p.userId} profile={p}>
              <SmallButton variant="ghost" onClick={() => getSocket().emit("social:remove", { userId: p.userId }, () => setMessage(null))}>
                {t("social.cancel")}
              </SmallButton>
            </Row>
          ))}
        </Section>
      )}
    </AuthCard>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="font-display font-bold text-xs text-text-secondary uppercase tracking-widest mb-2">{title}</h3>
      <ul className="space-y-1">{children}</ul>
    </section>
  );
}

function Row({ profile, subtitle, children }: { profile: FriendProfile; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 bg-bg-surface-light border border-border rounded-xl px-3 py-2">
      <Avatar avatarId={profile.avatarId} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">@{profile.username}</p>
        {subtitle}
      </div>
      <div className="flex items-center gap-1 shrink-0">{children}</div>
    </li>
  );
}

function SmallButton({ children, onClick, variant = "primary" }: { children: React.ReactNode; onClick: () => void; variant?: "primary" | "ghost" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
        variant === "primary" ? "bg-primary text-white hover:bg-primary-light" : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
      }`}
    >
      {children}
    </button>
  );
}
