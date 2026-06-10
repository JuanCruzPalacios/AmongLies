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
- Internacionalización (i18n) preparada (es-AR por defecto).

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

# 2. Compilar el paquete compartido
cd packages/shared && npm run build && cd ../..

# 3. Levantar todo en paralelo (frontend + backend + watcher del shared)
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

### Variables de entorno

**Frontend** (`apps/web/.env.local`):
```
NEXT_PUBLIC_SERVER_URL=http://localhost:3001
```

**Backend** (`apps/server/.env`):
```
PORT=3001
```

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
