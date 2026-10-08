# Progreso de la versión final — estado y decisiones

Documento de traspaso entre sesiones de desarrollo. **Si sos una sesión nueva de Claude,
leé esto primero**, junto con `docs/TESTING.md`. Acá están las decisiones que Juan ya
tomó: no hace falta volver a preguntarlas.

## Cómo trabajar con Juan
- Español rioplatense, respuestas cortas. Preguntar antes de decidir cosas de producto o diseño.
- Commits directo a `main`, **a nombre de Juan** (`git config user.name "JuanCruzPalacios"`,
  `user.email "jpalacios@alumno.huergo.edu.ar"`), **sin** `Co-Authored-By` ni menciones a Claude.
- Hacer **sólo lo necesario**: nada de complejidad extra.
- Cada fase se verifica con build, lint, tests y una prueba en el navegador antes de commitear.
- El hook pre-commit corre secretos, lint y tests: no saltearlo.

## Fases

| Fase | Estado |
|---|---|
| 0 — Base: bugs, `GameEngine` + registry, validación, tests, guardrails | ✅ hecha |
| 1 — Identidad y conexión (cuentas, invitado con token, reconexión con pausa) | ✅ hecha |
| 2 — Reglas configurables y puntaje | ✅ hecha |
| 3 — Juego Tiempo | ✅ hecha |
| 4 — Juego Dibujo | pendiente |
| 5 — Social: amigos, invitaciones, notificaciones, presencia | pendiente |
| 6 — Workshop (listas de palabras y presets de reglas) | pendiente |
| 7 — Ajustes, salas públicas, moderación con panel de admin, i18n, sonido, responsive | pendiente |
| 8 — Tests, deploy, actualizar la documentación del TP | pendiente |

## Decisiones de producto (definitivas)

**Partidas y rondas**
- Un juego tiene N partidas. Los impostores se eligen al empezar cada partida y siguen en todas sus rondas.
- La partida termina cuando se eliminan todos los impostores (ganan los inocentes) o cuando
  impostores ≥ inocentes (ganan los impostores).
- "Rondas por partida" es un **tope opcional**, por defecto **sin límite**. Si hay tope y se llega a él, ganan los impostores. *(Hecho en la Fase 0.)*
- Empate de votos: nadie sale (manejo configurable en la Fase 2).

**Puntaje (Fase 2)**: inocente que vota a un impostor +2; inocente cuyo equipo gana la
partida +1; impostor que sobrevive la ronda +2; impostor cuyo equipo gana la partida +3;
impostor expulsado 0. Todo en una config compartida y ajustable.

**Juegos**
- Mínimo 4 jugadores en los tres, leído de `GameDefinition.minPlayers`. Sin máximo.
- **Tiempo:** por turnos; el jugador toca **EMPEZAR** y después **PARAR** (sin cuenta 3-2-1),
  con tiempo máximo por turno. Su tiempo se revela a todos al parar. Los inocentes ven el
  objetivo; el impostor no. El objetivo se revela recién en los resultados.
- **Dibujo:** **una palabra, un lienzo y los mismos impostores por partida.** Cada ronda,
  cada jugador agrega un poco al mismo dibujo y se vota; si nadie gana, se sigue sobre el
  mismo dibujo. Límite de **tinta 100 % configurable**, por defecto **bajo** (más o menos
  una línea por turno). Pincel y color. **Sin deshacer.**

**Plataforma**
- Idiomas: **sólo español e inglés** (el portugués ya se eliminó).
- Estado de las partidas **en memoria**, una sola instancia: **sin Redis**.
- Social en tiempo real **por el socket del servidor** (no Supabase Realtime).
- "Todo personalizable" = **jugabilidad** (listas de palabras, reglas, presets), **no estética**.
  El workshop publica listas de palabras y presets de reglas.
- Salas públicas: el listado muestra juego, idioma, jugadores y estado, con filtros y cupo opcional.
- Moderación: filtro de insultos + reportes + **panel de admin**.
- Si el **admin se desconecta** durante la partida, decide el **jugador conectado más antiguo**; si el admin vuelve, recupera el rol.
- La documentación del TP3 (`AmongLies_TP3_Documentacion_Final.docx`) describe otros juegos
  (Dibujá y Adiviná, Teléfono Descompuesto), Redis y pt: **manda el prompt maestro**. La
  documentación se actualiza en la Fase 8.

## Supabase
- Proyecto `pyamkqingktpeexkgryb` (región sa-east-1), en la organización "Figuritate".
  **No tocar** el otro proyecto de esa organización (`hgrmkmmoydyvhegdbtjd`).
- Claves JWT **ECC**: el servidor verifica los tokens con el JWKS público
  (`https://pyamkqingktpeexkgryb.supabase.co/auth/v1/.well-known/jwks.json`), sin secreto JWT.
- `SUPABASE_SECRET_KEY` va como variable de entorno (environment de la sesión y Railway), nunca en el repo.
- Migraciones en `supabase/migrations/`; se aplican con el conector MCP (`apply_migration`)
  y después se corre `get_advisors`.
  - `20261007230102_create_profiles`: tabla `profiles` (username citext único `^[A-Za-z0-9_]{3,20}$`,
    avatar_id, locale es/en) con RLS (lectura pública, cada uno edita el suyo) y un trigger que
    crea el perfil al registrarse con `raw_user_meta_data` (`username`, `avatar_id`, `locale`).
    Advisors en 0. Probada con un usuario de prueba dentro de una transacción revertida.

## Fase 1 — qué quedó hecho
- **Base:** tabla `profiles` (username 3–16, avatar, idioma) con RLS y trigger de alta.
  Migraciones en `supabase/migrations/`.
- **Identidad:** el cliente manda en el handshake `{ sessionToken, accessToken? }`.
  El token de invitado vive en `sessionStorage` (cada pestaña es un jugador y sobrevive a
  recargar) y nunca se difunde; el `playerId` público lo genera el servidor. Con cuenta, la
  identidad es el `user.id` del JWT, verificado con el JWKS público (`jose` v5, que trae build
  CommonJS) y una segunda pestaña reemplaza a la primera (`session:replaced`).
- **Reconexión:** `session:ready` restaura la sala y el estado al volver. Al desconectarse,
  `player:disconnected` y la partida se pausa (`PausableTimers`). En el lobby, si no vuelve en
  30 s, sale. En partida se espera hasta que vuelva o hasta que quien decide (`getDecider`:
  admin, o el conectado más antiguo) toque "Seguir sin esperar" (`game:continue-without`).
- **Cuentas:** `/login`, `/registro` (con el apodo y avatar del invitado), `/recuperar` y
  `/nueva-contrasena`. Header con la cuenta (oculto dentro de las salas).
- **Probado:** 115 tests unitarios; reconexión contra el servidor real (15 checks); recarga a
  mitad de partida y "Seguir sin esperar" en el navegador (8); login real contra Supabase
  con un usuario de prueba creado y borrado con la clave secreta (10 + 2).

### Nota para probar en el contenedor de Claude Code
La red del contenedor sale por un proxy. Para que el **servidor** llegue al JWKS de Supabase
hay que levantarlo con `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`, y
Chromium con `--proxy-server=https=<host:puerto de HTTPS_PROXY>`. En Railway no hace falta.

## Fase 2 — qué quedó hecho
- **Ajustes nuevos del Impostor:** pista de categoría para el impostor, voto secreto (en los
  resultados sólo se ven los conteos), permitir votar "saltear" y empate: nadie sale / re-votar
  una sola vez entre los empatados / al azar. ("Nadie sale" y "seguir a la próxima ronda" del
  prompt original son lo mismo, quedó una sola opción.)
- **Puntaje** (`SCORING` en shared): inocente que vota a un impostor +2, impostor que sobrevive
  la ronda +2, bonus de partida +1 a cada inocente o +3 a cada impostor del equipo ganador.
  **Los puntos se revelan al terminar cada partida**, no por ronda: mostrarlos antes delataría
  al impostor. Ranking en el fin de partida y podio en el fin del juego.
- **Estadísticas** por cuenta y juego en `player_stats` (lectura pública; sólo el servidor
  escribe, vía `record_game_stats` con la clave secreta). Página `/perfil` con juegos,
  partidas, victorias por rol, % de votos acertados y puntos.
- **Probado:** 143 tests; partida de punta a punta con cuenta + bots (11 checks) verificando
  la fila guardada en Supabase; las suites de las fases 0 y 1 siguen en verde.

## Fase 3 — qué quedó hecho
- **Familia Impostor:** `DeductionEngine` (en `engines/deduction/`) tiene todo lo común —
  partidas, rondas, turnos, votación, desempates, puntaje, estadísticas, pausa — y cada juego
  sólo define su actividad de la ronda. El Impostor clásico pasó a usarlo sin cambiar reglas.
  En la web, las pantallas comunes están en `components/deduction/`.
- **Impostor por tiempo** (`gameId: 'time'`): cada ronda hay un tiempo objetivo (décimas de
  segundo, entre el mínimo y el máximo configurables) que sólo ven los inocentes. En su turno
  cada uno toca EMPEZAR y PARAR sin ver el reloj; el tiempo se revela a todos apenas para.
  Se mide en el navegador (`performance.now()`) y el servidor no acepta más de lo que pasó
  realmente. Si no arranca o no para antes del máximo por turno, queda "se le pasó". Pausar
  con el reloj en marcha reinicia ese turno. No usa listas de palabras.
- **Probado:** 173 tests; partida de Tiempo de punta a punta con el admin en el navegador y
  3 bots (10 checks); las suites de las fases 0, 1 y 2 siguen en verde. Se encontró y arregló
  el bug #22 (ver TESTING.md).

## Deploy
- **Producción en Render** (plan gratis, Virginia, auto-deploy desde `main`):
  web https://amonglies-web.onrender.com · server https://amonglies-server.onrender.com.
  Probado con una partida completa de 4 navegadores reales contra producción.
- Railway quedó configurado en el repo (`railway.*.json`) pero la cuenta tiene la prueba
  vencida: no se usa.

## Pendientes de Juan (no los puede hacer Claude)
- [ ] Habilitar `pyamkqingktpeexkgryb.supabase.co` en *Network access → Allowed domains* del
  environment de Claude Code (dejando "Allow package managers") y cargar `SUPABASE_SECRET_KEY`
  como variable de entorno. Aplica a sesiones nuevas.
- [x] Variables cargadas en Render (incluida `SUPABASE_SECRET_KEY` en `amonglies-server`).
  Si rotás la clave, actualizala ahí.
- [ ] **Rotar la clave secreta** (quedó en el historial del chat): *Project Settings → API Keys*.
- [ ] En Supabase, *Authentication → URL Configuration*: Site URL `https://amonglies-web.onrender.com`
  y redirect URLs `https://amonglies-web.onrender.com/**` y `http://localhost:3000/**`
  (sin esto los links de confirmación y de recuperación de contraseña no vuelven a la app).
- [ ] Activar la protección de `main` en GitHub: *Settings → Branches → Require status checks* → `verificar`.
- [ ] Definir dominio propio (hoy: subdominios de onrender.com).
- [ ] Borrar desde el dashboard de Railway los proyectos viejos `magnificent-integrity`,
  `carefree-smile` y `sparkling-forgiveness` (el conector no puede borrar proyectos).
- [ ] Decidir si se transfiere el proyecto de Supabase a una organización propia `amonglies`.
