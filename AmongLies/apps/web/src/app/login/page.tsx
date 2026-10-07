"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard, FormError } from "@/components/auth/AuthCard";
import { Button, Input } from "@/components/ui";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/hooks/useTranslation";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const signIn = useAuthStore((s) => s.signIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const code = await signIn(email.trim(), password);
    setLoading(false);
    if (code) setError(t(`auth.error.${code}`, undefined, t("auth.error.unexpected_failure")));
    else router.push("/");
  }

  return (
    <AuthCard title={t("auth.login")} subtitle={t("auth.login.subtitle")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t("auth.email")} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label={t("auth.password")} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="text-right">
          <Link href="/recuperar" className="text-xs text-primary hover:underline">{t("auth.forgot")}</Link>
        </div>
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" isLoading={loading} disabled={loading}>
          {t("auth.login")}
        </Button>
      </form>
      <div className="text-center space-y-2 text-sm">
        <Link href="/" className="block text-text-secondary hover:text-text-primary">{t("auth.play_as_guest")}</Link>
        <p className="text-text-muted">
          {t("auth.no_account")} <Link href="/registro" className="text-primary hover:underline">{t("auth.register")}</Link>
        </p>
      </div>
    </AuthCard>
  );
}
