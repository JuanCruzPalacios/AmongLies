"use client";

import { useEffect, useState } from "react";
import type { AdminUserView, ReportStatus, ReportView } from "@amonglies/shared";
import { Header } from "@/components/layout/Header";
import { Avatar } from "@/components/ui";
import { adminCall } from "@/lib/admin";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/hooks/useTranslation";

type Tab = "reports" | "users";
const SUSPENSIONS: (number | null)[] = [1, 7, 30, null];

/** La hora al abrir el panel (para saber qué suspensiones siguen vigentes). */
function useNow(): number {
  const [now] = useState(() => Date.now());
  return now;
}

function isSuspended(until: string | null, now: number): boolean {
  return !!until && (until === "infinity" || Date.parse(until) > now);
}

export default function AdminPage() {
  const { t } = useTranslation();
  const { ready, profile } = useAuthStore();
  const [tab, setTab] = useState<Tab>("reports");

  if (ready && !profile?.is_admin) {
    return (
      <div className="flex flex-col min-h-dvh">
        <Header />
        <p className="text-center text-text-secondary py-16">{t("admin.no_access")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh">
      <Header />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 pb-10">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
          <h2 className="font-display text-2xl font-bold">{t("admin.title")}</h2>
          <div role="tablist" className="flex gap-1 bg-bg-surface border border-border rounded-xl p-1">
            {(["reports", "users"] as Tab[]).map((value) => (
              <button
                key={value}
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold cursor-pointer ${
                  tab === value ? "bg-primary text-white" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {t(`admin.tab.${value}`)}
              </button>
            ))}
          </div>
        </div>
        {profile?.is_admin && (tab === "reports" ? <Reports /> : <Users myId={profile.id} />)}
      </main>
    </div>
  );
}

function useNotice() {
  const { t } = useTranslation();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const show = (result: { ok: boolean; error?: string }, okKey: string) =>
    setNotice(result.ok ? { ok: true, text: t(okKey) } : { ok: false, text: t(`admin.error.${result.error}`) });
  const view = notice && (
    <p role="status" className={`text-sm text-center ${notice.ok ? "text-success" : "text-danger"}`}>{notice.text}</p>
  );
  return { show, view };
}

function SuspendButtons({ userId, onDone }: { userId: string; onDone: (r: { ok: boolean; error?: string }) => void }) {
  const { t } = useTranslation();
  return (
    <span className="flex flex-wrap gap-1 items-center">
      <span className="text-xs text-text-muted">{t("admin.suspend")}:</span>
      {SUSPENSIONS.map((days) => (
        <button
          key={String(days)}
          type="button"
          className="px-2 py-1 rounded-md text-xs border border-danger/40 text-danger hover:bg-danger/10 cursor-pointer"
          onClick={async () => {
            const reason = window.prompt(t("admin.suspend_reason"));
            if (reason === null) return;
            onDone(await adminCall("admin:suspend", { userId, days, reason }));
          }}
        >
          {days === null ? t("admin.forever") : t("admin.days", { n: days })}
        </button>
      ))}
    </span>
  );
}

function SuspendedBadge({ until }: { until: string | null }) {
  const { t, locale } = useTranslation();
  const now = useNow();
  if (!isSuspended(until, now)) return null;
  return (
    <span className="px-2 py-0.5 rounded-md bg-danger/15 text-danger text-xs">
      {until === "infinity" ? t("admin.suspended_forever") : t("admin.suspended_until", { date: new Date(until!).toLocaleDateString(locale) })}
    </span>
  );
}

// ── Reportes ──────────────────────────────────────────────────────────────

function Reports() {
  const { t, locale } = useTranslation();
  const [status, setStatus] = useState<ReportStatus>("open");
  const [reports, setReports] = useState<ReportView[] | null>(null);
  const [version, setVersion] = useState(0);
  const { show, view } = useNotice();

  useEffect(() => {
    void adminCall("admin:reports", { status }).then((r) => setReports(r.ok ? r.reports : []));
  }, [status, version]);

  const act = async (promise: Promise<{ ok: boolean; error?: string }>, okKey: string) => {
    show(await promise, okKey);
    setVersion((v) => v + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["open", "resolved", "dismissed"] as ReportStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
            className={`px-3 py-1.5 rounded-lg text-sm cursor-pointer ${status === s ? "bg-primary/20 text-primary border border-primary/40" : "border border-border text-text-secondary"}`}
          >
            {t(`admin.status.${s}`)}
          </button>
        ))}
      </div>
      {view}
      {reports?.length === 0 && <p className="text-center text-text-muted py-10">{t("admin.no_reports")}</p>}
      <ul className="space-y-3">
        {reports?.map((r) => (
          <li key={r.id} className="bg-bg-surface border border-border rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-md bg-warning/15 text-warning font-semibold">{t(`report.reason.${r.reason}`)}</span>
              <span className="text-text-muted">{new Date(r.createdAt).toLocaleString(locale)}</span>
              {r.roomCode && <span className="text-text-muted font-mono">{r.roomCode}</span>}
            </div>
            <p className="text-sm">
              <span className="text-text-muted">{t("admin.reported")}: </span>
              {r.target ? (
                <>
                  <strong>{r.target.username ? `@${r.target.username}` : r.target.nickname}</strong>
                  {!r.target.userId && <span className="text-text-muted"> ({t("admin.guest")})</span>}{" "}
                  <SuspendedBadge until={r.target.suspendedUntil} />
                </>
              ) : (
                <strong>🧩 {r.item?.title ?? t("admin.deleted_item")}{r.item && !r.item.published && ` (${t("admin.hidden")})`}</strong>
              )}
              <span className="text-text-muted"> · {t("admin.by")} {r.reporter.username ? `@${r.reporter.username}` : `${r.reporter.nickname} (${t("admin.guest")})`}</span>
            </p>
            {r.details && <p className="text-sm text-text-secondary bg-bg-surface-light rounded-lg px-3 py-2">“{r.details}”</p>}
            {r.evidence.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-text-secondary">{t("admin.evidence", { n: r.evidence.length })}</summary>
                <ul className="mt-2 space-y-1 font-mono">
                  {r.evidence.map((m, i) => (
                    <li key={i} className={m.nickname === r.target?.nickname ? "text-warning" : "text-text-muted"}>
                      <strong>{m.nickname}:</strong> {m.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {r.resolution && <p className="text-xs text-text-muted">{t("admin.resolution")}: {r.resolution}</p>}
            {r.status === "open" && (
              <div className="flex flex-wrap gap-2 items-center pt-1 border-t border-border/50">
                {r.target?.userId && <SuspendButtons userId={r.target.userId} onDone={(res) => void act(Promise.resolve(res), "admin.suspended_ok")} />}
                {r.item && (
                  <>
                    {r.item.published && (
                      <button type="button" className="px-2 py-1 rounded-md text-xs border border-border cursor-pointer" onClick={() => void act(adminCall("admin:workshop", { itemId: r.item!.id, action: "hide" }), "admin.hidden_ok")}>
                        {t("admin.hide_item")}
                      </button>
                    )}
                    <button
                      type="button"
                      className="px-2 py-1 rounded-md text-xs border border-danger/40 text-danger cursor-pointer"
                      onClick={() => {
                        if (window.confirm(t("admin.delete_item_confirm"))) void act(adminCall("admin:workshop", { itemId: r.item!.id, action: "delete" }), "admin.deleted_ok");
                      }}
                    >
                      {t("admin.delete_item")}
                    </button>
                  </>
                )}
                <span className="flex-1" />
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-success/20 text-success cursor-pointer"
                  onClick={() => {
                    const resolution = window.prompt(t("admin.resolution_prompt")) ?? "";
                    void act(adminCall("admin:resolve", { id: r.id, status: "resolved", resolution }), "admin.resolved_ok");
                  }}
                >
                  {t("admin.resolve")}
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg text-xs border border-border cursor-pointer"
                  onClick={() => void act(adminCall("admin:resolve", { id: r.id, status: "dismissed" }), "admin.dismissed_ok")}
                >
                  {t("admin.dismiss")}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Usuarios ──────────────────────────────────────────────────────────────

function Users({ myId }: { myId: string }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUserView[] | null>(null);
  const now = useNow();
  const [version, setVersion] = useState(0);
  const { show, view } = useNotice();

  useEffect(() => {
    const id = setTimeout(() => void adminCall("admin:users", { query }).then((r) => setUsers(r.ok ? r.users : [])), 300);
    return () => clearTimeout(id);
  }, [query, version]);

  const act = async (promise: Promise<{ ok: boolean; error?: string }>, okKey: string) => {
    show(await promise, okKey);
    setVersion((v) => v + 1);
  };

  return (
    <div className="space-y-4">
      <input
        aria-label={t("admin.search")}
        placeholder={t("admin.search")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full bg-bg-surface-light border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
      />
      {view}
      <ul className="space-y-2">
        {users?.map((u) => {
          const suspended = isSuspended(u.suspendedUntil, now);
          return (
            <li key={u.userId} className="bg-bg-surface border border-border rounded-2xl p-3 flex flex-wrap items-center gap-3">
              <Avatar avatarId={u.avatarId} size="sm" />
              <span className="font-semibold">@{u.username}</span>
              {u.isAdmin && <span className="px-2 py-0.5 rounded-md bg-warning/15 text-warning text-xs">Admin</span>}
              <SuspendedBadge until={u.suspendedUntil} />
              <span className="flex-1" />
              {u.userId !== myId && (
                <>
                  {suspended ? (
                    <button type="button" className="px-2 py-1 rounded-md text-xs border border-border cursor-pointer" onClick={() => void act(adminCall("admin:unsuspend", { userId: u.userId }), "admin.unsuspended_ok")}>
                      {t("admin.unsuspend")}
                    </button>
                  ) : (
                    <SuspendButtons userId={u.userId} onDone={(res) => void act(Promise.resolve(res), "admin.suspended_ok")} />
                  )}
                  <button
                    type="button"
                    className="px-2 py-1 rounded-md text-xs border border-warning/40 text-warning cursor-pointer"
                    onClick={() => void act(adminCall("admin:set-admin", { userId: u.userId, isAdmin: !u.isAdmin }), u.isAdmin ? "admin.admin_removed" : "admin.admin_added")}
                  >
                    {u.isAdmin ? t("admin.remove_admin") : t("admin.make_admin")}
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
