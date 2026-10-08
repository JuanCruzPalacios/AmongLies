-- Moderación (admins, suspensiones, reportes) y privacidad de cada cuenta.

alter table public.profiles
  add column is_admin boolean not null default false,
  add column suspended_until timestamptz,
  add column suspension_reason text check (char_length(suspension_reason) <= 200),
  -- Privacidad: aparecer desconectado para los amigos y aceptar invitaciones a salas.
  add column appear_offline boolean not null default false,
  add column allow_invites boolean not null default true;

-- Cada uno sólo puede cambiar estas columnas de su perfil (antes podía cambiar todas,
-- y con is_admin cualquiera se habría hecho admin). El perfil lo crea el trigger del registro.
revoke insert, update on public.profiles from anon, authenticated;
grant update (avatar_id, locale, appear_offline, allow_invites, updated_at)
  on public.profiles to authenticated;

-- Reportes de jugadores y de contenido del workshop. Sólo los lee y escribe el servidor
-- (el panel de admin pasa por él): RLS activado y sin políticas.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('player', 'workshop_item')),
  -- Quién reporta: cuenta o invitado (con su apodo).
  reporter_id uuid references public.profiles (id) on delete set null,
  reporter_nickname text not null check (char_length(reporter_nickname) <= 40),
  -- A quién o qué: una cuenta, un invitado (sólo apodo) o un ítem del workshop.
  target_user_id uuid references public.profiles (id) on delete cascade,
  target_nickname text check (char_length(target_nickname) <= 40),
  target_item_id uuid references public.workshop_items (id) on delete cascade,
  reason text not null check (reason in ('insults', 'cheating', 'spam', 'inappropriate', 'other')),
  details text not null default '' check (char_length(details) <= 300),
  -- Últimos mensajes del chat de la sala, como evidencia.
  evidence jsonb not null default '[]',
  room_code text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolution text check (char_length(resolution) <= 300),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

comment on table public.reports is 'Reportes de jugadores y del workshop. Sólo el servidor los lee y escribe.';

create index reports_status_idx on public.reports (status, created_at desc);
create index reports_reporter_idx on public.reports (reporter_id);
create index reports_target_user_idx on public.reports (target_user_id);
create index reports_target_item_idx on public.reports (target_item_id);
create index reports_resolved_by_idx on public.reports (resolved_by);

alter table public.reports enable row level security;

-- Primer admin: la cuenta de Juan.
update public.profiles set is_admin = true where username = 'Pipita';
