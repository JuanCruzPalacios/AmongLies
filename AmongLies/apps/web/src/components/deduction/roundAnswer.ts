import type { GameView } from "@amonglies/shared";

type AnyRoundResult = GameView["results"][number];

/** Segundos con una décima: 12300 → "12,3 s". */
export function formatSeconds(ms: number, locale: string): string {
  return `${(ms / 1000).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;
}

/** La "respuesta" de la ronda: la palabra secreta o el tiempo objetivo. */
export function roundAnswer(result: AnyRoundResult, locale: string): string {
  return "word" in result ? result.word : formatSeconds(result.targetMs, locale);
}

/** Clave de traducción para presentar la respuesta ("La palabra era" / "El tiempo era"). */
export function roundAnswerLabelKey(result: AnyRoundResult): string {
  return "word" in result ? "game.impostor.word_was" : "game.time.target_was";
}
