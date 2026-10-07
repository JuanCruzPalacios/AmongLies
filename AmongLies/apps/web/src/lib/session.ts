"use client";

const STORAGE_KEY = "amonglies-session";
let memoryToken: string | null = null;

function randomToken(): string {
  // crypto.randomUUID sólo existe en contextos seguros (https o localhost).
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Token secreto que identifica a este jugador invitado entre reconexiones.
 * Vive en sessionStorage: sobrevive a recargar la página y cada pestaña es
 * un jugador distinto.
 */
export function getSessionToken(): string {
  try {
    let token = sessionStorage.getItem(STORAGE_KEY);
    if (!token) {
      token = randomToken();
      sessionStorage.setItem(STORAGE_KEY, token);
    }
    return token;
  } catch {
    memoryToken ??= randomToken();
    return memoryToken;
  }
}
