"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AVATARS } from "@amonglies/shared";
import { AuthCard, CheckEmail, FormError } from "@/components/auth/AuthCard";
import { Avatar, Button, Input } from "@/components/ui";
import { USERNAME_PATTERN, useAuthStore } from "@/stores/authStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useTranslation } from "@/hooks/useTranslation";

export default function RegisterPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { signUp, isUsernameTaken } = useAuthStore();
  const guest = usePlayerStore();
  // Se arranca con el apodo y avatar que ya usaba como invitado.
  const [username, setUsername] = useState(() => (USERNAME_PATTERN.test(guest.nickname) ? guest.nickname : ""));
  const [avatarId, setAvatarId] = useState(guest.avatarId);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!USERNAME_PATTERN.test(username)) {
      setError(t("auth.error.username_invalid"));
      return;
    }
    setLoading(true);
    if (await isUsernameTaken(username)) {
      setLoading(false);
      setError(t("auth.error.username_taken"));
      return;
    }
    const result = await signUp({ email: email.trim(), password, username, avatarId, locale });
    setLoading(false);
    if (result.error) setError(t(`auth.error.${result.error}`, undefined, t("auth.error.unexpected_failure")));
    else if (result.needsConfirmation) setSent(true);
    else router.push("/");
  }

  if (sent) {
    return (
      <AuthCard title={t("auth.check_email")}>
        <CheckEmail text={t("auth.check_email.signup", { email })} />
        <Link href="/login" className="block text-center text-sm text-primary hover:underline">{t("auth.login")}</Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("auth.register")} subtitle={t("auth.register.subtitle")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t("auth.username")} placeholder="JugadorEpico" autoComplete="username" required maxLength={16} value={username} onChange={(e) => setUsername(e.target.value)} />
        <div>
          <label className="text-sm font-medium text-text-secondary mb-2 block">{t("landing.avatar")}</label>
          <div className="grid grid-cols-8 gap-2">
            {AVATARS.map((avatar) => (
              <Avatar key={avatar.id} avatarId={avatar.id} size="sm" selected={avatarId === avatar.id} onClick={() => setAvatarId(avatar.id)} />
            ))}
          </div>
        </div>
        <Input label={t("auth.email")} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label={t("auth.password")} type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" isLoading={loading} disabled={loading}>
          {t("auth.register")}
        </Button>
      </form>
      <p className="text-center text-sm text-text-muted">
        {t("auth.have_account")} <Link href="/login" className="text-primary hover:underline">{t("auth.login")}</Link>
      </p>
    </AuthCard>
  );
}
