"use client";

import { create } from "zustand";
import type { Locale } from "@amonglies/shared";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getSocket, setAccessToken } from "@/lib/socket";
import { usePlayerStore } from "@/stores/playerStore";

export interface Profile {
  id: string;
  username: string;
  avatar_id: string;
  locale: Locale;
  is_admin: boolean;
  appear_offline: boolean;
  allow_invites: boolean;
}

export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

interface AuthState {
  /** true cuando ya se sabe si hay sesión o no. */
  ready: boolean;
  user: User | null;
  profile: Profile | null;
  init: () => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (data: {
    email: string;
    password: string;
    username: string;
    avatarId: string;
    locale: Locale;
  }) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
  isUsernameTaken: (username: string) => Promise<boolean>;
  updateProfile: (
    changes: Partial<Pick<Profile, "avatar_id" | "locale" | "appear_offline" | "allow_invites">>,
  ) => Promise<void>;
}

let initialized = false;

/** Códigos de error de Supabase Auth que mostramos traducidos (auth.error.*). */
function errorCode(error: { code?: string; message: string } | null): string | null {
  if (!error) return null;
  return error.code ?? "unexpected_failure";
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ready: false,
  user: null,
  profile: null,

  init: () => {
    if (initialized) return;
    initialized = true;

    supabase.auth.onAuthStateChange((_event, session) => {
      const previousUserId = get().user?.id ?? null;
      const user = session?.user ?? null;
      set({ user, ready: true });
      // Sólo reconecta el socket si cambió el usuario (login/logout), no al refrescar el token.
      setAccessToken(session?.access_token ?? null, previousUserId !== (user?.id ?? null));

      if (!user) {
        set({ profile: null });
        return;
      }
      if (get().profile?.id === user.id) return;
      // Fuera del callback: supabase-js no recomienda llamar a la API adentro.
      setTimeout(async () => {
        const { data } = await supabase
          .from("profiles")
          .select("id, username, avatar_id, locale, is_admin, appear_offline, allow_invites")
          .eq("id", user.id)
          .maybeSingle();
        if (!data) return;
        set({ profile: data as Profile });
        // El apodo y el avatar de la cuenta se usan al entrar a las salas.
        const player = usePlayerStore.getState();
        player.setNickname(data.username);
        player.setAvatarId(data.avatar_id);
      }, 0);
    });
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return errorCode(error);
  },

  signUp: async ({ email, password, username, avatarId, locale }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, avatar_id: avatarId, locale },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    return { error: errorCode(error), needsConfirmation: !error && !data.session };
  },

  signOut: async () => {
    await supabase.auth.signOut();
  },

  requestPasswordReset: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nueva-contrasena`,
    });
    return errorCode(error);
  },

  updatePassword: async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    return errorCode(error);
  },

  isUsernameTaken: async (username) => {
    const { data } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
    return data !== null;
  },

  updateProfile: async (changes) => {
    const profile = get().profile;
    if (!profile) return;
    set({ profile: { ...profile, ...changes } });
    await supabase.from("profiles").update(changes).eq("id", profile.id);
    // El servidor guarda en memoria la privacidad de las cuentas conectadas.
    if ("appear_offline" in changes || "allow_invites" in changes) getSocket().emit("account:refresh");
  },
}));
