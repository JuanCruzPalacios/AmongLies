-- Datos iniciales para probar AmongLies sin cargar nada a mano.
--
-- Crea cinco cuentas de demostración (contraseña de todas: AmongLies2026) con estadísticas,
-- amistades, solicitudes pendientes, contenido del workshop y reportes abiertos para el panel
-- de administración. Es idempotente: se puede correr de nuevo y deja los mismos datos.
--
-- Se corre con el editor SQL de Supabase (o `psql`) como dueño de la base: crea las cuentas
-- directamente en auth.users, sin mandar emails de confirmación.
--
--   Usuario       Email                    Rol
--   AdminDemo     admin@amonglies.test     administrador
--   JugadorDemo   jugador@amonglies.test   usuario común (cuenta principal para probar)
--   AmigaDemo     amiga@amonglies.test     usuario común (segunda cuenta: amigos e invitaciones)
--   SofiDemo      sofi@amonglies.test      autora de contenido del workshop
--   LucasDemo     lucas@amonglies.test     tiene un reporte abierto

begin;

-- ── Cuentas ──
with demo(id, email, username, avatar) as (
  values
    ('00000000-0000-4000-a000-000000000001'::uuid, 'admin@amonglies.test',   'AdminDemo',   'owl'),
    ('00000000-0000-4000-a000-000000000002'::uuid, 'jugador@amonglies.test', 'JugadorDemo', 'fox'),
    ('00000000-0000-4000-a000-000000000003'::uuid, 'amiga@amonglies.test',   'AmigaDemo',   'cat'),
    ('00000000-0000-4000-a000-000000000004'::uuid, 'sofi@amonglies.test',    'SofiDemo',    'panda'),
    ('00000000-0000-4000-a000-000000000005'::uuid, 'lucas@amonglies.test',   'LucasDemo',   'bear')
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
  extensions.crypt('AmongLies2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  jsonb_build_object('username', username, 'avatar_id', avatar, 'locale', 'es'),
  now(), now(), '', '', '', '', '', ''
from demo
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.id::text like '00000000-0000-4000-a000-00000000000_'
  and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

update public.profiles set is_admin = (id = '00000000-0000-4000-a000-000000000001'),
                           suspended_until = null, suspension_reason = null
where id::text like '00000000-0000-4000-a000-00000000000_';

-- ── Estadísticas ──
delete from public.player_stats where user_id::text like '00000000-0000-4000-a000-00000000000_';
insert into public.player_stats (user_id, game_id, games_played, partidas_played,
  partidas_as_impostor, partidas_won_as_impostor, partidas_as_innocent, partidas_won_as_innocent,
  correct_votes, innocent_votes, total_points) values
  -- correct_votes ≤ innocent_votes: innocent_votes es el total de votos emitidos como inocente.
  ('00000000-0000-4000-a000-000000000002', 'impostor', 6, 18, 5, 3, 13, 8, 15, 21, 61),
  ('00000000-0000-4000-a000-000000000002', 'time',     3,  9, 2, 1,  7, 5,  6,  9, 27),
  ('00000000-0000-4000-a000-000000000002', 'drawing',  4, 12, 3, 2,  9, 6, 10, 14, 42),
  ('00000000-0000-4000-a000-000000000003', 'impostor', 5, 15, 4, 1, 11, 7, 12, 17, 44),
  ('00000000-0000-4000-a000-000000000003', 'drawing',  2,  6, 2, 2,  4, 3,  4,  5, 25),
  ('00000000-0000-4000-a000-000000000004', 'impostor', 8, 24, 6, 4, 18,12, 20, 27, 86),
  ('00000000-0000-4000-a000-000000000004', 'time',     2,  6, 1, 0,  5, 4,  5,  7, 18),
  ('00000000-0000-4000-a000-000000000005', 'impostor', 4, 12, 4, 2,  8, 3,  6, 12, 33);

-- ── Amistades y solicitudes ──
delete from public.friendships
where requester_id::text like '00000000-0000-4000-a000-00000000000_'
   or addressee_id::text like '00000000-0000-4000-a000-00000000000_';
insert into public.friendships (requester_id, addressee_id, status) values
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000003', 'accepted'),
  ('00000000-0000-4000-a000-000000000004', '00000000-0000-4000-a000-000000000002', 'accepted'),
  ('00000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000002', 'pending'),
  ('00000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000004', 'accepted');

-- ── Workshop ──
delete from public.workshop_items where owner_id::text like '00000000-0000-4000-a000-00000000000_';
insert into public.workshop_items (id, owner_id, kind, title, description, locale, category,
  games, drawable, content, version, published, source_id, source_version, modified) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000004', 'word_list',
   'Comidas argentinas', 'Clásicos de la mesa argentina para jugar con amigos.', 'es', 'food',
   '{impostor,drawing}', true,
   '{"words":["Empanada","Asado","Milanesa","Choripán","Locro","Alfajor","Dulce de leche","Mate","Facturas","Provoleta","Chipá","Humita","Pastafrola","Fainá","Pizza"]}',
   2, true, null, null, false),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000004', 'word_list',
   'Animales de la granja', 'Fáciles de dibujar: ideales para el Impostor dibujo.', 'es', 'animals',
   '{impostor,drawing}', true,
   '{"words":["Vaca","Caballo","Oveja","Cerdo","Gallina","Pato","Cabra","Conejo","Perro","Gato","Burro","Pavo"]}',
   1, true, null, null, false),
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-a000-000000000005', 'word_list',
   'Video games', 'Famous video game titles and characters.', 'en', 'characters',
   '{impostor}', false,
   '{"words":["Mario","Zelda","Minecraft","Fortnite","Tetris","Pac-Man","Sonic","Pokemon","Halo","Kirby","Portal","Among Us"]}',
   1, true, null, null, false),
  ('00000000-0000-4000-b000-000000000004', '00000000-0000-4000-a000-000000000004', 'preset',
   'Partida rápida', 'Turnos y discusión cortos para una ronda de 10 minutos.', null, null,
   '{impostor}', false,
   '{"gameId":"impostor","settings":{"partidas":2,"maxRoundsPerPartida":3,"impostorCount":1,"turnTimeSeconds":20,"wordRevealTimeSeconds":8,"impostorCategoryHint":true,"communicationMode":"chat","discussionTimeSeconds":60,"votingTimeSeconds":20,"secretVote":false,"allowSkipVote":true,"tieBreak":"revote"}}',
   1, true, null, null, false),
  ('00000000-0000-4000-b000-000000000005', '00000000-0000-4000-a000-000000000003', 'preset',
   'Dibujo con poca tinta', 'Más difícil: menos tinta por turno y dos turnos por ronda.', null, null,
   '{drawing}', false,
   '{"gameId":"drawing","settings":{"partidas":3,"maxRoundsPerPartida":0,"impostorCount":1,"wordRevealTimeSeconds":8,"impostorCategoryHint":false,"turnsPerRound":2,"inkPerTurn":60,"minInkPercent":20,"turnTimeSeconds":30,"colorMode":"free","discussionTimeSeconds":90,"votingTimeSeconds":30,"secretVote":true,"allowSkipVote":true,"tieBreak":"none"}}',
   1, true, null, null, false),
  -- Lista propia y privada de JugadorDemo.
  ('00000000-0000-4000-b000-000000000006', '00000000-0000-4000-a000-000000000002', 'word_list',
   'Mi lista de prueba', 'Lista privada: sólo la ve su dueño.', 'es', 'objects',
   '{impostor}', false,
   '{"words":["Lápiz","Mochila","Cuaderno","Regla","Goma","Tijera","Calculadora","Carpeta","Pizarrón","Tiza"]}',
   1, false, null, null, false),
  -- Copia guardada de "Comidas argentinas" en una versión anterior: muestra el aviso de versión nueva.
  ('00000000-0000-4000-b000-000000000007', '00000000-0000-4000-a000-000000000002', 'word_list',
   'Comidas argentinas', 'Clásicos de la mesa argentina para jugar con amigos.', 'es', 'food',
   '{impostor,drawing}', true,
   '{"words":["Empanada","Asado","Milanesa","Choripán","Locro","Alfajor","Dulce de leche","Mate","Facturas","Provoleta"]}',
   1, false, '00000000-0000-4000-b000-000000000001', 1, false);

-- Más contenido publicado para que el workshop tenga qué mostrar.
insert into public.workshop_items (id, owner_id, kind, title, description, locale, category,
  games, drawable, content, version, published, source_id, source_version, modified) values
  ('00000000-0000-4000-b000-000000000008', '00000000-0000-4000-a000-000000000005', 'word_list',
   'Fútbol argentino', 'Clubes, ídolos y cosas de cancha.', 'es', 'sports',
   '{impostor}', false,
   '{"words":["Boca","River","Messi","Maradona","Bombonera","Monumental","Superclásico","Hinchada","Penal","Offside","Tribuna","Gambeta","Camiseta","Árbitro","Mundial"]}',
   1, true, null, null, false),
  ('00000000-0000-4000-b000-000000000009', '00000000-0000-4000-a000-000000000004', 'word_list',
   'Superhéroes', 'Héroes y villanos fáciles de reconocer en un dibujo.', 'es', 'characters',
   '{impostor,drawing}', true,
   '{"words":["Batman","Superman","Spiderman","Hulk","Iron Man","Mujer Maravilla","Capitán América","Thor","Joker","Flash","Aquaman","Wolverine"]}',
   1, true, null, null, false),
  ('00000000-0000-4000-b000-000000000010', '00000000-0000-4000-a000-000000000003', 'word_list',
   'Objetos de la casa', 'Cosas que hay en cualquier casa. Ideal para principiantes.', 'es', 'objects',
   '{impostor,drawing}', true,
   '{"words":["Silla","Mesa","Cama","Lámpara","Heladera","Televisor","Sillón","Espejo","Reloj","Cuchara","Taza","Paraguas","Escoba","Almohada"]}',
   1, true, null, null, false),
  ('00000000-0000-4000-b000-000000000011', '00000000-0000-4000-a000-000000000005', 'word_list',
   'Profesiones', 'Oficios y trabajos para describir sin decir el nombre.', 'es', 'jobs',
   '{impostor}', false,
   '{"words":["Médico","Bombero","Docente","Cocinero","Policía","Abogado","Arquitecto","Mecánico","Panadero","Programador","Veterinario","Periodista"]}',
   1, true, null, null, false),
  ('00000000-0000-4000-b000-000000000012', '00000000-0000-4000-a000-000000000004', 'word_list',
   'Películas animadas', 'Clásicos animados que todos vimos alguna vez.', 'es', 'movies',
   '{impostor}', false,
   '{"words":["Toy Story","Shrek","El Rey León","Buscando a Nemo","Frozen","Coco","Up","Ratatouille","Cars","Intensamente","Monsters Inc","Madagascar"]}',
   1, true, null, null, false),
  ('00000000-0000-4000-b000-000000000013', '00000000-0000-4000-a000-000000000003', 'word_list',
   'Kitchen items', 'Everyday things you find in a kitchen.', 'en', 'objects',
   '{impostor,drawing}', true,
   '{"words":["Fork","Knife","Spoon","Plate","Fridge","Oven","Kettle","Toaster","Cup","Pan","Blender","Sink"]}',
   1, true, null, null, false),
  ('00000000-0000-4000-b000-000000000014', '00000000-0000-4000-a000-000000000005', 'preset',
   'Dos impostores', 'Para grupos grandes (8 o más): dos impostores y voto secreto.', null, null,
   '{impostor}', false,
   '{"gameId":"impostor","settings":{"partidas":3,"maxRoundsPerPartida":0,"impostorCount":2,"turnTimeSeconds":30,"wordRevealTimeSeconds":10,"impostorCategoryHint":false,"communicationMode":"chat","discussionTimeSeconds":120,"votingTimeSeconds":30,"secretVote":true,"allowSkipVote":true,"tieBreak":"revote"}}',
   1, true, null, null, false),
  ('00000000-0000-4000-b000-000000000015', '00000000-0000-4000-a000-000000000004', 'preset',
   'Reloj difícil', 'Tiempos objetivo más largos: es más difícil acertar y más fácil disimular.', null, null,
   '{time}', false,
   '{"gameId":"time","settings":{"partidas":3,"maxRoundsPerPartida":0,"impostorCount":1,"targetMinSeconds":10,"targetMaxSeconds":30,"maxTurnSeconds":40,"roleRevealTimeSeconds":8,"discussionTimeSeconds":90,"votingTimeSeconds":30,"secretVote":false,"allowSkipVote":true,"tieBreak":"none"}}',
   1, true, null, null, false),
  ('00000000-0000-4000-b000-000000000016', '00000000-0000-4000-a000-000000000002', 'preset',
   'Modo voz con amigos', 'Para jugar en persona o en llamada: pistas habladas y discusión corta.', null, null,
   '{impostor}', false,
   '{"gameId":"impostor","settings":{"partidas":3,"maxRoundsPerPartida":0,"impostorCount":1,"turnTimeSeconds":30,"wordRevealTimeSeconds":10,"impostorCategoryHint":true,"communicationMode":"voice","discussionTimeSeconds":90,"votingTimeSeconds":30,"secretVote":false,"allowSkipVote":true,"tieBreak":"none"}}',
   1, true, null, null, false);

insert into public.workshop_likes (user_id, item_id) values
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-b000-000000000008'),
  ('00000000-0000-4000-a000-000000000003', '00000000-0000-4000-b000-000000000008'),
  ('00000000-0000-4000-a000-000000000004', '00000000-0000-4000-b000-000000000008'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000008'),
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-b000-000000000009'),
  ('00000000-0000-4000-a000-000000000005', '00000000-0000-4000-b000-000000000009'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000010'),
  ('00000000-0000-4000-a000-000000000003', '00000000-0000-4000-b000-000000000014'),
  ('00000000-0000-4000-a000-000000000003', '00000000-0000-4000-b000-000000000016');

insert into public.workshop_likes (user_id, item_id) values
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-b000-000000000001'),
  ('00000000-0000-4000-a000-000000000003', '00000000-0000-4000-b000-000000000001'),
  ('00000000-0000-4000-a000-000000000005', '00000000-0000-4000-b000-000000000001'),
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-b000-000000000004'),
  ('00000000-0000-4000-a000-000000000003', '00000000-0000-4000-b000-000000000002');

-- ── Reportes abiertos para el panel de administración ──
delete from public.reports where id::text like '00000000-0000-4000-c000-00000000000_';
insert into public.reports (id, kind, reporter_id, reporter_nickname, target_user_id, target_nickname,
  target_item_id, reason, details, evidence, room_code, status) values
  ('00000000-0000-4000-c000-000000000001', 'player', '00000000-0000-4000-a000-000000000002', 'JugadorDemo',
   '00000000-0000-4000-a000-000000000005', 'LucasDemo', null, 'insults',
   'Insultó a otros jugadores durante la discusión.',
   '[{"nickname":"LucasDemo","message":"sos un ****","timestamp":1763300000000},{"nickname":"AmigaDemo","message":"tranqui, es un juego","timestamp":1763300005000},{"nickname":"LucasDemo","message":"callate ****","timestamp":1763300010000}]',
   'DEMO01', 'open'),
  ('00000000-0000-4000-c000-000000000002', 'workshop_item', '00000000-0000-4000-a000-000000000003', 'AmigaDemo',
   null, null, '00000000-0000-4000-b000-000000000003', 'spam',
   'La lista está repetida varias veces en el workshop.', '[]', null, 'open');

commit;
