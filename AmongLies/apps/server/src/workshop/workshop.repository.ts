import { Injectable } from '@nestjs/common';
import type { WorkshopItem } from '@amonglies/shared';

export type NewItem = Omit<
  WorkshopItem,
  'id' | 'likes_count' | 'created_at' | 'updated_at'
>;

export interface WorkshopRepository {
  get(id: string): Promise<WorkshopItem | null>;
  insert(item: NewItem): Promise<string>;
  update(id: string, patch: Partial<WorkshopItem>): Promise<void>;
  delete(id: string): Promise<void>;
  /** La copia que `ownerId` ya tiene de `sourceId`, si existe. */
  findCopy(ownerId: string, sourceId: string): Promise<WorkshopItem | null>;
  setLike(userId: string, itemId: string, like: boolean): Promise<void>;
}

export const WORKSHOP_REPOSITORY = Symbol('WORKSHOP_REPOSITORY');

export class WorkshopRepositoryError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Supabase por REST con la clave secreta. */
@Injectable()
export class SupabaseWorkshopRepository implements WorkshopRepository {
  private readonly url = process.env.SUPABASE_URL;
  private readonly secretKey = process.env.SUPABASE_SECRET_KEY;

  private async request(path: string, init: RequestInit = {}) {
    if (!this.url || !this.secretKey)
      throw new WorkshopRepositoryError('Supabase no configurado');
    const response = await fetch(`${this.url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: this.secretKey,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
    // 409: el like ya existía (se ignora).
    if (!response.ok && response.status !== 409)
      throw new WorkshopRepositoryError(
        `${response.status} ${await response.text()}`,
      );
    return response;
  }

  async get(id: string): Promise<WorkshopItem | null> {
    if (!UUID.test(id)) return null;
    const res = await this.request(`workshop_items?id=eq.${id}&select=*`);
    const rows = (await res.json()) as WorkshopItem[];
    return rows[0] ?? null;
  }

  async insert(item: NewItem): Promise<string> {
    const res = await this.request('workshop_items?select=id', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(item),
    });
    const [row] = (await res.json()) as { id: string }[];
    return row.id;
  }

  async update(id: string, patch: Partial<WorkshopItem>): Promise<void> {
    await this.request(`workshop_items?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    });
  }

  async delete(id: string): Promise<void> {
    await this.request(`workshop_items?id=eq.${id}`, { method: 'DELETE' });
  }

  async findCopy(
    ownerId: string,
    sourceId: string,
  ): Promise<WorkshopItem | null> {
    const res = await this.request(
      `workshop_items?owner_id=eq.${ownerId}&source_id=eq.${sourceId}&select=*&limit=1`,
    );
    const rows = (await res.json()) as WorkshopItem[];
    return rows[0] ?? null;
  }

  async setLike(userId: string, itemId: string, like: boolean): Promise<void> {
    if (like) {
      await this.request('workshop_likes', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, item_id: itemId }),
      });
    } else {
      await this.request(
        `workshop_likes?user_id=eq.${userId}&item_id=eq.${itemId}`,
        { method: 'DELETE' },
      );
    }
  }
}
