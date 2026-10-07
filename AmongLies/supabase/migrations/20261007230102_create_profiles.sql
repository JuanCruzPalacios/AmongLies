-- Perfiles públicos de los usuarios registrados (1 a 1 con auth.users).
-- Aplicada al proyecto pyamkqingktpeexkgryb el 2026-10-07.
create extension if not exists citext with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username extensions.citext not null unique
    check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  avatar_id text not null default 'fox',
  locale text not null default 'es' check (locale in ('es', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Datos públicos de cada cuenta: nombre de usuario, avatar e idioma.';

alter table public.profiles enable row level security;

create policy "Los perfiles son públicos"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Cada usuario edita sólo su perfil"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- El perfil se crea solo al registrarse, con los datos que manda el formulario.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, avatar_id, locale)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    coalesce(new.raw_user_meta_data ->> 'avatar_id', 'fox'),
    case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'es' end
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
