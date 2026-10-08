"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Preferencias de este navegador (sonido y avisos). Se guardan en localStorage. */
interface SettingsState {
  sfxOn: boolean;
  sfxVolume: number;
  musicOn: boolean;
  musicVolume: number;
  /** Avisos en pantalla de invitaciones y solicitudes de amistad. */
  showToasts: boolean;
  set: (changes: Partial<Omit<SettingsState, "set">>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      sfxOn: true,
      sfxVolume: 0.6,
      musicOn: false,
      musicVolume: 0.3,
      showToasts: true,
      set: (changes) => set(changes),
    }),
    { name: "amonglies-settings" },
  ),
);
