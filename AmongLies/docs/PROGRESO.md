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
| 1 — Identidad y conexión (cuentas, invitado con token, reconexión con pausa) | 🟡 en curso |
| 2 — Reglas configurables y puntaje | pendiente |
| 3 — Juego Tiempo | pendiente |
| 4 — Juego Dibujo | pendiente |
| 5 — Social: amigos, invitaciones, notificaciones, presencia | pendiente |
| 6 — Workshop (listas de palabras y presets de reglas) | pendiente |
| 7 — Ajustes, salas públicas, moderación con panel de admin, i18n, sonido, responsive | pendiente |
| 8 — Tests, deploy en Railway, actualizar la documentación del TP | pendiente |

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

## Fase 1 — plan detallado
1. ✅ Tabla `profiles` con RLS y trigger.
2. **Identidad estable:** el cliente guarda un token de sesión de invitado aleatorio en
   `sessionStorage` (cada pestaña es un jugador distinto y sobrevive a recargar) y lo manda
   en el handshake del socket (`auth: { sessionToken, accessToken? }`). El servidor mapea
   identidad → `playerId` (uuid generado por el servidor, público). **El token nunca se difunde.**
   Con cuenta, la identidad es el `user.id` del JWT; una segunda pestaña reemplaza a la primera.
3. **Verificación del JWT** en el handshake con `jose` (`createRemoteJWKSet`, issuer
   `<SUPABASE_URL>/auth/v1`, audience `authenticated`). Tests con claves ES256 locales.
4. **Reconexión:** al desconectarse, `isConnected = false` + `player:disconnected` y período
   de gracia (`RECONNECT_GRACE_PERIOD_MS`, 30 s). En el lobby, si no vuelve, se lo saca.
   Durante la partida, **el motor se pausa** (los timers se congelan con su tiempo restante)
   hasta que vuelva o hasta que quien decide (el admin, o el conectado más antiguo si el admin
   no está) elija **"Continuar sin él"** → el motor lo saca de la partida.
   Al reconectar: volver a la sala, recibir el estado y `player:reconnected`.
5. **Cuentas con email y contraseña** (Supabase Auth, Google más adelante): registro (email,
   contraseña, username, avatar), login, recuperar contraseña, "revisá tu correo" y nueva
   contraseña. El invitado sigue existiendo. Variables del web: `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
6. Tests del motor (pausa y salida de jugador) y prueba en el navegador recargando la página a mitad de partida.

## Pendientes de Juan (no los puede hacer Claude)
- [ ] Habilitar `pyamkqingktpeexkgryb.supabase.co` en *Network access → Allowed domains* del
  environment de Claude Code (dejando "Allow package managers") y cargar `SUPABASE_SECRET_KEY`
  como variable de entorno. Aplica a sesiones nuevas.
- [ ] Cargar `SUPABASE_SECRET_KEY` en Railway (servicio `server`).
- [ ] **Rotar la clave secreta** (quedó en el historial del chat): *Project Settings → API Keys*.
- [ ] En Supabase, *Authentication → URL Configuration*: Site URL de producción y redirect
  URLs (`http://localhost:3000/**` y la URL de producción), para los mails de confirmación y de recuperación.
- [ ] Activar la protección de `main` en GitHub: *Settings → Branches → Require status checks* → `verificar`.
- [ ] Definir dominio y hosting definitivos.
- [ ] Decidir si se transfiere el proyecto de Supabase a una organización propia `amonglies`.
