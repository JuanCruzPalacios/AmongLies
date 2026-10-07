"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard, FormError } from "@/components/auth/AuthCard";
import { Button, Input } from "@/components/ui";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/hooks/useTranslation";

/** Se llega desde el link del mail de recuperación (Supabase crea la sesión al abrirlo). */
export default function NewPasswordPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { ready, user, updatePassword } = useAuthStore();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError(t("auth.error.password_mismatch"));
      return;
    }
    setLoading(true);
    const code = await updatePassword(password);
    setLoading(false);
    if (code) setError(t(`auth.error.${code}`, undefined, t("auth.error.unexpected_failure")));
    else router.push("/");
  }

  if (ready && !user) {
    return (
      <AuthCard title={t("auth.new_password")}>
        <FormError message={t("auth.error.link_expired")} />
        <Link href="/recuperar" className="block text-center text-sm text-primary hover:underline">{t("auth.recover")}</Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("auth.new_password")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t("auth.password")} type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        <Input label={t("auth.password_confirm")} type="password" autoComplete="new-password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" isLoading={loading} disabled={loading || !ready}>
          {t("auth.new_password.save")}
        </Button>
      </form>
    </AuthCard>
  );
}
