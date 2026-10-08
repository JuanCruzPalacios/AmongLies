-- Estadísticas acumuladas por cuenta y por juego. Sólo las escribe el servidor
-- de juego (service_role) al terminar cada juego; cualquiera puede leerlas.
create table public.player_stats (
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id text not null,
  games_played integer not null default 0 check (games_played >= 0),
  partidas_played integer not null default 0 check (partidas_played >= 0),
  partidas_as_impostor integer not null default 0 check (partidas_as_impostor >= 0),
  partidas_won_as_impostor integer not null default 0 check (partidas_won_as_impostor >= 0),
  partidas_as_innocent integer not null default 0 check (partidas_as_innocent >= 0),
  partidas_won_as_innocent integer not null default 0 check (partidas_won_as_innocent >= 0),
  correct_votes integer not null default 0 check (correct_votes >= 0),
  innocent_votes integer not null default 0 check (innocent_votes >= 0),
  total_points integer not null default 0 check (total_points >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

comment on table public.player_stats is 'Estadísticas por cuenta y juego; las escribe sólo el servidor con record_game_stats.';

alter table public.player_stats enable row level security;

create policy "Las estadísticas son públicas"
  on public.player_stats for select
  to anon, authenticated
  using (true);

-- Suma las estadísticas de un juego terminado (una fila por jugador con cuenta).
create function public.record_game_stats(entries jsonb)
returns void
language sql
set search_path = ''
as $$
  insert into public.player_stats as s (
    user_id, game_id, games_played, partidas_played,
    partidas_as_impostor, partidas_won_as_impostor,
    partidas_as_innocent, partidas_won_as_innocent,
    correct_votes, innocent_votes, total_points
  )
  select
    (e ->> 'user_id')::uuid,
    e ->> 'game_id',
    1,
    (e ->> 'partidas_played')::int,
    (e ->> 'partidas_as_impostor')::int,
    (e ->> 'partidas_won_as_impostor')::int,
    (e ->> 'partidas_as_innocent')::int,
    (e ->> 'partidas_won_as_innocent')::int,
    (e ->> 'correct_votes')::int,
    (e ->> 'innocent_votes')::int,
    (e ->> 'points')::int
  from jsonb_array_elements(entries) as e
  on conflict (user_id, game_id) do update set
    games_played = s.games_played + 1,
    partidas_played = s.partidas_played + excluded.partidas_played,
    partidas_as_impostor = s.partidas_as_impostor + excluded.partidas_as_impostor,
    partidas_won_as_impostor = s.partidas_won_as_impostor + excluded.partidas_won_as_impostor,
    partidas_as_innocent = s.partidas_as_innocent + excluded.partidas_as_innocent,
    partidas_won_as_innocent = s.partidas_won_as_innocent + excluded.partidas_won_as_innocent,
    correct_votes = s.correct_votes + excluded.correct_votes,
    innocent_votes = s.innocent_votes + excluded.innocent_votes,
    total_points = s.total_points + excluded.total_points,
    updated_at = now();
$$;

revoke execute on function public.record_game_stats(jsonb) from public, anon, authenticated;
grant execute on function public.record_game_stats(jsonb) to service_role;
