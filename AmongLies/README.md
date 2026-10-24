# AmongLies

Plataforma de minijuegos sociales de deducción en tiempo real, para jugar con amigos desde el
navegador (escritorio o celular). En todos los juegos hay uno o más **impostores** escondidos
entre los jugadores y el grupo tiene que descubrirlos votando.

- **Jugar:** https://amonglies-web.onrender.com
- Servidor: https://amonglies-server.onrender.com (plan gratis de Render: si estuvo un rato sin
  uso, tarda alrededor de un minuto en despertar)

---

## Juegos

| Juego | Cómo se juega |
|---|---|
| **El Impostor** | Los inocentes ven una palabra secreta; el impostor no. Por turnos, cada uno escribe una palabra relacionada; después se discute y se vota a quién expulsar. |
| **Impostor por tiempo** | Cada ronda hay un tiempo objetivo que sólo ven los inocentes. En su turno, cada uno toca EMPEZAR y PARAR sin ver el reloj; el impostor tiene que adivinar cuánto esperar. |
| **Impostor dibujo** | Todos dibujan la misma palabra en un lienzo compartido, con poca tinta por turno; el impostor no conoce la palabra y tiene que disimular. Se puede dibujar con el dedo. |

Los tres comparten las reglas de deducción: un juego tiene varias **partidas**; en cada partida
se eligen los impostores, que siguen en todas sus **rondas**. La partida termina cuando se expulsa
a todos los impostores (ganan los inocentes) o cuando quedan tantos impostores como inocentes.
Mínimo 4 jugadores, sin máximo.

**Reglas configurables por el admin de la sala:** cantidad de partidas e impostores, tope de
rondas, tiempos de turno, discusión y votación, pista de categoría para el impostor, voto
secreto, voto "saltear", desempate (nadie sale / re-votar / al azar), listas de palabras y los
ajustes propios de cada juego (tinta, colores, rango de tiempos…).

**Puntaje:** inocente que vota a un impostor +2, impostor que sobrevive la ronda +2, y al
terminar cada partida +1 a cada inocente o +3 a cada impostor del equipo ganador.

## Funcionalidades

- **Salas:** código de 6 caracteres o link; privadas por defecto, o **públicas** con cupo e
  idioma (la home lista las públicas con filtros). Chat con censura de insultos.
- **Reconexión:** si alguien se desconecta, la partida se pausa y al volver recupera su lugar
  (también al recargar la página). Si el admin se va, decide el jugador conectado más antiguo.
- **Cuentas (opcionales):** registro con usuario, login, recuperar contraseña. Sin cuenta se
  juega como invitado.
- **Perfil y estadísticas** por juego: partidas, victorias por rol, votos acertados y puntos.
- **Amigos:** solicitudes, presencia en vivo (en línea / en una sala / jugando), invitaciones a
  la sala y avisos en pantalla.
- **Workshop:** listas de palabras y presets de reglas creados por los usuarios. Se publican, se
  filtran (tipo, idioma, juego, categoría, nombre), se les da like y se guardan como copia
  editable que avisa cuando el autor saca una versión nueva. Se usan desde el lobby.
- **Moderación:** filtro de insultos, reportes de jugadores y de contenido del workshop, y panel
  de admin para resolver reportes, ocultar o borrar contenido y suspender cuentas.
- **Ajustes:** idioma, efectos y música (sintetizados con Web Audio), avisos, privacidad
  (aparecer desconectado, aceptar invitaciones), cambio de email y contraseña, borrar la cuenta.
- **Idiomas:** español (rioplatense) e inglés; las listas de palabras siguen el idioma de la sala.
- **Responsive:** pensado también para celular (menú ☰, chat flotante, dibujo táctil).

---

## Arquitectura

Monorepo **Turborepo**:

```
AmongLies/
├── apps/
│   ├── web/        # Frontend — Next.js 16 (App Router), React 19, Tailwind 4, Zustand
│   └── server/     # Backend  — NestJS 11 + Socket.io (estado de las partidas en memoria)
├── packages/
│   └── shared/     # Tipos, constantes, listas de palabras y utilidades compartidas
├── supabase/
│   └── migrations/ # Esquema de la base (Postgres con RLS)
└── e2e/            # Pruebas de punta a punta (Playwright + bots por socket)
```

- **Tiempo real:** toda la lógica de sala, juego, chat, amigos y workshop va por **Socket.io**.
  HTTP sólo para `GET /health` y `GET /rooms/public`.
- **El servidor manda:** valida cada acción (turnos, votos, tinta, ajustes) y le envía a cada
  jugador sólo lo que puede ver (el impostor nunca recibe la palabra).
- **Motores de juego:** `DeductionEngine` tiene todo lo común (partidas, rondas, votación,
  desempates, puntaje, pausa) y `ImpostorEngine`, `TimeEngine` y `DrawingEngine` sólo definen
  la actividad de cada ronda. Se registran en un registry de juegos.
- **Supabase:** autenticación (el servidor verifica los JWT con el JWKS público) y base de datos
  — `profiles`, `player_stats`, `friendships`, `workshop_items`, `workshop_likes`, `reports` —
  con **RLS en todas las tablas**. El navegador sólo lee lo público o lo propio; escribe el
  servidor con la clave secreta. Sin Redis: una sola instancia.

---

## Desarrollo local

Requisitos: **Node.js ≥ 20.9** (recomendado 22) y **npm ≥ 10**. Dependencias en
[`requirements.txt`](./requirements.txt).

```bash
npm install                     # también activa el hook pre-commit
cp apps/web/.env.example    apps/web/.env.local
cp apps/server/.env.example apps/server/.env    # completar SUPABASE_SECRET_KEY
npm run dev:all                 # web en :3000, servidor en :3001
```

Sin `SUPABASE_SECRET_KEY` el servidor funciona igual para invitados (sin cuentas, amigos,
workshop ni estadísticas).

| Archivo | Variables |
|---|---|
| `apps/web/.env.local` | `NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (públicas por diseño) |
| `apps/server/.env` | `PORT`, `CLIENT_URL` (CORS), `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (nunca se commitea) |

---

## Calidad: tests, hook pre-commit y CI

```bash
npm test                 # tests unitarios del servidor (Jest)
npm run lint             # ESLint en web y server, tsc en shared
npm run check-secrets    # busca credenciales en los archivos versionados
node e2e/run.cjs         # pruebas de punta a punta (ver e2e/README.md)
```

- **Tests unitarios** de las reglas de los tres juegos, sala, validación, amigos, workshop y
  moderación, con umbral mínimo de cobertura de ramas.
- **Pruebas de punta a punta:** partidas reales en Chromium con bots, en escritorio y celular,
  más cuentas temporales para amigos, workshop, moderación y ajustes.
- **Hook pre-commit:** secretos, lint y tests; si algo falla, el commit se aborta.
- **CI** (GitHub Actions): secretos, lint, build, tests con cobertura, `npm audit` y las
  pruebas de punta a punta de invitados contra el build recién compilado.

Detalle del ciclo TDD, los casos borde y los bugs encontrados: [`docs/TESTING.md`](docs/TESTING.md).

---

## Deploy

**Producción en Render** (plan gratis, región Virginia, auto-deploy desde `main`). Los dos
servicios están descritos en [`render.yaml`](../render.yaml) en la raíz del repositorio:

| Servicio | Build | Start |
|---|---|---|
| `amonglies-server` | `cd AmongLies && npm ci && npx turbo run build --filter=@amonglies/server...` | `cd AmongLies && node apps/server/dist/main` |
| `amonglies-web` | `cd AmongLies && npm ci && npx turbo run build --filter=@amonglies/web...` + copiar `public` y `.next/static` al build standalone | `cd AmongLies && node apps/web/.next/standalone/apps/web/server.js` |

Las variables `NEXT_PUBLIC_*` se fijan en el build del web. `SUPABASE_SECRET_KEY` se carga a
mano en el dashboard de Render.

En el plan gratis el servidor se duerme a los 15 minutos sin tráfico y al despertar se pierden
las salas (viven en memoria). Para que no pase en medio de una partida, los clientes que están en
una sala hacen `GET /health` cada 4 minutos; si igual se pierde, la app lo avisa, y al crear o
unirse espera a que el servidor despierte.

Quedaron en el repo las configuraciones de entregas anteriores (`vercel.json`,
`railway.*.json`); no se usan en producción.

---

## Documentación

- [`docs/PROGRESO.md`](docs/PROGRESO.md): fases del desarrollo y decisiones de producto.
- [`docs/TESTING.md`](docs/TESTING.md): estrategia de testing, TDD y bugs encontrados.
- [`docs/AmongLies_TP3_Documentacion_Final.docx`](docs/AmongLies_TP3_Documentacion_Final.docx) (y [PDF](docs/AmongLies_TP3_Documentacion_Final.pdf)): documentación del TP — arquitectura (arc42 + C4) y manual de usuario.
- [`docs/diagramas/`](docs/diagramas): fuentes Mermaid de los diagramas de la documentación.
- [`PLAN_MVP.md`](PLAN_MVP.md): plan del MVP original.
