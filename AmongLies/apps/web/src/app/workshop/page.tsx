"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ALL_GAMES, WORKSHOP_CATEGORIES } from "@amonglies/shared";
import { Header } from "@/components/layout/Header";
import { ItemDetails, GameIcons } from "@/components/workshop/ItemDetails";
import {
  browseWorkshop,
  myLikes,
  myWorkshopItems,
  sourceVersions,
  workshopApi,
  type WorkshopFilters,
  type WorkshopRow,
} from "@/lib/workshop";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/hooks/useTranslation";

type Tab = "explore" | "mine";

const SELECT_CLASS =
  "bg-bg-surface-light border border-border rounded-xl px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary";

export default function WorkshopPage() {
  return (
    <Suspense>
      <WorkshopContent />
    </Suspense>
  );
}

function WorkshopContent() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const initialTab: Tab = useSearchParams().get("tab") === "mine" ? "mine" : "explore";
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="flex flex-col min-h-dvh">
      <Header />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 pb-10">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
          <div>
            <h2 className="font-display text-2xl font-bold">{t("workshop.title")}</h2>
            <p className="text-text-secondary text-sm">{t("workshop.subtitle")}</p>
          </div>
          <div role="tablist" className="flex gap-1 bg-bg-surface border border-border rounded-xl p-1">
            {(["explore", "mine"] as Tab[]).map((value) => (
              <button
                key={value}
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold cursor-pointer ${
                  tab === value ? "bg-primary text-white" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {t(`workshop.tab.${value}`)}
              </button>
            ))}
          </div>
        </div>
        {tab === "explore" ? (
          <Explore userId={user?.id ?? null} />
        ) : user ? (
          <Mine userId={user.id} />
        ) : (
          <p className="text-center text-text-secondary py-10">
            {t("workshop.login_needed")}{" "}
            <Link href="/login" className="text-primary hover:underline">{t("auth.login")}</Link>
          </p>
        )}
      </main>
    </div>
  );
}

// ── Explorar ──────────────────────────────────────────────────────────────

function Explore({ userId }: { userId: string | null }) {
  const { t, locale } = useTranslation();
  const [filters, setFilters] = useState<WorkshopFilters>({ query: "", kind: "", locale: "", game: "", category: "", sort: "likes" });
  const [items, setItems] = useState<WorkshopRow[] | null>(null);
  const [likes, setLikes] = useState<Set<string>>(new Set());
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => void browseWorkshop(filters).then(setItems), 250);
    return () => clearTimeout(id);
  }, [filters]);

  const [mineVersion, setMineVersion] = useState(0);
  const loadMine = () => setMineVersion((v) => v + 1);
  useEffect(() => {
    if (!userId) return;
    void Promise.all([myLikes(userId), myWorkshopItems(userId)]).then(([liked, mine]) => {
      setLikes(liked);
      // Lo tenés si es tuyo o si ya guardaste una copia.
      setOwned(new Set(mine.flatMap((i) => [i.id, ...(i.source_id ? [i.source_id] : [])])));
    });
  }, [userId, mineVersion]);

  const set = <K extends keyof WorkshopFilters>(key: K, value: WorkshopFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  async function toggleLike(item: WorkshopRow) {
    const like = !likes.has(item.id);
    const result = await workshopApi.like(item.id, like);
    if (!result.ok) return;
    setLikes((s) => {
      const next = new Set(s);
      if (like) next.add(item.id);
      else next.delete(item.id);
      return next;
    });
    setItems((list) => list?.map((i) => (i.id === item.id ? { ...i, likes_count: i.likes_count + (like ? 1 : -1) } : i)) ?? null);
  }

  async function copy(item: WorkshopRow) {
    const result = await workshopApi.copy(item.id);
    setNotice(result.ok ? t("workshop.saved_copy", { title: item.title }) : t(`workshop.error.${result.error}`));
    if (result.ok) loadMine();
  }

  return (
    <div className="space-y-4">
      <div className="bg-bg-surface border border-border rounded-2xl p-3 flex flex-wrap gap-2">
        <input
          aria-label={t("workshop.search")}
          placeholder={t("workshop.search")}
          value={filters.query}
          onChange={(e) => set("query", e.target.value)}
          className={`${SELECT_CLASS} flex-1 min-w-48`}
        />
        <select aria-label={t("workshop.filter.kind")} className={SELECT_CLASS} value={filters.kind} onChange={(e) => set("kind", e.target.value as WorkshopFilters["kind"])}>
          <option value="">{t("workshop.filter.all_kinds")}</option>
          <option value="word_list">{t("workshop.kind.word_list")}</option>
          <option value="preset">{t("workshop.kind.preset")}</option>
        </select>
        <select aria-label={t("workshop.filter.locale")} className={SELECT_CLASS} value={filters.locale} onChange={(e) => set("locale", e.target.value as WorkshopFilters["locale"])}>
          <option value="">{t("workshop.filter.all_locales")}</option>
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
        <select aria-label={t("workshop.filter.game")} className={SELECT_CLASS} value={filters.game} onChange={(e) => set("game", e.target.value as WorkshopFilters["game"])}>
          <option value="">{t("workshop.filter.all_games")}</option>
          {ALL_GAMES.map((g) => (
            <option key={g.id} value={g.id}>{g.emoji} {g.name[locale]}</option>
          ))}
        </select>
        <select aria-label={t("workshop.filter.category")} className={SELECT_CLASS} value={filters.category} onChange={(e) => set("category", e.target.value)}>
          <option value="">{t("workshop.filter.all_categories")}</option>
          {WORKSHOP_CATEGORIES.map((c) => (
            <option key={c} value={c}>{t(`workshop.category.${c}`)}</option>
          ))}
        </select>
        <select aria-label={t("workshop.filter.sort")} className={SELECT_CLASS} value={filters.sort} onChange={(e) => set("sort", e.target.value as WorkshopFilters["sort"])}>
          <option value="likes">{t("workshop.sort.likes")}</option>
          <option value="new">{t("workshop.sort.new")}</option>
        </select>
      </div>

      {notice && <p role="status" className="text-sm text-center text-success">{notice}</p>}
      {items?.length === 0 && <p className="text-center text-text-muted py-10">{t("workshop.empty")}</p>}

      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items?.map((item) => (
          <li key={item.id} className="bg-bg-surface border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold truncate">{item.title}</h3>
                <p className="text-xs text-text-muted">
                  @{item.owner?.username ?? "?"} · {t(`workshop.kind.${item.kind}`)}
                  {item.locale && ` · ${item.locale.toUpperCase()}`}
                  {item.category && ` · ${t(`workshop.category.${item.category}`)}`}
                  {"words" in item.content && ` · ${t("lobby.words", { n: item.content.words.length })}`}
                </p>
              </div>
              <GameIcons games={item.games} />
            </div>
            {item.description && <p className="text-sm text-text-secondary">{item.description}</p>}
            {open === item.id && <ItemDetails item={item} />}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={!userId}
                aria-pressed={likes.has(item.id)}
                aria-label={t("workshop.like")}
                onClick={() => void toggleLike(item)}
                className={`px-3 py-1.5 rounded-lg text-sm border cursor-pointer disabled:cursor-default ${
                  likes.has(item.id) ? "border-accent text-accent bg-accent/10" : "border-border text-text-secondary"
                }`}
              >
                {likes.has(item.id) ? "♥" : "♡"} {item.likes_count}
              </button>
              <button
                type="button"
                onClick={() => setOpen(open === item.id ? null : item.id)}
                className="px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:text-text-primary cursor-pointer"
              >
                {open === item.id ? t("workshop.hide") : t("workshop.show")}
              </button>
              <span className="flex-1" />
              {userId &&
                (owned.has(item.id) ? (
                  <span className="text-xs text-success">{t("workshop.in_collection")}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void copy(item)}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-primary text-white cursor-pointer"
                  >
                    {t("workshop.save_copy")}
                  </button>
                ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Mi colección ──────────────────────────────────────────────────────────

function Mine({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<WorkshopRow[] | null>(null);
  const [latest, setLatest] = useState<Map<string, number>>(new Map());
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [version, setVersion] = useState(0);
  useEffect(() => {
    void myWorkshopItems(userId).then(async (mine) => {
      setItems(mine);
      setLatest(await sourceVersions(mine.flatMap((i) => (i.source_id ? [i.source_id] : []))));
    });
  }, [userId, version]);

  async function run(action: Promise<{ ok: boolean; error?: string }>, okKey: string) {
    const result = await action;
    setNotice(result.ok ? t(okKey) : t(`workshop.error.${result.error}`));
    setVersion((v) => v + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Link href="/workshop/editar/nueva" className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold">
          + {t("workshop.new_list")}
        </Link>
        <p className="text-xs text-text-muted self-center">{t("workshop.preset_hint")}</p>
      </div>
      {notice && <p role="status" className="text-sm text-center text-success">{notice}</p>}
      {items?.length === 0 && <p className="text-center text-text-muted py-10">{t("workshop.empty_mine")}</p>}
      <ul className="space-y-2">
        {items?.map((item) => {
          const newest = item.source_id ? latest.get(item.source_id) : undefined;
          const outdated = newest !== undefined && item.source_version !== null && newest > item.source_version;
          return (
            <li key={item.id} className="bg-bg-surface border border-border rounded-2xl p-4 space-y-3">
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold truncate">{item.title}</h3>
                  <div className="flex flex-wrap gap-1.5 mt-1 text-xs">
                    <Badge>{t(`workshop.kind.${item.kind}`)}</Badge>
                    <Badge tone={item.published ? "success" : "muted"}>
                      {item.published ? t("workshop.published") : t("workshop.private")}
                    </Badge>
                    {item.source_id && <Badge>{t("workshop.copy")}</Badge>}
                    {item.modified && <Badge>{t("workshop.modified")}</Badge>}
                    {outdated && <Badge tone="warning">{t("workshop.outdated")}</Badge>}
                  </div>
                </div>
                <GameIcons games={item.games} />
              </div>
              {open === item.id && <ItemDetails item={item} />}
              <div className="flex gap-2 flex-wrap">
                <SmallButton onClick={() => setOpen(open === item.id ? null : item.id)}>
                  {open === item.id ? t("workshop.hide") : t("workshop.show")}
                </SmallButton>
                <Link href={`/workshop/editar/${item.id}`} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border hover:border-primary/40">
                  {t("workshop.edit")}
                </Link>
                {outdated && (
                  <SmallButton
                    primary
                    onClick={() => {
                      if (!item.modified || window.confirm(t("workshop.update_confirm")))
                        void run(workshopApi.updateCopy(item.id), "workshop.updated");
                    }}
                  >
                    {t("workshop.update")}
                  </SmallButton>
                )}
                <SmallButton onClick={() => void run(workshopApi.publish(item.id, !item.published), item.published ? "workshop.unpublished_ok" : "workshop.published_ok")}>
                  {item.published ? t("workshop.unpublish") : t("workshop.publish")}
                </SmallButton>
                <SmallButton
                  onClick={() => {
                    if (window.confirm(t("workshop.delete_confirm", { title: item.title })))
                      void run(workshopApi.remove(item.id), "workshop.deleted");
                  }}
                >
                  {t("workshop.delete")}
                </SmallButton>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "success" | "muted" | "warning" }) {
  const tones = {
    default: "bg-bg-surface-light text-text-secondary",
    success: "bg-success/15 text-success",
    muted: "bg-bg-surface-light text-text-muted",
    warning: "bg-warning/15 text-warning",
  };
  return <span className={`px-2 py-0.5 rounded-md ${tones[tone]}`}>{children}</span>;
}

function SmallButton({ children, onClick, primary = false }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
        primary ? "bg-primary text-white" : "border border-border hover:border-primary/40"
      }`}
    >
      {children}
    </button>
  );
}
