import { Inject, Injectable } from '@nestjs/common';
import type { Locale, WorkshopError, WordList } from '@amonglies/shared';
import {
  WORKSHOP_REPOSITORY,
  WorkshopRepositoryError,
  type WorkshopRepository,
} from './workshop.repository.js';
import {
  canSee,
  sameContent,
  toWordList,
  validateDraft,
} from './workshop.rules.js';

export type WorkshopResult =
  | { ok: true; id?: string }
  | { ok: false; error: WorkshopError };

const fail = (error: WorkshopError): WorkshopResult => ({ ok: false, error });

/** Listas y presets de los jugadores: crear, editar, publicar, copiar y likes. */
@Injectable()
export class WorkshopService {
  constructor(
    @Inject(WORKSHOP_REPOSITORY) private readonly repo: WorkshopRepository,
  ) {}

  private async safely(
    fn: () => Promise<WorkshopResult>,
  ): Promise<WorkshopResult> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof WorkshopRepositoryError) return fail('unavailable');
      throw error;
    }
  }

  /** Crea un ítem (privado, en tu colección) o edita uno tuyo. */
  save(me: string, draft: unknown): Promise<WorkshopResult> {
    return this.safely(async () => {
      const valid = validateDraft(draft);
      if (!valid.ok) return valid;
      const { fields } = valid;
      const id = (draft as { id?: unknown }).id;

      if (id === undefined) {
        const newId = await this.repo.insert({
          ...fields,
          owner_id: me,
          version: 1,
          published: false,
          source_id: null,
          source_version: null,
          modified: false,
        });
        return { ok: true, id: newId };
      }

      if (typeof id !== 'string') return fail('invalid');
      const item = await this.repo.get(id);
      if (!item) return fail('not_found');
      if (item.owner_id !== me) return fail('not_owner');
      if (item.kind !== fields.kind) return fail('invalid');

      const changed = !sameContent(item.content, fields.content);
      await this.repo.update(id, {
        ...fields,
        // Las copias se enteran de que hay una versión nueva por este número.
        version: changed ? item.version + 1 : item.version,
        modified: item.modified || (item.source_id !== null && changed),
      });
      return { ok: true, id };
    });
  }

  publish(
    me: string,
    id: unknown,
    published: unknown,
  ): Promise<WorkshopResult> {
    return this.safely(async () => {
      const item = typeof id === 'string' ? await this.repo.get(id) : null;
      if (!item) return fail('not_found');
      if (item.owner_id !== me) return fail('not_owner');
      await this.repo.update(item.id, { published: published === true });
      return { ok: true, id: item.id };
    });
  }

  remove(me: string, id: unknown): Promise<WorkshopResult> {
    return this.safely(async () => {
      const item = typeof id === 'string' ? await this.repo.get(id) : null;
      if (!item) return fail('not_found');
      if (item.owner_id !== me) return fail('not_owner');
      await this.repo.delete(item.id);
      return { ok: true };
    });
  }

  /** Guarda en tu colección una copia de un ítem publicado (si ya la tenías, devuelve esa). */
  copy(me: string, id: unknown): Promise<WorkshopResult> {
    return this.safely(async () => {
      const item = typeof id === 'string' ? await this.repo.get(id) : null;
      if (!item || !canSee(item, me)) return fail('not_found');
      if (item.owner_id === me) return { ok: true, id: item.id };
      const existing = await this.repo.findCopy(me, item.id);
      if (existing) return { ok: true, id: existing.id };

      const newId = await this.repo.insert({
        owner_id: me,
        kind: item.kind,
        title: item.title,
        description: item.description,
        locale: item.locale,
        category: item.category,
        games: item.games,
        drawable: item.drawable,
        content: item.content,
        version: 1,
        published: false,
        source_id: item.id,
        source_version: item.version,
        modified: false,
      });
      return { ok: true, id: newId };
    });
  }

  /** Trae a tu copia la última versión del original. Pisa tus cambios. */
  updateCopy(me: string, id: unknown): Promise<WorkshopResult> {
    return this.safely(async () => {
      const copy = typeof id === 'string' ? await this.repo.get(id) : null;
      if (!copy) return fail('not_found');
      if (copy.owner_id !== me) return fail('not_owner');
      if (!copy.source_id) return fail('invalid');
      const source = await this.repo.get(copy.source_id);
      if (!source || !canSee(source, me)) return fail('not_found');

      await this.repo.update(copy.id, {
        title: source.title,
        description: source.description,
        locale: source.locale,
        category: source.category,
        games: source.games,
        drawable: source.drawable,
        content: source.content,
        version: copy.version + 1,
        source_version: source.version,
        modified: false,
      });
      return { ok: true, id: copy.id };
    });
  }

  like(me: string, id: unknown, like: unknown): Promise<WorkshopResult> {
    return this.safely(async () => {
      const item = typeof id === 'string' ? await this.repo.get(id) : null;
      if (!item || !item.published) return fail('not_found');
      await this.repo.setLike(me, item.id, like === true);
      return { ok: true, id: item.id };
    });
  }

  /**
   * Una lista del workshop para usar en una sala: tiene que ser una lista,
   * del idioma de la sala, y propia o publicada.
   */
  async wordListFor(
    me: string,
    id: string,
    locale: Locale,
  ): Promise<WordList | null> {
    try {
      const item = await this.repo.get(id);
      if (!item || !canSee(item, me) || item.locale !== locale) return null;
      return toWordList(item);
    } catch {
      return null;
    }
  }
}
