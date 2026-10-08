"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Locale, ModerationResult } from "@amonglies/shared";
import { Header } from "@/components/layout/Header";
import { Button, Input } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { getSocket, whenSessionReady } from "@/lib/socket";
import { useAuthStore } from "@/stores/authStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useTranslation } from "@/hooks/useTranslation";

export default function SettingsPage() {
  const { t } = useTranslation();
  const { user, profile } = useAuthStore();

  return (
    <div className="flex flex-col min-h-dvh">
      <Header />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pb-10 space-y-4">
        <h2 className="font-display text-2xl font-bold">{t("settings.title")}</h2>
        <LanguageSection />
        <SoundSection />
        <NotificationsSection />
        {user && profile ? (
          <>
            <PrivacySection />
            <AccountSection />
          </>
        ) : (
          <Section title={t("settings.account")}>
            <p className="text-sm text-text-secondary">
              {t("settings.guest")} <Link href="/login" className="text-primary hover:underline">{t("auth.login")}</Link>
            </p>
          </Section>
        )}
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-bg-surface border border-border rounded-2xl p-4 sm:p-5 space-y-4">
      <h3 className="font-display font-bold text-xs text-text-secondary uppercase tracking-widest">{title}</h3>
      {children}
    </section>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span>
        <span className="text-sm block">{label}</span>
        {hint && <span className="text-xs text-text-muted block">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-5 h-5 accent-primary shrink-0" />
    </label>
  );
}

function Volume({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-24 shrink-0 text-text-secondary">{label}</span>
      <input type="range" min={0} max={100} value={Math.round(value * 100)} disabled={disabled} onChange={(e) => onChange(Number(e.target.value) / 100)} className="flex-1 accent-primary" />
      <span className="w-10 text-right font-mono text-xs text-primary">{Math.round(value * 100)}%</span>
    </label>
  );
}

function LanguageSection() {
  const { t } = useTranslation();
  const { locale, setLocale } = usePlayerStore();
  const { profile, updateProfile } = useAuthStore();
  return (
    <Section title={t("settings.language")}>
      <div className="flex gap-2">
        {(["es", "en"] as Locale[]).map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={locale === l}
            onClick={() => {
              setLocale(l);
              if (profile) void updateProfile({ locale: l });
            }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer ${locale === l ? "bg-primary text-white" : "border border-border text-text-secondary"}`}
          >
            {l === "es" ? "🇪🇸 Español" : "🇬🇧 English"}
          </button>
        ))}
      </div>
    </Section>
  );
}

function SoundSection() {
  const { t } = useTranslation();
  const s = useSettingsStore();
  return (
    <Section title={t("settings.sound")}>
      <Toggle label={t("settings.sfx")} hint={t("settings.sfx_hint")} checked={s.sfxOn} onChange={(sfxOn) => s.set({ sfxOn })} />
      <Volume label={t("settings.volume")} value={s.sfxVolume} disabled={!s.sfxOn} onChange={(sfxVolume) => s.set({ sfxVolume })} />
      <Toggle label={t("settings.music")} hint={t("settings.music_hint")} checked={s.musicOn} onChange={(musicOn) => s.set({ musicOn })} />
      <Volume label={t("settings.volume")} value={s.musicVolume} disabled={!s.musicOn} onChange={(musicVolume) => s.set({ musicVolume })} />
    </Section>
  );
}

function NotificationsSection() {
  const { t } = useTranslation();
  const s = useSettingsStore();
  return (
    <Section title={t("settings.notifications")}>
      <Toggle label={t("settings.toasts")} hint={t("settings.toasts_hint")} checked={s.showToasts} onChange={(showToasts) => s.set({ showToasts })} />
    </Section>
  );
}

function PrivacySection() {
  const { t } = useTranslation();
  const { profile, updateProfile } = useAuthStore();
  if (!profile) return null;
  return (
    <Section title={t("settings.privacy")}>
      <Toggle label={t("settings.appear_offline")} hint={t("settings.appear_offline_hint")} checked={profile.appear_offline} onChange={(v) => void updateProfile({ appear_offline: v })} />
      <Toggle label={t("settings.allow_invites")} hint={t("settings.allow_invites_hint")} checked={profile.allow_invites} onChange={(v) => void updateProfile({ allow_invites: v })} />
    </Section>
  );
}

function AccountSection() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, profile, signOut, updatePassword } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function changeEmail() {
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setNotice(error ? { ok: false, text: t(`auth.error.${error.code ?? "unexpected_failure"}`) } : { ok: true, text: t("settings.email_sent") });
  }

  async function changePassword() {
    if (password !== password2) {
      setNotice({ ok: false, text: t("auth.error.password_mismatch") });
      return;
    }
    const error = await updatePassword(password);
    setNotice(error ? { ok: false, text: t(`auth.error.${error}`) } : { ok: true, text: t("settings.password_changed") });
    if (!error) {
      setPassword("");
      setPassword2("");
    }
  }

  function deleteAccount() {
    whenSessionReady(() =>
      getSocket()
        .timeout(15000)
        .emit("account:delete", { confirmUsername: confirmName }, async (err: unknown, res?: ModerationResult) => {
          if (err || !res?.ok) {
            setNotice({ ok: false, text: t(res && !res.ok && res.error === "invalid" ? "settings.delete_mismatch" : "settings.delete_failed") });
            return;
          }
          await signOut();
          router.push("/");
        }),
    );
  }

  return (
    <Section title={t("settings.account")}>
      <p className="text-sm text-text-secondary">
        @{profile?.username} · {user?.email}
      </p>
      {notice && <p role="status" className={`text-sm ${notice.ok ? "text-success" : "text-danger"}`}>{notice.text}</p>}

      <div className="space-y-2">
        <Input label={t("settings.new_email")} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button size="sm" variant="secondary" disabled={!email.includes("@")} onClick={() => void changeEmail()}>{t("settings.change_email")}</Button>
      </div>

      <div className="space-y-2">
        <Input label={t("auth.new_password")} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Input label={t("settings.repeat_password")} type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} />
        <Button size="sm" variant="secondary" disabled={password.length < 6} onClick={() => void changePassword()}>{t("settings.change_password")}</Button>
      </div>

      <Button size="sm" variant="ghost" onClick={() => void signOut().then(() => router.push("/"))}>{t("auth.logout")}</Button>

      <div className="border-t border-danger/30 pt-4 space-y-2">
        <h4 className="text-sm font-semibold text-danger">{t("settings.delete_title")}</h4>
        <p className="text-xs text-text-muted">{t("settings.delete_hint", { name: profile?.username ?? "" })}</p>
        <Input label={t("settings.delete_confirm_label")} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
        <Button size="sm" variant="danger" disabled={confirmName.trim().toLowerCase() !== profile?.username.toLowerCase()} onClick={deleteAccount}>
          {t("settings.delete")}
        </Button>
      </div>
    </Section>
  );
}
