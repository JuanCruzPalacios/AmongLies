"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthCard, CheckEmail, FormError } from "@/components/auth/AuthCard";
import { Button, Input } from "@/components/ui";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/hooks/useTranslation";

export default function RecoverPasswordPage() {
  const { t } = useTranslation();
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const code = await requestPasswordReset(email.trim());
    setLoading(false);
    if (code) setError(t(`auth.error.${code}`, undefined, t("auth.error.unexpected_failure")));
    else setSent(true);
  }

  return (
    <AuthCard title={sent ? t("auth.check_email") : t("auth.recover")} subtitle={sent ? undefined : t("auth.recover.subtitle")}>
      {sent ? (
        <CheckEmail text={t("auth.check_email.recover", { email })} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label={t("auth.email")} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <FormError message={error} />
          <Button type="submit" size="lg" className="w-full" isLoading={loading} disabled={loading}>
            {t("auth.recover.send")}
          </Button>
        </form>
      )}
      <Link href="/login" className="block text-center text-sm text-primary hover:underline">{t("auth.back_to_login")}</Link>
    </AuthCard>
  );
}
