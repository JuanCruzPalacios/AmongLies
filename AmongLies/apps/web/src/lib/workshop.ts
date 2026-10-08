"use client";

import type { GameId, WorkshopAck, WorkshopDraft, WorkshopItem, WorkshopKind } from "@amonglies/shared";
import { supabase } from "./supabase";
import { getSocket, whenSessionReady } from "./socket";

/** Un ítem con el nombre de su autor. */
export interface WorkshopRow extends WorkshopItem {
  owner: { username: string } | null;
}

export type WorkshopSort = "likes" | "new";

export interface WorkshopFilters {
  query: string;
  kind: WorkshopKind | "";
  locale: "es" | "en" | "";
  game: GameId | "";
  category: string;
  sort: WorkshopSort;
}

const SELECT = "*, owner:profiles!workshop_items_owner_id_fkey(username)";

/** Lo publicado, con filtros. Lo lee cualquiera (también sin cuenta). */
export async function browseWorkshop(filters: WorkshopFilters): Promise<WorkshopRow[]> {
  let q = supabase.from("workshop_items").select(SELECT).eq("published", true);
  const text = filters.query.trim().replace(/[%_,()*]/g, "");
  if (text) q = q.ilike("title", `%${text}%`);
  if (filters.kind) q = q.eq("kind", filters.kind);
  // Los presets no tienen idioma: se muestran igual al filtrar por idioma.
  if (filters.locale) q = q.or(`locale.eq.${filters.locale},locale.is.null`);
  if (filters.game) q = q.contains("games", [filters.game]);
  if (filters.category) q = q.eq("category", filters.category);
  q =
    filters.sort === "likes"
      ? q.order("likes_count", { ascending: false }).order("created_at", { ascending: false })
      : q.order("created_at", { ascending: false });
  const { data } = await q.limit(60);
  return (data as WorkshopRow[] | null) ?? [];
}

/** Tu colección: lo que creaste y las copias que guardaste. */
export async function myWorkshopItems(userId: string): Promise<WorkshopRow[]> {
  const { data } = await supabase
    .from("workshop_items")
    .select(SELECT)
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });
  return (data as WorkshopRow[] | null) ?? [];
}

export async function myLikes(userId: string): Promise<Set<string>> {
  const { data } = await supabase.from("workshop_likes").select("item_id").eq("user_id", userId);
  return new Set((data ?? []).map((row: { item_id: string }) => row.item_id));
}

/**
 * Versión actual de los originales de tus copias. Si un original ya no se ve
 * (lo despublicaron o borraron) no aparece: la copia sigue andando igual.
 */
export async function sourceVersions(sourceIds: string[]): Promise<Map<string, number>> {
  if (sourceIds.length === 0) return new Map();
  const { data } = await supabase.from("workshop_items").select("id, version").in("id", sourceIds);
  return new Map((data ?? []).map((row: { id: string; version: number }) => [row.id, row.version]));
}

export async function getWorkshopItem(id: string): Promise<WorkshopRow | null> {
  const { data } = await supabase.from("workshop_items").select(SELECT).eq("id", id).maybeSingle();
  return (data as WorkshopRow | null) ?? null;
}

type AckResult = Parameters<WorkshopAck>[0];

/** Escrituras: pasan por el servidor, que valida todo. */
function call<E extends "workshop:save" | "workshop:publish" | "workshop:delete" | "workshop:copy" | "workshop:update-copy" | "workshop:like">(
  event: E,
  data: E extends "workshop:save" ? WorkshopDraft : E extends "workshop:publish" ? { id: string; published: boolean } : E extends "workshop:like" ? { id: string; like: boolean } : { id: string },
): Promise<AckResult> {
  return new Promise((resolve) => {
    // Se espera a que el servidor haya identificado la cuenta (si no, te trataría como invitado).
    whenSessionReady(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (getSocket().timeout(10000) as any).emit(event, data, (err: unknown, result: AckResult) =>
        resolve(err ? { ok: false, error: "unavailable" } : result),
      );
    });
  });
}

export const workshopApi = {
  save: (draft: WorkshopDraft) => call("workshop:save", draft),
  publish: (id: string, published: boolean) => call("workshop:publish", { id, published }),
  remove: (id: string) => call("workshop:delete", { id }),
  copy: (id: string) => call("workshop:copy", { id }),
  updateCopy: (id: string) => call("workshop:update-copy", { id }),
  like: (id: string, like: boolean) => call("workshop:like", { id, like }),
};
