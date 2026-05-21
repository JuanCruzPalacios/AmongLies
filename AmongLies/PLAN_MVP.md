# AmongLies - Plan de Implementacion MVP

## Vision del Proyecto

AmongLies es una plataforma web de minijuegos sociales online jugables con amigos, al estilo Gartic Phone, MakeItMeme y Pinturillo. Los jugadores crean salas, invitan amigos, y juegan una variedad de minijuegos de deduccion social y creatividad.

Para el MVP, el unico minijuego implementado es **El Impostor**.

---

## Decisiones de Arquitectura

| Decision                | Eleccion                            | Motivo                                                      |
| ----------------------- | ----------------------------------- | ----------------------------------------------------------- |
| Estructura de codigo    | Monorepo con Turborepo              | Tipos compartidos, desarrollo local unificado               |
| Frontend                | Next.js 14+ (App Router)            | SSR, routing moderno, deploy facil en Vercel                 |
| Backend                 | NestJS con Socket.io                | WebSockets nativos, modularidad, escalabilidad               |
| Estilos                 | TailwindCSS + Framer Motion         | Desarrollo rapido, animaciones fluidas y modernas            |
| Comunicacion real-time  | Socket.io                           | Rooms nativas, reconexion automatica, fallback a polling     |
| Avatares                | Set predefinido (~24 iconos)        | Rapido de implementar, buena estetica                        |
| Modo voz                | Solo control de flujo               | Audio externo (Discord/presencial), sin WebRTC               |
| Persistencia MVP        | In-memory en NestJS                 | Cero infraestructura extra, perfecto para MVP                |
| Idiomas                 | Multilenguaje desde el inicio       | Selector de idioma, contenido y UI localizados               |
| Deploy frontend         | Vercel                              | Optimizado para Next.js                                      |
| Deploy backend          | Railway                             | NestJS necesita servidor persistente para WebSockets         |

> **Nota sobre deploy del backend**: Vercel es serverless y no soporta WebSockets persistentes. El backend NestJS debe deployarse en un servicio que soporte procesos long-running. Railway (recomendado) ofrece free tier y deploy desde Git.

---

## Stack Tecnico

### Core
- **Next.js 14+** - Frontend con App Router
- **NestJS** - Backend con WebSocket Gateway
- **Socket.io** - Comunicacion real-time bidireccional
- **Turborepo** - Gestion del monorepo
- **TypeScript** - Tipado en todo el proyecto

### Frontend
- **TailwindCSS** - Utilidades CSS
- **Framer Motion** - Animaciones
- **next-intl** - Internacionalizacion
- **socket.io-client** - Cliente WebSocket
- **zustand** - Estado global del cliente (ligero, simple)

### Backend
- **@nestjs/websockets** + **@nestjs/platform-socket.io** - Gateway WebSocket
- **class-validator** + **class-transformer** - Validacion de DTOs
- **uuid** - Generacion de IDs

### Compartido (paquete `@amonglies/shared`)
- Tipos TypeScript (Room, Player, GameState, Events)
- Constantes (limites, defaults)
- Listas de palabras por idioma y categoria
- Definiciones de juegos

---

## Estructura del Monorepo

```
AmongLies/
├── apps/
│   ├── web/                          # Next.js frontend
│   │   ├── app/
│   │   │   ├── [locale]/             # Rutas internacionalizadas
│   │   │   │   ├── page.tsx          # Landing page
│   │   │   │   ├── join/
│   │   │   │   │   └── page.tsx      # Unirse por codigo
│   │   │   │   └── room/
│   │   │   │       └── [code]/
│   │   │   │           └── page.tsx  # Sala de juego
│   │   │   ├── layout.tsx
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── ui/                   # Componentes reutilizables (Button, Modal, Input...)
│   │   │   ├── layout/               # Header, Footer, LanguageSelector
│   │   │   ├── lobby/                # PlayerList, GameSelector, RoomSettings
│   │   │   ├── game/                 # Componentes genericos de juego
│   │   │   └── impostor/             # Componentes especificos de El Impostor
│   │   ├── hooks/                    # useSocket, useRoom, useGame, useLocale
│   │   ├── stores/                   # Zustand stores (player, room, game)
│   │   ├── lib/                      # Utilidades, socket manager
│   │   ├── messages/                 # Traducciones UI (es.json, en.json, pt.json)
│   │   └── public/
│   │       ├── avatars/              # SVGs de avatares predefinidos
│   │       └── sounds/               # Efectos de sonido
│   │
│   └── server/                       # NestJS backend
│       └── src/
│           ├── main.ts
│           ├── app.module.ts
│           ├── room/                 # Modulo de salas
│           │   ├── room.module.ts
│           │   ├── room.gateway.ts   # WebSocket gateway para salas
│           │   ├── room.service.ts   # Logica de salas (crear, unirse, salir)
│           │   └── room.store.ts     # Store in-memory de salas
│           ├── chat/                 # Modulo de chat global
│           │   ├── chat.module.ts
│           │   └── chat.gateway.ts
│           ├── game/                 # Modulo de juegos (abstracto)
│           │   ├── game.module.ts
│           │   ├── game.gateway.ts   # WebSocket gateway para eventos de juego
│           │   ├── game.service.ts   # Orquestador de juegos
│           │   ├── game.registry.ts  # Registro de juegos disponibles
│           │   └── engines/          # Motores de juego especificos
│           │       └── impostor/
│           │           ├── impostor.engine.ts
│           │           ├── impostor.types.ts
│           │           └── impostor.constants.ts
│           ├── player/               # Modulo de jugadores/sesiones
│           │   ├── player.module.ts
│           │   └── player.service.ts
│           └── i18n/                 # Servicio de contenido por idioma
│               └── i18n.service.ts
│
├── packages/
│   └── shared/                       # Paquete compartido
│       ├── src/
│       │   ├── types/
│       │   │   ├── room.ts           # Room, RoomSettings, RoomState
│       │   │   ├── player.ts         # Player, PlayerRole
│       │   │   ├── game.ts           # GameDefinition, GameInstance, GamePhase
│       │   │   ├── impostor.ts       # ImpostorState, ImpostorAction
│       │   │   ├── chat.ts           # ChatMessage
│       │   │   └── events.ts         # Todos los eventos Socket.io tipados
│       │   ├── constants/
│       │   │   ├── games.ts          # Metadata de juegos disponibles
│       │   │   ├── avatars.ts        # Lista de avatares disponibles
│       │   │   └── defaults.ts       # Valores por defecto (timers, limites)
│       │   ├── word-lists/           # Listas de palabras
│       │   │   ├── index.ts
│       │   │   ├── es/               # Espanol
│       │   │   │   ├── animales.ts
│       │   │   │   ├── comida.ts
│       │   │   │   ├── paises.ts
│       │   │   │   ├── deportes.ts
│       │   │   │   ├── profesiones.ts
│       │   │   │   ├── peliculas.ts
│       │   │   │   ├── objetos.ts
│       │   │   │   └── marcas.ts
│       │   │   ├── en/               # Ingles
│       │   │   │   ├── animals.ts
│       │   │   │   ├── food.ts
│       │   │   │   ├── countries.ts
│       │   │   │   ├── sports.ts
│       │   │   │   ├── professions.ts
│       │   │   │   ├── movies.ts
│       │   │   │   ├── objects.ts
│       │   │   │   └── brands.ts
│       │   │   └── pt/               # Portugues
│       │   │       └── ...
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── turbo.json
├── package.json
├── .gitignore
├── PLAN_MVP.md
└── README.md
```

---

## Identidad Visual

### Paleta de Colores - "Neon Noir"

Estetica oscura y misteriosa (deduccion, mentiras) con acentos vibrantes y neon (diversion, modernidad).

| Rol              | Color     | Hex       | Uso                                         |
| ---------------- | --------- | --------- | ------------------------------------------- |
| Background       | Deep Navy | `#0A0A1A` | Fondo principal                              |
| Surface          | Dark Slate| `#161629` | Cards, paneles, modales                      |
| Surface Light    | Slate     | `#1E1E3A` | Hover, bordes, inputs                        |
| Primary          | Violet    | `#8B5CF6` | Botones principales, links, acentos          |
| Primary Light    | Lavender  | `#A78BFA` | Hover de primary                             |
| Secondary        | Cyan      | `#06B6D4` | Elementos secundarios, badges, info          |
| Accent           | Hot Pink  | `#EC4899` | Impostor, alertas especiales, highlights     |
| Success          | Emerald   | `#10B981` | Jugadores normales, confirmaciones           |
| Warning          | Amber     | `#F59E0B` | Timers, advertencias                         |
| Danger           | Red       | `#EF4444` | Errores, expulsion, eliminar                 |
| Text Primary     | White     | `#F8FAFC` | Texto principal                              |
| Text Secondary   | Gray      | `#94A3B8` | Texto secundario, placeholders               |
| Text Muted       | Dark Gray | `#475569` | Texto deshabilitado                          |

### Tipografia
- **Titulos / Logo**: Font bold y geometrica (ej: `Space Grotesk` o `Outfit`)
- **Cuerpo**: `Inter` - legible, moderna, excelente en pantalla
- **Monospace** (codigos de sala): `JetBrains Mono` o `Fira Code`

### Principios de Diseno
- Bordes redondeados generosos (16px+)
- Sombras con glow sutil en color primary/accent
- Transiciones suaves en todo (200-300ms)
- Fondos con gradientes sutiles y/o patrones geometricos
- Animaciones de entrada para cards y elementos
- Feedback visual inmediato en todas las acciones
- Responsive mobile-first

---

## Modelo de Datos (Tipos Compartidos)

### Player
```typescript
interface Player {
  id: string;              // UUID generado al conectar
  nickname: string;        // Apodo elegido por el jugador
  avatarId: string;        // ID del avatar predefinido
  locale: Locale;          // Idioma preferido
  isAdmin: boolean;        // Si es admin de la sala
  isConnected: boolean;    // Estado de conexion
}

type Locale = 'es' | 'en' | 'pt';
```

### Room
```typescript
interface Room {
  id: string;              // UUID interno
  code: string;            // Codigo de 6 caracteres (ej: "ABCD12")
  adminId: string;         // Player ID del admin
  players: Player[];       // Jugadores en la sala
  state: RoomState;        // Estado de la sala
  settings: RoomSettings;  // Configuracion
  currentGame: GameInstance | null;
  chat: ChatMessage[];     // Historial de chat global
  createdAt: number;       // Timestamp
}

type RoomState = 'lobby' | 'playing' | 'finished';

interface RoomSettings {
  maxPlayers: number;      // 0 = sin limite
  isPrivate: boolean;      // Si aparece en lista publica (futuro)
  locale: Locale;          // Idioma de la sala
}
```

### Game (Abstracto)
```typescript
interface GameDefinition {
  id: string;                          // 'impostor', 'drawguess', etc.
  name: Record<Locale, string>;
  description: Record<Locale, string>;
  minPlayers: number;
  maxPlayers: number | null;           // null = sin limite
  supportedModes: CommunicationMode[];
  settingsSchema: GameSettingSchema[]; // Define que settings tiene cada juego
  availableLocales: Locale[];          // En que idiomas esta disponible
}

type CommunicationMode = 'chat' | 'voice';

interface GameSettingSchema {
  key: string;
  label: Record<Locale, string>;
  type: 'number' | 'boolean' | 'select';
  default: unknown;
  min?: number;
  max?: number;
  options?: { value: string; label: Record<Locale, string> }[];
}
```

### El Impostor (Especifico)
```typescript
interface ImpostorGameState {
  phase: ImpostorPhase;
  round: number;
  totalRounds: number;
  secretWord: string;
  impostorIds: string[];              // Puede haber mas de 1
  turnOrder: string[];                // Player IDs en orden
  currentTurnIndex: number;
  wordsUsed: { playerId: string; word: string }[];
  votes: Record<string, string>;      // voterId -> votedId
  results: RoundResult[];
  settings: ImpostorSettings;
  communicationMode: CommunicationMode;
}

type ImpostorPhase =
  | 'word-reveal'      // Cada jugador ve su palabra (o "Eres el impostor")
  | 'turns'            // Turno por turno dicen/escriben palabras
  | 'discussion'       // Discusion libre
  | 'voting'           // Votacion
  | 'vote-results'     // Resultados de la votacion
  | 'round-end'        // Resumen de la ronda
  | 'game-end';        // Fin del juego

interface ImpostorSettings {
  rounds: number;                     // Numero de rondas (default: 3)
  impostorCount: number;              // Cantidad de impostores (default: 1, configurable por admin)
  turnTimeSeconds: number;            // Tiempo por turno en modo chat (default: 30)
  discussionTimeSeconds: number;      // Tiempo de discusion (default: 120)
  votingTimeSeconds: number;          // Tiempo de votacion (default: 30)
  wordRevealTimeSeconds: number;      // Tiempo para ver la palabra (default: 10)
  selectedWordLists: string[];        // IDs de las listas de palabras elegidas
  communicationMode: CommunicationMode;
}

interface RoundResult {
  round: number;
  word: string;
  impostorIds: string[];
  votedOutId: string | null;
  impostorGuessedWord: boolean;
  winner: 'impostor' | 'players';
}
```

### Eventos Socket.io
```typescript
// Client -> Server
interface ClientEvents {
  // Room
  'room:create': (data: { nickname: string; avatarId: string; locale: Locale }) => void;
  'room:join': (data: { code: string; nickname: string; avatarId: string; locale: Locale }) => void;
  'room:leave': () => void;
  'room:kick': (data: { playerId: string }) => void;
  'room:update-settings': (data: Partial<RoomSettings>) => void;
  'room:transfer-admin': (data: { playerId: string }) => void;

  // Chat
  'chat:send': (data: { message: string }) => void;

  // Game
  'game:select': (data: { gameId: string }) => void;
  'game:update-settings': (data: Record<string, unknown>) => void;
  'game:start': () => void;
  'game:action': (data: GameAction) => void;

  // Impostor-specific actions (via game:action)
  // { type: 'submit-word', word: string }
  // { type: 'ready' }           -- en modo voz, jugador listo
  // { type: 'vote', targetId: string }
  // { type: 'impostor-guess', word: string }
}

// Server -> Client
interface ServerEvents {
  // Room
  'room:created': (data: { room: Room; playerId: string }) => void;
  'room:joined': (data: { room: Room; playerId: string }) => void;
  'room:player-joined': (data: { player: Player }) => void;
  'room:player-left': (data: { playerId: string }) => void;
  'room:updated': (data: { room: Room }) => void;
  'room:error': (data: { message: string; code: string }) => void;

  // Chat
  'chat:message': (data: ChatMessage) => void;

  // Game
  'game:state-update': (data: PlayerGameView) => void;
  'game:phase-change': (data: { phase: string; data: unknown }) => void;
  'game:ended': (data: { results: unknown }) => void;
  'game:error': (data: { message: string }) => void;

  // System
  'player:reconnected': (data: { playerId: string }) => void;
  'player:disconnected': (data: { playerId: string }) => void;
}
```

---

## Flujo del Juego "El Impostor"

### Modo Chat (Texto)

```
[LOBBY]
  Admin selecciona juego "El Impostor"
  Admin configura: rondas, timers, listas de palabras, modo chat
  Admin presiona "Iniciar Juego"
      |
      v
[WORD REVEAL] (timer: wordRevealTimeSeconds)
  Servidor elige palabra al azar de las listas seleccionadas
  Servidor elige impostor(es) al azar
  Cada jugador ve en su pantalla:
    - Jugador normal: "La palabra es: MANZANA"
    - Impostor: "Eres el impostor. Descubre la palabra."
      Si hay multiples impostores, cada impostor ve quienes son los otros impostores.
  Timer termina -> siguiente fase
      |
      v
[TURNS] (timer: turnTimeSeconds por turno)
  Orden aleatorio de turnos (generado por servidor)
  Pantalla muestra quien tiene el turno actual
  Jugador activo escribe una palabra en input
  Servidor valida:
    - No esta vacia
    - No fue usada por otro jugador en esta ronda
    - No es la palabra secreta (para no-impostores, advertencia)
  Palabra aparece junto al avatar del jugador para todos
  Si se agota el timer: se salta el turno (cuenta como sospechoso)
  Cuando todos jugaron -> siguiente fase
      |
      v
[DISCUSSION] (timer: discussionTimeSeconds)
  Chat de discusion especifico de la ronda (separado del chat global)
  Los jugadores debaten quien es el impostor
  Timer visible con countdown
  Timer termina -> siguiente fase
      |
      v
[VOTING] (timer: votingTimeSeconds)
  Cada jugador vota por quien cree que es el impostor
  Seleccionan un jugador de una lista con sus avatares
  No pueden votar por si mismos
  Timer termina: votos no emitidos = abstencion
      |
      v
[VOTE RESULTS]
  Se revela por quien voto cada persona
  El jugador con mas votos es "acusado"
    - Si es impostor: jugadores ganan la ronda
    - Si no es impostor: impostor gana la ronda
  En caso de empate: nadie es eliminado, impostor gana la ronda
  Mostrar el puntaje acumulado
  Mostrar la palabra secreta
      |
      v
  Si quedan mas rondas -> [WORD REVEAL] con nueva palabra
  Si no -> [GAME END]
      |
      v
[GAME END]
  Resumen final: rondas ganadas por cada bando
  Podio / ranking de jugadores
  Boton "Volver al Lobby" -> [LOBBY]
```

### Modo Voz/Verbal

Identico al modo chat con estas diferencias:

- **[TURNS]**: En lugar de escribir, cada jugador dice su palabra en voz alta. La UI solo muestra de quien es el turno con un indicador grande y visual. El jugador presiona "Listo" cuando termino, o el admin puede avanzar manualmente. No hay validacion de palabras repetidas (se confida en los jugadores).
- **[DISCUSSION]**: No hay chat de discusion. Solo el timer cuenta regresiva mientras hablan entre ellos. Se puede omitir esta fase si el admin configura discussion time en 0.
- **Todo lo demas es igual**: La votacion es en-app, la revelacion de palabra es en-app.

---

## Listas de Palabras MVP

### Categorias y cantidad objetivo

| Categoria (ES/EN) | Palabras aprox. |
| --- | --- |
| Animales / Animals | ~50 |
| Comida y Bebidas / Food & Drinks | ~50 |
| Paises y Ciudades / Countries & Cities | ~50 |
| Deportes / Sports | ~40 |
| Profesiones / Professions | ~40 |
| Peliculas y Series / Movies & Shows | ~40 |
| Objetos Cotidianos / Everyday Objects | ~50 |
| Marcas Famosas / Famous Brands | ~40 |

Cada categoria disponible en ES, EN y PT.
El admin selecciona 1 o mas categorias antes de iniciar. El servidor combina las palabras de las categorias elegidas y elige al azar de ese pool.

---

## Sistema de Internacionalizacion (i18n)

### Alcance
1. **UI del sitio** (next-intl): Todos los textos de interfaz, botones, labels, errores
2. **Contenido de juego**: Nombres de juegos, descripciones, instrucciones
3. **Listas de palabras**: Cada lista existe por idioma
4. **Mensajes del servidor**: Errores y notificaciones del backend

### Idiomas MVP
- Espanol (es) - principal
- Ingles (en)
- Portugues (pt)

### Flujo
1. Usuario entra al sitio -> detecta idioma del navegador
2. Puede cambiar idioma con selector en el header
3. Idioma se guarda en localStorage
4. Al crear/unirse a sala, su locale se envia al servidor
5. El admin elige el idioma de la sala (afecta las listas de palabras disponibles)
6. UI de cada jugador se muestra en su idioma personal, independiente del idioma de la sala

---

## Pantallas del Frontend

### 1. Landing Page (`/`)
- Logo AmongLies con animacion de entrada
- Subtitulo: "Juega, miente, descubre."
- Input de apodo + selector de avatar
- Boton "Crear Sala" (prominente)
- Boton "Unirse a Sala" -> abre input de codigo
- Selector de idioma en esquina superior
- Footer minimo con creditos del grupo

### 2. Seleccion de Avatar (Modal o inline)
- Grid de avatares predefinidos
- Cada uno con borde highlight al seleccionar
- Avatar seleccionado aparece en grande

### 3. Lobby de Sala (`/room/[code]`)
- **Header**: Codigo de sala copiable, boton compartir link, nombre de la sala
- **Panel izquierdo/superior**: Lista de jugadores con avatares y apodos, admin marcado con corona
- **Panel central**: Selector de juego (cards con icono, nombre, descripcion)
- **Panel derecho/inferior**: Configuracion del juego seleccionado (solo admin)
  - Sliders para timers
  - Selector de categorias de palabras (checkboxes)
  - Selector modo chat/voz
  - Numero de rondas
  - Cantidad de impostores (configurable segun cantidad de jugadores)
- **Footer**: Boton "Iniciar Juego" (solo admin, deshabilitado si <4 jugadores)
- **Chat global**: Panel lateral colapsable

### 4. Juego en Curso - El Impostor

#### 4a. Word Reveal
- Pantalla centrada con la palabra en grande (o "Eres el impostor")
- Si hay multiples impostores, el impostor ve la lista de sus companeros impostores
- Timer circular
- Animacion de carta que se voltea

#### 4b. Turns (Chat Mode)
- Lista de turnos: jugadores en orden, los que ya jugaron muestran su palabra
- Input de texto para el jugador activo
- Timer por turno
- Indicador visual de quien tiene el turno

#### 4c. Turns (Voice Mode)
- Avatar grande del jugador activo con indicador "Es tu turno de hablar"
- Boton "Listo" para el jugador activo
- Boton "Siguiente" para el admin (override)
- Lista de jugadores con check de quien ya hablo

#### 4d. Discussion
- Timer grande de countdown
- Chat de discusion (modo chat) o simplemente el timer (modo voz)

#### 4e. Voting
- Grid de jugadores votables (todos menos tu)
- Seleccionar y confirmar voto
- Indicador de quienes ya votaron (sin revelar por quien)
- Timer

#### 4f. Results
- Revelar votos con animacion
- Revelar si el acusado era impostor o no
- Revelar la palabra secreta
- Puntaje acumulado
- Boton "Siguiente Ronda" / "Ver Resultados Finales"

### 5. Game End
- Podio animado (1ro, 2do, 3ro)
- Resumen de todas las rondas
- Boton "Volver al Lobby"
- Boton "Revancha" (mismo juego, misma config)

---

## Fases de Desarrollo

### Fase 0: Setup del Monorepo (1-2 dias)
- [ ] Inicializar Turborepo con estructura de carpetas
- [ ] Configurar apps/web (Next.js 14 + TailwindCSS + Framer Motion)
- [ ] Configurar apps/server (NestJS + Socket.io)
- [ ] Configurar packages/shared (tipos, constantes)
- [ ] Configurar next-intl con ES, EN, PT
- [ ] Script de desarrollo unificado (`turbo dev`)
- [ ] Configurar ESLint y TypeScript compartidos
- [ ] Eliminar el proyecto Vite actual y migrar

### Fase 1: UI Base y Landing (2-3 dias)
- [ ] Implementar sistema de diseno (colores, tipografia, componentes base)
- [ ] Componentes UI: Button, Input, Modal, Card, Avatar, Badge, Tooltip
- [ ] Layout principal con header, language selector, responsive
- [ ] Landing page con animaciones
- [ ] Flujo de entrada: nickname + avatar
- [ ] Pantalla de join por codigo
- [ ] Guardar preferencias en localStorage (idioma, ultimo nickname, ultimo avatar)

### Fase 2: Backend - Salas y Conexion (2-3 dias)
- [ ] Room module: crear, unirse, salir, kick, transferir admin
- [ ] Room store in-memory con cleanup automatico de salas inactivas
- [ ] Generacion de codigos de sala unicos (6 chars alfanumericos)
- [ ] Player module: sesion por socket, reconexion
- [ ] Chat module: mensajes globales de sala
- [ ] Validaciones: nickname no vacio, sala existe, sala no llena, etc.
- [ ] Manejo de desconexiones y reconexiones (grace period de 30s)

### Fase 3: Frontend - Lobby de Sala (2-3 dias)
- [ ] Hook useSocket: conexion, reconexion, estado
- [ ] Hook useRoom: crear, unirse, estado de sala
- [ ] Store de room con zustand
- [ ] Pantalla de lobby completa
- [ ] Lista de jugadores en tiempo real
- [ ] Chat global funcional
- [ ] Compartir link / codigo
- [ ] Controles de admin (kick, transferir admin)

### Fase 4: Game Engine y El Impostor Backend (3-4 dias)
- [ ] Game registry: sistema para registrar juegos disponibles
- [ ] Game service: orquestador (iniciar, acciones, estado por jugador)
- [ ] GameEngine interface abstracta para futuros juegos
- [ ] Impostor engine: toda la logica del juego
  - [ ] Seleccion de palabra del pool
  - [ ] Asignacion de impostor(es)
  - [ ] Maquina de estados (phases)
  - [ ] Validacion de palabras (chat mode)
  - [ ] Timer management
  - [ ] Sistema de votacion
  - [ ] Calculo de resultados y puntaje
- [ ] Listas de palabras: todas las categorias en ES, EN, PT
- [ ] Selector de juego: UI de admin para elegir juego y configurar

### Fase 5: Frontend - El Impostor Gameplay (4-5 dias)
- [ ] Hook useGame: estado de juego, acciones
- [ ] Pantalla de revelacion de palabra (con animacion)
- [ ] Pantalla de turnos (modo chat): input, validacion, historial
- [ ] Pantalla de turnos (modo voz): indicador visual, boton listo
- [ ] Pantalla de discusion: timer + chat o solo timer
- [ ] Pantalla de votacion: grid de jugadores, confirmar voto
- [ ] Pantalla de resultados de votacion: animacion de revelar
- [ ] Pantalla de fin de ronda y fin de juego
- [ ] Sistema de puntuacion visual
- [ ] Configuracion de juego por admin (UI de settings)

### Fase 6: Polish y UX (2-3 dias)
- [ ] Animaciones de transicion entre fases
- [ ] Efectos de sonido (timer, turno, votacion, resultado)
- [ ] Notificaciones (es tu turno, te votaron, etc.)
- [ ] Manejo de edge cases:
  - [ ] Jugador se desconecta durante partida
  - [ ] Admin se desconecta (transferir a otro)
  - [ ] Menos de 4 jugadores durante partida
  - [ ] Impostor se desconecta
- [ ] Optimizacion mobile
- [ ] Loading states y skeleton screens
- [ ] Mensajes de error amigables

### Fase 7: Testing y Deploy (1-2 dias)
- [ ] Tests unitarios de la logica del juego (impostor engine)
- [ ] Test manual end-to-end del flujo completo
- [ ] Deploy Next.js a Vercel
- [ ] Deploy NestJS a Railway
- [ ] Configurar variables de entorno
- [ ] CORS y seguridad basica
- [ ] Dominio personalizado (si aplica)

### Total estimado: 17-23 dias de desarrollo

---

## Consideraciones para el Futuro (Post-MVP)

Estas decisiones de arquitectura facilitan la expansion futura:

### Nuevos Juegos
El `GameEngine` abstracto permite agregar juegos sin tocar la infraestructura:
1. Crear nuevo engine en `server/src/game/engines/nuevo-juego/`
2. Registrarlo en `game.registry.ts`
3. Agregar componentes frontend en `web/components/nuevo-juego/`
4. Agregar tipos en `shared/types/nuevo-juego.ts`
5. El selector de juego en el lobby automaticamente lo lista

### Sistema de Cuentas
- Integrar Supabase Auth cuando se necesite
- El `Player` ya tiene estructura extensible (agregar `userId`, `email`, etc.)
- Los datos in-memory migraran a Supabase PostgreSQL

### Workshop
- Supabase para guardar listas de palabras y personalizaciones
- Sistema de publicar/descargar con likes y categorias
- Las listas ya tienen estructura estandar, solo falta el CRUD

### Mas Personalizacion
- El `GameSettingSchema` ya soporta settings dinamicos por juego
- Solo hay que agregar mas opciones al schema de cada juego

### Escalabilidad
- Migrar de in-memory a Redis para estado de salas
- Multiples instancias de NestJS con Redis adapter para Socket.io
- CDN para assets estaticos

---

## Proximos Pasos Inmediatos

1. Confirmar este plan
2. Comenzar Fase 0: Setup del monorepo
3. Iterar fase por fase, testeando cada una antes de avanzar
