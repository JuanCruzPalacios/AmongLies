-- Amistades entre cuentas: una fila por par. Mientras está 'pending' es una
-- solicitud de requester a addressee; al aceptarla pasa a 'accepted'.
-- Sólo escribe el servidor (con la clave secreta): las políticas son de lectura.
create table public.friendships (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

comment on table public.friendships is 'Solicitudes de amistad (pending) y amistades (accepted). Las escribe sólo el servidor.';

-- Un solo vínculo por par, sin importar quién lo pidió.
create unique index friendships_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id);

alter table public.friendships enable row level security;

create policy "Cada uno ve sus amistades y solicitudes"
  on public.friendships for select
  to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));
