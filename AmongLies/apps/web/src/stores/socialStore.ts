"use client";

import { create } from "zustand";
import type { FriendProfile, Presence, RoomInvite, SocialState } from "@amonglies/shared";

/** Aviso que aparece abajo a la derecha (invitación o solicitud de amistad). */
export type Toast =
  | { id: string; kind: "invite"; invite: RoomInvite }
  | { id: string; kind: "request"; from: FriendProfile };

interface SocialStore extends SocialState {
  loaded: boolean;
  toasts: Toast[];
  setState: (state: SocialState) => void;
  setPresence: (userId: string, presence: Presence) => void;
  pushToast: (toast: Toast) => void;
  dismissToast: (id: string) => void;
  reset: () => void;
}

const EMPTY: SocialState = { friends: [], incoming: [], outgoing: [] };

export const useSocialStore = create<SocialStore>((set) => ({
  ...EMPTY,
  loaded: false,
  toasts: [],
  setState: (state) => set({ ...state, loaded: true }),
  setPresence: (userId, presence) =>
    set((s) => ({ friends: s.friends.map((f) => (f.userId === userId ? { ...f, presence } : f)) })),
  pushToast: (toast) => set((s) => ({ toasts: [...s.toasts.filter((t) => t.id !== toast.id), toast].slice(-4) })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  reset: () => set({ ...EMPTY, loaded: false, toasts: [] }),
}));
