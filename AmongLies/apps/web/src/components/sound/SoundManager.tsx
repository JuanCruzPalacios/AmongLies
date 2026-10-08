"use client";

import { useEffect } from "react";
import { configureSound, unlockAudio } from "@/lib/sound";
import { useSettingsStore } from "@/stores/settingsStore";

/** Aplica las preferencias de sonido y desbloquea el audio en la primera interacción. */
export function SoundManager() {
  const { sfxOn, sfxVolume, musicOn, musicVolume } = useSettingsStore();

  useEffect(() => {
    configureSound({ sfxOn, sfxVolume, musicOn, musicVolume });
  }, [sfxOn, sfxVolume, musicOn, musicVolume]);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return null;
}
