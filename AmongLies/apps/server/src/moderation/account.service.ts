import { Injectable } from '@nestjs/common';
import type { AdminUserView } from '@amonglies/shared';
import { isSuspendedAt } from './moderation.rules.js';
import { UUID, supabaseRest } from './supabase-rest.js';

export interface AccountFlags {
  isAdmin: boolean;
  suspendedUntil: string | null;
  suspensionReason: string | null;
  appearOffline: boolean;
  allowInvites: boolean;
}

interface ProfileRow {
  id: string;
  username: string;
  avatar_id: string;
  is_admin: boolean;
  suspended_until: string | null;
  suspension_reason: string | null;
  appear_offline: boolean;
  allow_invites: boolean;
}

const FIELDS =
  'id,username,avatar_id,is_admin,suspended_until,suspension_reason,appear_offline,allow_invites';

const DEFAULT_FLAGS: AccountFlags = {
  isAdmin: false,
  suspendedUntil: null,
  suspensionReason: null,
  appearOffline: false,
  allowInvites: true,
};

const toFlags = (row: ProfileRow): AccountFlags => ({
  isAdmin: row.is_admin,
  suspendedUntil: row.suspended_until,
  suspensionReason: row.suspension_reason,
  appearOffline: row.appear_offline,
  allowInvites: row.allow_invites,
});

const toAdminView = (row: ProfileRow): AdminUserView => ({
  userId: row.id,
  username: row.username,
  avatarId: row.avatar_id,
  isAdmin: row.is_admin,
  suspendedUntil: row.suspended_until,
  suspensionReason: row.suspension_reason,
});

/**
 * Marcas de cada cuenta (admin, suspensión, privacidad). Se guardan en memoria
 * para las cuentas conectadas y se vuelven a leer cuando cambian.
 */
@Injectable()
export class AccountService {
  private cache = new Map<string, AccountFlags>();
  private loading = new Map<string, Promise<AccountFlags>>();

  /** Lee las marcas de la base (y las deja en caché). Si falla, usa las por defecto. */
  load(userId: string): Promise<AccountFlags> {
    const promise = this.fetch(userId).finally(() => {
      if (this.loading.get(userId) === promise) this.loading.delete(userId);
    });
    this.loading.set(userId, promise);
    return promise;
  }

  /** Espera a que termine de cargar la cuenta, si se está cargando. */
  async ready(userId: string): Promise<void> {
    await this.loading.get(userId);
  }

  private async fetch(userId: string): Promise<AccountFlags> {
    try {
      const res = await supabaseRest(
        `profiles?id=eq.${userId}&select=${FIELDS}`,
      );
      const [row] = (await res.json()) as ProfileRow[];
      const flags = row ? toFlags(row) : DEFAULT_FLAGS;
      this.cache.set(userId, flags);
      return flags;
    } catch {
      return this.cache.get(userId) ?? DEFAULT_FLAGS;
    }
  }

  flags(userId: string): AccountFlags {
    return this.cache.get(userId) ?? DEFAULT_FLAGS;
  }

  isSuspended(userId: string | null | undefined): boolean {
    return (
      !!userId && isSuspendedAt(this.flags(userId).suspendedUntil, Date.now())
    );
  }

  /** Para acciones de admin se pregunta siempre a la base, no a la caché. */
  async isAdmin(userId: string): Promise<boolean> {
    try {
      const res = await supabaseRest(
        `profiles?id=eq.${userId}&select=is_admin`,
      );
      const [row] = (await res.json()) as { is_admin: boolean }[];
      return row?.is_admin === true;
    } catch {
      return false;
    }
  }

  async search(query: string): Promise<AdminUserView[]> {
    const q = query.trim().replace(/^@/, '');
    const filter = /^[A-Za-z0-9_]{1,20}$/.test(q)
      ? `username=ilike.${q}*&`
      : '';
    const res = await supabaseRest(
      `profiles?${filter}select=${FIELDS}&order=username&limit=30`,
    );
    return ((await res.json()) as ProfileRow[]).map(toAdminView);
  }

  async update(
    userId: string,
    patch: Partial<
      Pick<ProfileRow, 'is_admin' | 'suspended_until' | 'suspension_reason'>
    >,
  ): Promise<boolean> {
    if (!UUID.test(userId)) return false;
    const res = await supabaseRest(
      `profiles?id=eq.${userId}&select=${FIELDS}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(patch),
      },
    );
    const [row] = (await res.json()) as ProfileRow[];
    if (!row) return false;
    if (this.cache.has(userId)) this.cache.set(userId, toFlags(row));
    return true;
  }

  /** Borra la cuenta de Supabase Auth: el perfil y todo lo suyo se borra en cascada. */
  async deleteAccount(
    userId: string,
    confirmUsername: unknown,
  ): Promise<boolean> {
    if (!UUID.test(userId) || typeof confirmUsername !== 'string') return false;
    const res = await supabaseRest(`profiles?id=eq.${userId}&select=username`);
    const [row] = (await res.json()) as { username: string }[];
    if (
      !row ||
      row.username.toLowerCase() !== confirmUsername.trim().toLowerCase()
    )
      return false;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY!;
    const deleted = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!deleted.ok) throw new Error(`No se pudo borrar: ${deleted.status}`);
    this.forget(userId);
    return true;
  }

  forget(userId: string): void {
    this.cache.delete(userId);
  }
}
