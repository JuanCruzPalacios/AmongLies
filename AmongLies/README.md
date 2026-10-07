# AmongLies

Plataforma de minijuegos sociales en tiempo real, inspirada en juegos como Among Us y Gartic Phone.

El MVP incluye el juego **El Impostor**: un jugador conoce la palabra secreta del grupo pero uno o más impostores deben descubrirla sin que los demás los descubran.

---

## Estado actual — MVP

### Funcionalidades implementadas

#### Sala y lobby
- Crear sala con código único de 6 caracteres
- Unirse a una sala por código o por link compartido
- Botón para copiar código y link de la sala
- Chat en tiempo real dentro del lobby
- Configuración de partida ajustable por el host (modos, rondas, listas de palabras)
- Avatares seleccionables por cada jugador

#### El Impostor — flujo completo de partida
- **Partidas y rondas**: una partida contiene varias rondas. El impostor es el mismo durante toda la partida y cambia entre partidas. El número total de partidas es configurable.
- **Asignación de roles**: uno o más impostores (configurable) y el resto inocentes. Los impostores conocen a sus cómplices.
- **Palabra secreta**: los inocentes ven la palabra, el impostor debe deducirla escuchando al grupo.
- **Fase de turnos** (modo chat): cada jugador envía una palabra relacionada con el tema. Validación anti-repetición y anti-trampa (no se puede poner la palabra secreta si sos inocente).
- **Fase de discusión**: chat libre para debatir. Botón de votación para saltear la discusión (requiere consenso de todos).
- **Fase de votación**: cada jugador vota a quien cree que es el impostor. Los jugadores eliminados pueden ver pero no votar. Indicador en tiempo real de cuántos faltan votar.
- **Resultados de votación**: reveal escalonado con suspenso (quién fue expulsado → ¿era impostor? → detalle completo). Gráfico de votos con barra por jugador y sección "quién votó a quién".
- **Empate**: nadie es expulsado, la partida continúa en la siguiente ronda.
- **Fin de partida**: la partida termina cuando todos los impostores son eliminados, o cuando quedan tantos impostores como inocentes (los impostores ganan).
- **Tope de rondas (opcional)**: por defecto no hay límite. Si el host pone un tope y se llega a él sin que gane nadie, ganan los impostores.
- **Fin de juego**: pantalla resumen con historial por partida y ganador general.
- **Pantalla entre partidas**: pantalla de espera con countdown de 15 segundos (salteable por consenso) que revela quiénes eran los impostores antes de empezar la siguiente partida.

#### UI y experiencia
- Chat lateral persistente durante la partida (escritorio) con burbujas, separadores de ronda y scroll automático.
- Chat flotante en mobile: botón 💬 con badge de mensajes no leídos que despliega un panel inferior.
- Strip de jugadores eliminados (👻) visible en todo momento durante la partida.
- Badge "🕵️ IMPOSTOR" visible solo para quienes tienen ese rol.
- Indicador de "Partida X/Y · Ronda Z" en el header.
- Historial de expulsados en la pantalla de reveal de palabra (rondas anteriores de la misma partida).
- Jugadores eliminados con avatar tachado en la fase de votación.
- Soporte para unirse a una sala via link directo (incluso si ya hay una partida en curso, se puede unir al lobby para la siguiente).
- Diseño responsive con soporte mobile/desktop.
- Interfaz en español (por defecto) e inglés; las listas de palabras se filtran por el idioma de la sala.

---

## Arquitectura

El proyecto es un **monorepo Turborepo** con tres paquetes:

```
AmongLies/
├── apps/
│   ├── web/          # Frontend — Next.js 16 (App Router)
│   └── server/       # Backend  — NestJS 11
└── packages/
    └── shared/       # Tipos TypeScript compartidos (compilado a CommonJS)
```

### Comunicación
- El frontend y el backend se comunican exclusivamente via **WebSockets con Socket.io**.
- No hay REST API: toda la lógica de sala y juego es event-driven.

### Estado en el cliente
- **Zustand** maneja el estado global: `playerStore` (jugador local) y `roomStore` (sala y chat).

### Lógica de juego en el servidor
- `ImpostorEngine`: clase con máquina de estados por fases (`word-reveal` → `turns` → `discussion` → `voting` → `vote-results` → `partida-end` / `game-end`).
- El servidor filtra la información enviada a cada jugador (los impostores no revelan la palabra secreta, los cómplices solo se revelan al finalizar la partida).

---

## Requisitos del sistema

Ver [requirements.txt](./requirements.txt) para el listado completo de dependencias.

- **Node.js** >= 20
- **npm** >= 10
- El paquete `packages/shared` debe compilarse antes de levantar las apps: `npm run build` dentro de `packages/shared`, o usar `npx turbo build` desde la raíz.

---

## Desarrollo local

```bash
# 1. Instalar dependencias desde la raíz del monorepo
npm install

# 2. Crear los archivos de variables de entorno (ver sección siguiente)

# 3. Levantar todo en paralelo (Turbo compila el paquete shared automáticamente)
npm run dev:all
```

Por defecto:
- Frontend: `http://localhost:3000`
- Backend (WebSocket): `http://localhost:3001`

Para correr solo el frontend o solo el backend:
```bash
npm run dev:web     # solo Next.js
npm run dev:server  # solo NestJS
```

> **Nota:** `npm run dev:all` es el único comando necesario. Turbo se encarga de compilar `packages/shared` antes de levantar las apps gracias a la dependencia declarada en `turbo.json`. No hace falta compilar shared manualmente.

### Variables de entorno

Cada app tiene un archivo `.env.example` con los valores de referencia. Copiarlo y completarlo:

```bash
cp apps/web/.env.example    apps/web/.env.local
cp apps/server/.env.example apps/server/.env
```

**Frontend** (`apps/web/.env.local`):
```
# URL completa del servidor backend
NEXT_PUBLIC_SERVER_URL=http://localhost:3001

# Supabase (públicas: la seguridad la dan las políticas RLS)
NEXT_PUBLIC_SUPABASE_URL=https://pyamkqingktpeexkgryb.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

**Backend** (`apps/server/.env`):
```
# Puerto en el que escucha NestJS
PORT=3001

# URL del frontend — usada para la política CORS
# Sin este valor el frontend no puede conectarse al backend desde otro origen
CLIENT_URL=http://localhost:3000

# Supabase: la URL es pública; la clave secreta nunca se commitea
SUPABASE_URL=https://pyamkqingktpeexkgryb.supabase.co
SUPABASE_SECRET_KEY=
```

---

## Calidad: tests, hook pre-commit y CI

```bash
npm test                 # tests unitarios del servidor (lógica del juego)
npm run lint             # ESLint en web y server, tsc en shared
npm run check-secrets    # busca credenciales en los archivos versionados
```

**Hook pre-commit:** `npm install` lo activa solo (configura `git config core.hooksPath .githooks`).
Antes de cada commit busca secretos en el diff y corre el linter y los tests; si algo falla,
el commit se aborta. Si clonaste el repo antes de que existiera el hook, corré
`npm install` otra vez (o `git config core.hooksPath .githooks` desde la raíz del repo).

**CI:** GitHub Actions (`.github/workflows/ci.yml`) repite esos chequeos en cada push y PR,
más el build completo, el umbral de cobertura de ramas y `npm audit`.

Detalle del ciclo TDD, los casos borde, la prueba de mutación y los bugs encontrados:
[`docs/TESTING.md`](docs/TESTING.md).

---

## Deploy en producción

El proyecto está configurado para deployarse en **Railway** (recomendado) o **Render**, con dos servicios separados: uno para el frontend y otro para el backend.

### Railway

Usar el archivo `railway.json` incluido en la raíz. Define los dos servicios automáticamente.

Variables de entorno a configurar en Railway:
- Servicio `web`: `NEXT_PUBLIC_SERVER_URL=https://<url-del-server-en-railway>`
- Servicio `server`: `PORT=3001` (Railway lo provee automáticamente como `$PORT`)

### Render

Crear dos servicios web en Render (dejar Root Directory en **blanco**):

**Backend:**
- Build: `cd AmongLies && npm install && npx turbo run build --filter=@amonglies/server...`
- Start: `node AmongLies/apps/server/dist/main`

**Frontend:**
- Build: `cd AmongLies && npm install && npx turbo run build --filter=@amonglies/web... && cp -r apps/web/public apps/web/.next/standalone/public && cp -r apps/web/.next/static apps/web/.next/standalone/.next/static`
- Start: `node AmongLies/apps/web/.next/standalone/server.js`

---

## Estructura de carpetas relevante

```
apps/web/src/
├── app/
│   ├── page.tsx                    # Pantalla de inicio (crear/unirse a sala)
│   └── room/[code]/page.tsx        # Sala: lobby + juego
├── components/
│   ├── impostor/
│   │   ├── ImpostorGame.tsx        # Contenedor principal del juego
│   │   └── phases/
│   │       ├── WordReveal.tsx      # Reveal de palabra/rol
│   │       ├── TurnsChat.tsx       # Fase de turnos (modo chat)
│   │       ├── Discussion.tsx      # Fase de discusión
│   │       ├── Voting.tsx          # Fase de votación
│   │       ├── VoteResults.tsx     # Resultados de votación
│   │       ├── PartidaEnd.tsx      # Pantalla entre partidas
│   │       └── GameEnd.tsx         # Pantalla final del juego
│   ├── lobby/
│   │   ├── Chat.tsx                # Chat del lobby
│   │   └── GameSettings.tsx        # Configuración de partida
│   └── ui/
│       └── Avatar.tsx
├── stores/
│   ├── playerStore.ts
│   └── roomStore.ts
└── lib/
    ├── socket.ts                   # Singleton de Socket.io
    └── i18n.ts                     # Traducciones

apps/server/src/
├── game/
│   ├── game.gateway.ts             # WebSocket gateway (eventos)
│   ├── game.service.ts             # Lógica de sala y partida
│   └── engines/impostor/
│       └── impostor.engine.ts      # Máquina de estados del juego

packages/shared/src/
└── types/
    ├── impostor.ts                 # Tipos del juego compartidos
    └── room.ts                     # Tipos de sala
```
