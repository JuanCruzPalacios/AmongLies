import { Inject, Injectable } from '@nestjs/common';
import type {
  FriendProfile,
  Presence,
  SocialError,
  SocialState,
} from '@amonglies/shared';
import {
  FRIENDSHIP_REPOSITORY,
  RepositoryError,
  type FriendshipRepository,
} from './friendship.repository.js';
import {
  relationWith,
  sanitizeSearch,
  splitRelations,
} from './social.rules.js';

export type Result<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: SocialError };

const fail = (error: SocialError): { ok: false; error: SocialError } => ({
  ok: false,
  error,
});

/** Amistades entre cuentas: solicitudes que el otro acepta o rechaza. */
@Injectable()
export class SocialService {
  constructor(
    @Inject(FRIENDSHIP_REPOSITORY)
    private readonly repo: FriendshipRepository,
  ) {}

  /** Si la base falla, se responde "no disponible" en vez de romper el socket. */
  private async safely<T>(fn: () => Promise<Result<T>>): Promise<Result<T>> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof RepositoryError) return fail('unavailable');
      throw error;
    }
  }

  /**
   * Manda una solicitud. Si el otro ya te había mandado una, se aceptan las dos
   * (son amigos directamente).
   */
  request(
    me: string,
    username: unknown,
  ): Promise<Result<{ target: FriendProfile; accepted: boolean }>> {
    return this.safely(async () => {
      const name = sanitizeSearch(username);
      const target = name ? await this.repo.findByUsername(name) : null;
      if (!target) return fail('user_not_found');
      if (target.userId === me) return fail('self');

      const relation = relationWith(
        await this.repo.listFor(me),
        me,
        target.userId,
      );
      if (relation === 'friends') return fail('already_friends');
      if (relation === 'outgoing') return fail('already_requested');
      if (relation === 'incoming') {
        await this.repo.accept(target.userId, me);
        return { ok: true, target, accepted: true };
      }
      const created = await this.repo.insert(me, target.userId);
      if (!created) return fail('already_requested');
      return { ok: true, target, accepted: false };
    });
  }

  /** Acepta o rechaza una solicitud recibida. */
  respond(
    me: string,
    otherId: unknown,
    accept: unknown,
  ): Promise<Result<{ accepted: boolean }>> {
    return this.safely(async () => {
      if (typeof otherId !== 'string') return fail('user_not_found');
      const relation = relationWith(await this.repo.listFor(me), me, otherId);
      if (relation !== 'incoming') return fail('user_not_found');
      if (accept === true) {
        await this.repo.accept(otherId, me);
        return { ok: true, accepted: true };
      }
      await this.repo.remove(me, otherId);
      return { ok: true, accepted: false };
    });
  }

  /** Elimina a un amigo o cancela una solicitud enviada. */
  remove(me: string, otherId: unknown): Promise<Result> {
    return this.safely(async () => {
      if (typeof otherId !== 'string') return fail('not_friends');
      const relation = relationWith(await this.repo.listFor(me), me, otherId);
      if (relation !== 'friends' && relation !== 'outgoing')
        return fail('not_friends');
      await this.repo.remove(me, otherId);
      return { ok: true };
    });
  }

  async friendIds(me: string): Promise<string[]> {
    return splitRelations(await this.repo.listFor(me), me).friends;
  }

  /** Amigos (con su presencia) y solicitudes de `me`. */
  async state(
    me: string,
    presence: (userId: string) => Presence,
  ): Promise<SocialState> {
    const { friends, incoming, outgoing } = splitRelations(
      await this.repo.listFor(me),
      me,
    );
    const profiles = await this.repo.getProfiles([
      ...friends,
      ...incoming,
      ...outgoing,
    ]);
    const byId = (ids: string[]) =>
      ids
        .map((id) => profiles.find((p) => p.userId === id))
        .filter((p): p is FriendProfile => p !== undefined)
        .sort((a, b) => a.username.localeCompare(b.username));
    return {
      friends: byId(friends).map((p) => ({
        ...p,
        presence: presence(p.userId),
      })),
      incoming: byId(incoming),
      outgoing: byId(outgoing),
    };
  }

  async search(me: string, query: unknown): Promise<FriendProfile[]> {
    const prefix = sanitizeSearch(query);
    if (!prefix) return [];
    try {
      return await this.repo.search(prefix, me);
    } catch {
      return [];
    }
  }

  async profile(userId: string): Promise<FriendProfile | null> {
    const [profile] = await this.repo.getProfiles([userId]);
    return profile ?? null;
  }
}
