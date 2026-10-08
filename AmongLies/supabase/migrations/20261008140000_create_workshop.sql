-- Workshop: listas de palabras y presets de reglas creados por los jugadores.
-- Una fila por ítem: los propios, las copias descargadas y lo publicado.
-- Sólo escribe el servidor (con la clave secreta); acá sólo hay políticas de lectura.
create table public.workshop_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('word_list', 'preset')),
  title text not null check (char_length(title) between 3 and 40),
  description text not null default '' check (char_length(description) <= 200),
  -- Idioma de las palabras (los presets no tienen).
  locale text check (locale in ('es', 'en')),
  category text,
  -- Juegos compatibles (los calcula el servidor): sirve para filtrar.
  games text[] not null default '{}',
  drawable boolean not null default false,
  -- { "words": [...] } o { "gameId": "...", "settings": {...} }
  content jsonb not null,
  -- Sube cada vez que cambia el contenido: así una copia sabe si quedó vieja.
  version integer not null default 1,
  published boolean not null default false,
  -- Si es una copia: de dónde salió y qué versión se copió.
  source_id uuid references public.workshop_items (id) on delete set null,
  source_version integer,
  -- La copia fue editada por su dueño (actualizarla pisa esos cambios).
  modified boolean not null default false,
  likes_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.workshop_items is 'Listas de palabras y presets del workshop. Las escribe sólo el servidor.';

create index workshop_items_owner_idx on public.workshop_items (owner_id);
create index workshop_items_source_idx on public.workshop_items (source_id);
create index workshop_items_published_idx on public.workshop_items (published, created_at desc);

create table public.workshop_likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid not null references public.workshop_items (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create index workshop_likes_item_idx on public.workshop_likes (item_id);

alter table public.workshop_items enable row level security;
alter table public.workshop_likes enable row level security;

create policy "Lo publicado es público; lo propio lo ve su dueño"
  on public.workshop_items for select
  to anon, authenticated
  using (published or (select auth.uid()) = owner_id);

create policy "Cada uno ve sus likes"
  on public.workshop_likes for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- El contador de likes se mantiene solo.
create function public.workshop_likes_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.workshop_items set likes_count = likes_count + 1 where id = new.item_id;
  else
    update public.workshop_items set likes_count = likes_count - 1 where id = old.item_id;
  end if;
  return null;
end;
$$;

revoke execute on function public.workshop_likes_count() from public, anon, authenticated;

create trigger workshop_likes_count
  after insert or delete on public.workshop_likes
  for each row execute function public.workshop_likes_count();
