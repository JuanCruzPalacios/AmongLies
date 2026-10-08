import { Injectable } from '@nestjs/common';
import type { FriendProfile } from '@amonglies/shared';
import type { FriendshipRow } from './social.rules.js';

/** Acceso a perfiles y amistades. Se inyecta para poder probar el servicio sin la base. */
export interface FriendshipRepository {
  findByUsername(username: string): Promise<FriendProfile | null>;
  getProfiles(userIds: string[]): Promise<FriendProfile[]>;
  search(prefix: string, excludeUserId: string): Promise<FriendProfile[]>;
  listFor(userId: string): Promise<FriendshipRow[]>;
  /** false si ya existía un vínculo entre los dos (carrera entre dos pedidos). */
  insert(requesterId: string, addresseeId: string): Promise<boolean>;
  accept(requesterId: string, addresseeId: string): Promise<void>;
  remove(a: string, b: string): Promise<void>;
}

export const FRIENDSHIP_REPOSITORY = Symbol('FRIENDSHIP_REPOSITORY');

export class RepositoryError extends Error {}

interface ProfileRow {
  id: string;
  username: string;
  avatar_id: string;
}

const toProfile = (row: ProfileRow): FriendProfile => ({
  userId: row.id,
  username: row.username,
  avatarId: row.avatar_id,
});

const PROFILE_FIELDS = 'select=id,username,avatar_id';

/** Supabase por REST con la clave secreta (las tablas sólo se escriben desde acá). */
@Injectable()
export class SupabaseFriendshipRepository implements FriendshipRepository {
  private readonly url = process.env.SUPABASE_URL;
  private readonly secretKey = process.env.SUPABASE_SECRET_KEY;

  private async request(
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    if (!this.url || !this.secretKey)
      throw new RepositoryError('Supabase no configurado');
    const response = await fetch(`${this.url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: this.secretKey,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
    if (!response.ok && response.status !== 409)
      throw new RepositoryError(`${response.status} ${await response.text()}`);
    return response;
  }

  async findByUsername(username: string): Promise<FriendProfile | null> {
    const res = await this.request(
      `profiles?username=eq.${encodeURIComponent(username)}&${PROFILE_FIELDS}`,
    );
    const rows = (await res.json()) as ProfileRow[];
    return rows[0] ? toProfile(rows[0]) : null;
  }

  async getProfiles(userIds: string[]): Promise<FriendProfile[]> {
    if (userIds.length === 0) return [];
    const res = await this.request(
      `profiles?id=in.(${userIds.join(',')})&${PROFILE_FIELDS}`,
    );
    return ((await res.json()) as ProfileRow[]).map(toProfile);
  }

  async search(
    prefix: string,
    excludeUserId: string,
  ): Promise<FriendProfile[]> {
    const res = await this.request(
      `profiles?username=ilike.${encodeURIComponent(prefix)}*&id=neq.${excludeUserId}&${PROFILE_FIELDS}&order=username&limit=8`,
    );
    return ((await res.json()) as ProfileRow[]).map(toProfile);
  }

  async listFor(userId: string): Promise<FriendshipRow[]> {
    const res = await this.request(
      `friendships?or=(requester_id.eq.${userId},addressee_id.eq.${userId})&select=requester_id,addressee_id,status`,
    );
    return (await res.json()) as FriendshipRow[];
  }

  async insert(requesterId: string, addresseeId: string): Promise<boolean> {
    const res = await this.request('friendships', {
      method: 'POST',
      body: JSON.stringify({
        requester_id: requesterId,
        addressee_id: addresseeId,
      }),
    });
    return res.status !== 409;
  }

  async accept(requesterId: string, addresseeId: string): Promise<void> {
    await this.request(
      `friendships?requester_id=eq.${requesterId}&addressee_id=eq.${addresseeId}&status=eq.pending`,
      { method: 'PATCH', body: JSON.stringify({ status: 'accepted' }) },
    );
  }

  async remove(a: string, b: string): Promise<void> {
    await this.request(
      `friendships?or=(and(requester_id.eq.${a},addressee_id.eq.${b}),and(requester_id.eq.${b},addressee_id.eq.${a}))`,
      { method: 'DELETE' },
    );
  }
}
