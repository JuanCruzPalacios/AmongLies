"use client";

import { useCallback } from "react";
import { usePlayerStore } from "@/stores/playerStore";
import { t } from "@/lib/i18n";

export function useTranslation() {
  const locale = usePlayerStore((s) => s.locale);

  const translate = useCallback(
    (key: string, params?: Record<string, string | number>, fallback?: string) =>
      t(key, locale, params, fallback),
    [locale]
  );

  return { t: translate, locale };
}
