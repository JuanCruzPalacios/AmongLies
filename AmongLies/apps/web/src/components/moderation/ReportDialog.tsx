"use client";

import { useState } from "react";
import { REPORT_REASONS, type ModerationError, type ReportReason } from "@amonglies/shared";
import { Button, Modal } from "@/components/ui";
import { getSocket, whenSessionReady } from "@/lib/socket";
import { useTranslation } from "@/hooks/useTranslation";

export type ReportTarget =
  | { kind: "player"; playerId: string; name: string }
  | { kind: "workshop_item"; itemId: string; name: string };

/** Reportar a un jugador de la sala o algo del workshop. */
export function ReportDialog({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  function close() {
    setReason(null);
    setDetails("");
    setResult(null);
    onClose();
  }

  function send() {
    if (!target || !reason) return;
    setSending(true);
    const base = { reason, details };
    const payload =
      target.kind === "player"
        ? { kind: "player" as const, playerId: target.playerId, ...base }
        : { kind: "workshop_item" as const, itemId: target.itemId, ...base };
    whenSessionReady(() =>
      getSocket()
        .timeout(10000)
        .emit("report:create", payload, (err: unknown, res?: { ok: boolean; error?: ModerationError }) => {
          setSending(false);
          if (err || !res) setResult({ ok: false, text: t("report.error.unavailable") });
          else setResult(res.ok ? { ok: true, text: t("report.sent") } : { ok: false, text: t(`report.error.${res.error}`) });
        }),
    );
  }

  return (
    <Modal isOpen={target !== null} onClose={close} title={t("report.title", { name: target?.name ?? "" })}>
      {result?.ok ? (
        <div className="space-y-4 text-center">
          <p role="status" className="text-success">{result.text}</p>
          <Button className="w-full" onClick={close}>{t("report.close")}</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm text-text-secondary mb-2">{t("report.reason")}</legend>
            {REPORT_REASONS.filter((r) => target?.kind === "player" || r !== "cheating").map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="report-reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-primary" />
                {t(`report.reason.${r}`)}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="report-details" className="text-sm text-text-secondary">{t("report.details")}</label>
            <textarea
              id="report-details"
              rows={3}
              maxLength={300}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="bg-bg-surface-light border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          {target?.kind === "player" && <p className="text-xs text-text-muted">{t("report.evidence_hint")}</p>}
          {result && !result.ok && <p role="alert" className="text-sm text-danger">{result.text}</p>}
          <Button className="w-full" variant="danger" disabled={!reason || sending} isLoading={sending} onClick={send}>
            {t("report.send")}
          </Button>
        </div>
      )}
    </Modal>
  );
}
