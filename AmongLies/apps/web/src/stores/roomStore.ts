"use client";

import { create } from "zustand";
import type { Room, Player, ChatMessage } from "@amonglies/shared";

interface RoomState {
  room: Room | null;
  isConnecting: boolean;
  error: string | null;
  setRoom: (room: Room | null) => void;
  setConnecting: (connecting: boolean) => void;
  setError: (error: string | null) => void;
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string, newAdminId?: string) => void;
  addChatMessage: (message: ChatMessage) => void;
  updatePlayerConnection: (playerId: string, isConnected: boolean) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  room: null,
  isConnecting: false,
  error: null,

  setRoom: (room) => set({ room, error: null }),
  setConnecting: (isConnecting) => set({ isConnecting }),
  setError: (error) => set({ error }),

  addPlayer: (player) =>
    set((state) => {
      if (!state.room) return state;
      return {
        room: { ...state.room, players: [...state.room.players, player] },
      };
    }),

  removePlayer: (playerId, newAdminId) =>
    set((state) => {
      if (!state.room) return state;
      const players = state.room.players.filter((p) => p.id !== playerId);
      if (newAdminId) {
        const idx = players.findIndex((p) => p.id === newAdminId);
        if (idx !== -1) players[idx] = { ...players[idx], isAdmin: true };
      }
      return {
        room: {
          ...state.room,
          players,
          adminId: newAdminId || state.room.adminId,
        },
      };
    }),

  addChatMessage: (message) =>
    set((state) => {
      if (!state.room) return state;
      return {
        room: { ...state.room, chat: [...state.room.chat, message] },
      };
    }),

  updatePlayerConnection: (playerId, isConnected) =>
    set((state) => {
      if (!state.room) return state;
      return {
        room: {
          ...state.room,
          players: state.room.players.map((p) =>
            p.id === playerId ? { ...p, isConnected } : p
          ),
        },
      };
    }),
}));
