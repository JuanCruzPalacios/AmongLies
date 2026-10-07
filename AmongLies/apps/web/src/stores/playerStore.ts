"use client";

import { create } from "zustand";
import { isLocale, type Locale } from "@amonglies/shared";

interface PlayerState {
  nickname: string;
  avatarId: string;
  locale: Locale;
  playerId: string | null;
  setNickname: (nickname: string) => void;
  setAvatarId: (avatarId: string) => void;
  setLocale: (locale: Locale) => void;
  setPlayerId: (id: string) => void;
  loadFromStorage: () => void;
  saveToStorage: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  nickname: "",
  avatarId: "fox",
  locale: "es",
  playerId: null,

  setNickname: (nickname) => {
    set({ nickname });
    get().saveToStorage();
  },

  setAvatarId: (avatarId) => {
    set({ avatarId });
    get().saveToStorage();
  },

  setLocale: (locale) => {
    set({ locale });
    get().saveToStorage();
  },

  setPlayerId: (playerId) => set({ playerId }),

  loadFromStorage: () => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("amonglies-player");
      if (saved) {
        const data = JSON.parse(saved);
        set({
          nickname: data.nickname || "",
          avatarId: data.avatarId || "fox",
          locale: isLocale(data.locale) ? data.locale : "es",
        });
      } else {
        const browserLang = navigator.language.slice(0, 2);
        const locale: Locale = isLocale(browserLang) ? browserLang : "en";
        set({ locale });
      }
    } catch {
      // ignore
    }
  },

  saveToStorage: () => {
    if (typeof window === "undefined") return;
    const { nickname, avatarId, locale } = get();
    localStorage.setItem(
      "amonglies-player",
      JSON.stringify({ nickname, avatarId, locale })
    );
  },
}));
