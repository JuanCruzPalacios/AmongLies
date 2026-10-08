"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { WORKSHOP_CATEGORIES, WORKSHOP_LIMITS, type Locale, type WorkshopDraft } from "@amonglies/shared";
import { Header } from "@/components/layout/Header";
import { Button, Input } from "@/components/ui";
import { ItemDetails } from "@/components/workshop/ItemDetails";
import { getWorkshopItem, workshopApi, type WorkshopRow } from "@/lib/workshop";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/hooks/useTranslation";

const FIELD = "bg-bg-surface-light border border-border rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-primary w-full";

/** Separa por renglón o por coma, sin vacías ni repetidas (igual que el servidor). */
function parseWords(text: string): string[] {
  const seen = new Set<string>();
  return text
    .split(/[\n,]/)
    .map((w) => w.trim().replace(/\s+/g, " "))
    .filter((w) => {
      const key = w.toLocaleLowerCase();
      if (!w || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export default function WorkshopEditorPage() {
  const { t, locale: uiLocale } = useTranslation();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const isNew = id === "nueva";
  const { ready, user } = useAuthStore();

  const [item, setItem] = useState<WorkshopRow | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locale, setLocale] = useState<Locale>(uiLocale);
  const [category, setCategory] = useState<string>("other");
  const [drawable, setDrawable] = useState(false);
  const [wordsText, setWordsText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) return;
    void getWorkshopItem(id).then((row) => {
      setLoading(false);
      if (!row) return;
      setItem(row);
      setTitle(row.title);
      setDescription(row.description);
      if (row.locale) setLocale(row.locale);
      setCategory(row.category ?? "other");
      setDrawable(row.drawable);
      if ("words" in row.content) setWordsText(row.content.words.join("\n"));
    });
  }, [id, isNew]);

  if (ready && !user) {
    return (
      <div className="flex flex-col min-h-dvh">
        <Header />
        <p className="text-center text-text-secondary py-10">{t("workshop.login_needed")}</p>
      </div>
    );
  }

  const isPreset = item?.kind === "preset";
  const words = parseWords(wordsText);
  const tooLong = words.find((w) => w.length > WORKSHOP_LIMITS.wordMax);
  const titleOk = title.trim().length >= WORKSHOP_LIMITS.titleMin && title.trim().length <= WORKSHOP_LIMITS.titleMax;
  const wordsOk = isPreset || (words.length >= WORKSHOP_LIMITS.wordsMin && words.length <= WORKSHOP_LIMITS.wordsMax && !tooLong);
  const notMine = item !== null && user !== null && item.owner_id !== user.id;

  async function save() {
    setSaving(true);
    setError(null);
    const draft: WorkshopDraft = isPreset && item && "gameId" in item.content
      ? { id: item.id, kind: "preset", title, description, gameId: item.content.gameId, settings: item.content.settings }
      : { ...(item ? { id: item.id } : {}), kind: "word_list", title, description, locale, category, drawable, words };
    const result = await workshopApi.save(draft);
    setSaving(false);
    if (!result.ok) {
      setError(t(`workshop.error.${result.error}`));
      return;
    }
    router.push("/workshop?tab=mine");
  }

  return (
    <div className="flex flex-col min-h-dvh">
      <Header />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pb-10 space-y-5">
        <Link href="/workshop?tab=mine" className="text-sm text-text-secondary hover:text-text-primary">
          ← {t("workshop.back")}
        </Link>
        <h2 className="font-display text-2xl font-bold">
          {isNew ? t("workshop.new_list") : isPreset ? t("workshop.edit_preset") : t("workshop.edit_list")}
        </h2>
        {loading && <p className="text-text-muted">…</p>}
        {!loading && !isNew && !item && <p className="text-danger">{t("workshop.error.not_found")}</p>}
        {notMine && <p className="text-danger">{t("workshop.error.not_owner")}</p>}

        {(isNew || (item && !notMine)) && (
          <div className="bg-bg-surface border border-border rounded-3xl p-5 sm:p-6 space-y-4">
            <Input label={t("workshop.field.title")} value={title} maxLength={WORKSHOP_LIMITS.titleMax} onChange={(e) => setTitle(e.target.value)} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ws-description" className="text-sm font-medium text-text-secondary">{t("workshop.field.description")}</label>
              <textarea id="ws-description" className={FIELD} rows={2} maxLength={WORKSHOP_LIMITS.descriptionMax} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            {isPreset && item ? (
              <>
                <p className="text-xs text-text-muted">{t("workshop.preset_settings_hint")}</p>
                <ItemDetails item={item} />
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="ws-locale" className="text-sm font-medium text-text-secondary">{t("workshop.field.locale")}</label>
                    <select id="ws-locale" className={FIELD} value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
                      <option value="es">Español</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="ws-category" className="text-sm font-medium text-text-secondary">{t("workshop.field.category")}</label>
                    <select id="ws-category" className={FIELD} value={category} onChange={(e) => setCategory(e.target.value)}>
                      {WORKSHOP_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{t(`workshop.category.${c}`)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={drawable} onChange={(e) => setDrawable(e.target.checked)} className="accent-primary w-4 h-4" />
                  {t("workshop.field.drawable")}
                </label>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ws-words" className="text-sm font-medium text-text-secondary">{t("workshop.field.words")}</label>
                  <textarea id="ws-words" className={`${FIELD} font-mono text-sm`} rows={12} value={wordsText} onChange={(e) => setWordsText(e.target.value)} placeholder={t("workshop.field.words_placeholder")} />
                  <p className={`text-xs ${wordsOk ? "text-text-muted" : "text-warning"}`}>
                    {tooLong
                      ? t("workshop.word_too_long", { word: tooLong.slice(0, 20), max: WORKSHOP_LIMITS.wordMax })
                      : t("workshop.word_count", { n: words.length, min: WORKSHOP_LIMITS.wordsMin, max: WORKSHOP_LIMITS.wordsMax })}
                  </p>
                </div>
              </>
            )}

            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <Button className="w-full" onClick={() => void save()} disabled={!titleOk || !wordsOk || saving} isLoading={saving}>
              {t("workshop.save")}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
