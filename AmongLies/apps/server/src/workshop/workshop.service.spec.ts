import type { WorkshopItem } from '@amonglies/shared';
import {
  WorkshopRepositoryError,
  type NewItem,
  type WorkshopRepository,
} from './workshop.repository.js';
import { WorkshopService } from './workshop.service.js';

class MemoryRepository implements WorkshopRepository {
  items = new Map<string, WorkshopItem>();
  likes = new Set<string>();
  failing = false;
  private next = 1;

  get(id: string) {
    if (this.failing) throw new WorkshopRepositoryError('caída');
    return Promise.resolve(this.items.get(id) ?? null);
  }
  insert(item: NewItem) {
    const id = `item${this.next++}`;
    this.items.set(id, {
      ...item,
      id,
      likes_count: 0,
      created_at: '',
      updated_at: '',
    });
    return Promise.resolve(id);
  }
  update(id: string, patch: Partial<WorkshopItem>) {
    const item = this.items.get(id)!;
    this.items.set(id, { ...item, ...patch });
    return Promise.resolve();
  }
  delete(id: string) {
    this.items.delete(id);
    return Promise.resolve();
  }
  findCopy(owner: string, source: string) {
    return Promise.resolve(
      [...this.items.values()].find(
        (i) => i.owner_id === owner && i.source_id === source,
      ) ?? null,
    );
  }
  setLike(user: string, item: string, like: boolean) {
    const key = `${user}:${item}`;
    const had = this.likes.has(key);
    if (like && !had) this.likes.add(key);
    if (!like && had) this.likes.delete(key);
    const target = this.items.get(item)!;
    target.likes_count = [...this.likes].filter((k) =>
      k.endsWith(`:${item}`),
    ).length;
    return Promise.resolve();
  }
}

const words = (prefix: string) =>
  Array.from({ length: 10 }, (_, i) => `${prefix}${i}`);
const draft = (overrides: Record<string, unknown> = {}) => ({
  kind: 'word_list',
  title: 'Animales raros',
  locale: 'es',
  category: 'animals',
  drawable: true,
  words: words('bicho'),
  ...overrides,
});

async function setup() {
  const repo = new MemoryRepository();
  const workshop = new WorkshopService(repo);
  const created = await workshop.save('ana', draft());
  if (!created.ok || !created.id) throw new Error('no se creó');
  return { repo, workshop, id: created.id };
}

describe('WorkshopService — crear y editar', () => {
  it('lo nuevo queda privado, en la colección del autor, versión 1', async () => {
    const { repo, id } = await setup();
    expect(repo.items.get(id)).toMatchObject({
      owner_id: 'ana',
      published: false,
      version: 1,
      source_id: null,
      games: ['impostor', 'drawing'],
    });
  });

  it('editar el contenido sube la versión; sólo el título, no', async () => {
    const { repo, workshop, id } = await setup();
    await workshop.save('ana', draft({ id, title: 'Animales rarísimos' }));
    expect(repo.items.get(id)!.version).toBe(1);
    await workshop.save('ana', draft({ id, words: words('otro') }));
    expect(repo.items.get(id)!.version).toBe(2);
  });

  it('sólo el dueño edita, publica o borra', async () => {
    const { workshop, id } = await setup();
    const notOwner = { ok: false, error: 'not_owner' };
    expect(await workshop.save('beto', draft({ id }))).toEqual(notOwner);
    expect(await workshop.publish('beto', id, true)).toEqual(notOwner);
    expect(await workshop.remove('beto', id)).toEqual(notOwner);
  });

  it('no se puede cambiar una lista por un preset', async () => {
    const { workshop, id } = await setup();
    expect(
      await workshop.save('ana', {
        id,
        kind: 'preset',
        title: 'Otra cosa',
        gameId: 'impostor',
      }),
    ).toEqual({ ok: false, error: 'invalid' });
  });

  it('ids inexistentes o que no son texto', async () => {
    const { workshop } = await setup();
    const notFound = { ok: false, error: 'not_found' };
    expect(await workshop.save('ana', draft({ id: 'nope' }))).toEqual(notFound);
    expect(await workshop.save('ana', draft({ id: 7 }))).toEqual({
      ok: false,
      error: 'invalid',
    });
    expect(await workshop.publish('ana', null, true)).toEqual(notFound);
    expect(await workshop.remove('ana', 'nope')).toEqual(notFound);
  });
});

describe('WorkshopService — copias', () => {
  it('no se puede copiar algo privado de otro', async () => {
    const { workshop, id } = await setup();
    expect(await workshop.copy('beto', id)).toEqual({
      ok: false,
      error: 'not_found',
    });
  });

  it('copiar lo publicado guarda una copia privada que recuerda su origen', async () => {
    const { repo, workshop, id } = await setup();
    await workshop.publish('ana', id, true);
    const copy = await workshop.copy('beto', id);
    if (!copy.ok || !copy.id) throw new Error('no se copió');
    expect(repo.items.get(copy.id)).toMatchObject({
      owner_id: 'beto',
      published: false,
      source_id: id,
      source_version: 1,
      modified: false,
      content: { words: words('bicho') },
    });
  });

  it('copiar dos veces devuelve la misma copia; copiar lo propio, el original', async () => {
    const { workshop, id } = await setup();
    await workshop.publish('ana', id, true);
    const first = await workshop.copy('beto', id);
    expect(await workshop.copy('beto', id)).toEqual(first);
    expect(await workshop.copy('ana', id)).toEqual({ ok: true, id });
  });

  it('el autor edita → la copia queda vieja; actualizar trae lo nuevo y pisa los cambios', async () => {
    const { repo, workshop, id } = await setup();
    await workshop.publish('ana', id, true);
    const copy = await workshop.copy('beto', id);
    const copyId = (copy as { id: string }).id;

    // Beto edita su copia: queda marcada como modificada.
    await workshop.save('beto', draft({ id: copyId, words: words('mio') }));
    expect(repo.items.get(copyId)!.modified).toBe(true);

    // Ana saca una versión nueva.
    await workshop.save('ana', draft({ id, words: words('nuevo') }));
    expect(repo.items.get(id)!.version).toBe(2);
    expect(repo.items.get(copyId)!.source_version).toBe(1);

    expect(await workshop.updateCopy('beto', copyId)).toEqual({
      ok: true,
      id: copyId,
    });
    expect(repo.items.get(copyId)).toMatchObject({
      source_version: 2,
      modified: false,
      content: { words: words('nuevo') },
    });
  });

  it('no se puede actualizar algo que no es copia, ni si el original se despublicó', async () => {
    const { workshop, id } = await setup();
    expect(await workshop.updateCopy('ana', id)).toEqual({
      ok: false,
      error: 'invalid',
    });
    await workshop.publish('ana', id, true);
    const copy = (await workshop.copy('beto', id)) as { id: string };
    await workshop.publish('ana', id, false);
    expect(await workshop.updateCopy('beto', copy.id)).toEqual({
      ok: false,
      error: 'not_found',
    });
    expect(await workshop.updateCopy('ana', copy.id)).toEqual({
      ok: false,
      error: 'not_owner',
    });
  });
});

describe('WorkshopService — likes y uso en salas', () => {
  it('like y unlike, sin contar dos veces', async () => {
    const { repo, workshop, id } = await setup();
    expect(await workshop.like('beto', id, true)).toEqual({
      ok: false,
      error: 'not_found',
    });
    await workshop.publish('ana', id, true);
    await workshop.like('beto', id, true);
    await workshop.like('beto', id, true);
    await workshop.like('caro', id, true);
    expect(repo.items.get(id)!.likes_count).toBe(2);
    await workshop.like('beto', id, false);
    expect(repo.items.get(id)!.likes_count).toBe(1);
  });

  it('una lista se usa en una sala si es propia o publicada y del idioma de la sala', async () => {
    const { workshop, id } = await setup();
    expect(await workshop.wordListFor('ana', id, 'es')).toEqual({
      id,
      locale: 'es',
      category: { es: 'Animales raros', en: 'Animales raros' },
      drawable: true,
      words: words('bicho'),
    });
    expect(await workshop.wordListFor('ana', id, 'en')).toBeNull();
    expect(await workshop.wordListFor('beto', id, 'es')).toBeNull();
    await workshop.publish('ana', id, true);
    expect(await workshop.wordListFor('beto', id, 'es')).not.toBeNull();
  });

  it('un preset no sirve como lista de palabras', async () => {
    const { workshop } = await setup();
    const preset = await workshop.save('ana', {
      kind: 'preset',
      title: 'Rápido',
      gameId: 'impostor',
      settings: {},
    });
    expect(
      await workshop.wordListFor('ana', (preset as { id: string }).id, 'es'),
    ).toBeNull();
  });

  it('si la base no responde: "unavailable" o null, sin romper', async () => {
    const { repo, workshop, id } = await setup();
    repo.failing = true;
    expect(await workshop.publish('ana', id, true)).toEqual({
      ok: false,
      error: 'unavailable',
    });
    expect(await workshop.wordListFor('ana', id, 'es')).toBeNull();
  });
});
