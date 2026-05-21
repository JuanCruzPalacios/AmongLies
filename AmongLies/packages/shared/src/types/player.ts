import type { Locale } from './common';

export interface Player {
  id: string;
  nickname: string;
  avatarId: string;
  locale: Locale;
  isAdmin: boolean;
  isConnected: boolean;
}

export interface GuestIdentity {
  nickname: string;
  avatarId: string;
  locale: Locale;
}
