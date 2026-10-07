import type { Locale } from './common';

export interface Player {
  id: string;
  nickname: string;
  avatarId: string;
  locale: Locale;
  isAdmin: boolean;
  isConnected: boolean;
  /** false si entró con una cuenta (sesión de Supabase verificada por el servidor). */
  isGuest: boolean;
}

export interface GuestIdentity {
  nickname: string;
  avatarId: string;
  locale: Locale;
}
