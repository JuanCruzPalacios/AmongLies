# Testing y guardrails de AmongLies

Este documento junta lo que piden las clases de **TDD** y **Testing en la era Gen AI**:
el ciclo TDD aplicado a una función del proyecto, la suite de tests con sus casos borde,
la prueba de mutación manual, los guardrails automáticos (hook pre-commit y CI) y la lista
de bugs que encontramos en nuestro propio código.

```bash
npm test                                         # todos los tests (desde AmongLies/)
npm run test:cov --workspace @amonglies/server   # con cobertura y umbral de ramas
```

---

## 1. TDD — `resolveVotes`

**Requerimiento (en una frase):** el jugador con más votos es expulsado; si hay empate en
el máximo, o nadie votó, no se expulsa a nadie.

Archivo: `apps/server/src/game/engines/core/votes.ts` · Tests: `votes.spec.ts`.
Cada fase quedó como un commit separado en `main`:

| Ciclo | Fase | Commit | Qué pasó |
|---|---|---|---|
| 1 | 🔴 RED | `test(red): resolveVotes expulsa al jugador más votado` | Un solo test. Falla con `Cannot find module './votes.js'`: la función no existe. Es la falla correcta. |
| 1 | 🟢 GREEN | `feat(green): resolveVotes mínimo que pasa el primer test` | `return { votedOutId: 'vale' }`. Hardcodeado a propósito: es lo mínimo que pasa el único test. |
| 2 | 🔴 RED | `test(red): casos borde de resolveVotes (empates, sin votos, conteo)` | 7 tests nuevos de caja negra y caja blanca. **6 de 8 fallan** contra el valor fijo. |
| 2 | 🟢 GREEN + 🔵 REFACTOR | `feat(green): resolveVotes cuenta votos y detecta empates en el máximo` | Implementación real (contar, buscar el máximo, ver si hay un único líder). 8/8 en verde. |

Casos que cubre la suite (origen entre paréntesis):

| Entrada | Esperado | Origen |
|---|---|---|
| 2 votos a `vale`, 1 a `ana` | expulsa a `vale` | caja negra |
| otro jugador más votado | expulsa a ese jugador (rompe el hardcodeo) | caja negra |
| un único voto | expulsa al votado | límite (1 elemento) |
| sin votos `{}` | nadie | límite (colección vacía) |
| 1 a 1 | nadie (empate) | caja negra |
| líder con 3, dos empatados con 1 | expulsa al líder | caja blanca: el empate sólo importa en el máximo |
| el empatado aparece después del líder | nadie | caja blanca: orden de inserción |
| conteo `{ vale: 2, ana: 1 }` | cantidades exactas | caja negra |

## 2. Suite de tests

266 tests en `apps/server/src/**/*.spec.ts`. Todos verifican **valores concretos**
(nada de `toBeDefined()`), incluyen el camino de error y los bordes.

| Archivo | Qué prueba | Bordes destacados |
|---|---|---|
| `core/votes.spec.ts` | Conteo de votos y empates (TDD) | colección vacía, 1 elemento, empate en el máximo vs. debajo |
| `core/rules.spec.ts` | Condición de fin de partida y máximo de impostores | paridad exacta 1 vs 1, una ronda antes del tope, tope 0 = sin límite, eliminar al último impostor justo en la ronda tope, 0 a 7 jugadores |
| `game/settings.spec.ts` | Validación de ajustes contra el schema | mínimo/máximo exactos y ±1, decimales, `'3'`, `null`, `NaN`, `Infinity`, claves extra, payload que no es objeto, listas de otro idioma, ids repetidos |
| `room/room.validation.spec.ts` | Apodo, avatar, idioma y ajustes de sala | apodo de 1, 2, 16 y 17 caracteres, sólo espacios, acentos y emojis, avatar inexistente, idioma `pt` |
| `core/votes.spec.ts` (Fase 2) | `decideVoteOutcome`: "saltear", empate con re-voto, re-voto que vuelve a empatar, empate de un jugador con "saltear", desempate al azar | azar inyectado (`random: () => 0` / `0.99`) para que sea determinístico |
| `core/scoring.spec.ts` | Puntos por ronda y bonus de partida | impostor expulsado, impostor que vota a su cómplice, impostor eliminado en una ronda anterior, partida sin jugadores |
| `core/timers.spec.ts` | Timers pausables | pausar a los 600 de 1000 ms → faltan exactamente 400; timer creado durante la pausa; pausar dos veces |
| `auth/token-verifier.spec.ts` | Verificación del JWT de Supabase (claves ES256 generadas en el test) | firmado con otra clave, otro issuer, otra audience, vencido, modificado después de firmar, texto que no es JWT |
| `room/decider.spec.ts` | Quién decide si se sigue sin un desconectado | admin desconectado, el más antiguo también desconectado, nadie conectado |
| `impostor/impostor.engine.spec.ts` | El motor completo con timers simulados (`jest.useFakeTimers`), incluida la pausa y la salida de jugadores a mitad de partida | el impostor nunca recibe la palabra, votos ocultos durante la votación, empate → nueva ronda, tope de rondas, votos a uno mismo, a jugadores inexistentes o dobles, pistas que no son texto, eliminados sin voto ni chat, `advance` sólo del admin |
| `time/time.rules.spec.ts` (Fase 3) | Elegir el tiempo objetivo y aceptar el tiempo informado | mínimo = máximo, mínimo y máximo invertidos, décimas exactas, tiempo informado negativo, mayor al que pasó en el servidor, que no es número |
| `time/time.engine.spec.ts` (Fase 3) | El juego de Tiempo con timers simulados | el impostor nunca recibe el objetivo, sólo el de turno arranca/para, parar sin arrancar, turno vencido sin arrancar y con el reloj corriendo, pausa con el reloj en marcha, estado emitido al pasar de turno |
| `drawing/ink.spec.ts` (Fase 4) | Tinta del Dibujo (la usan el servidor y el navegador): validar puntos, medir y cortar en el presupuesto | lista impar, vacía, `NaN`, `Infinity`, texto; puntos fuera del lienzo; horizontal vs. vertical (lienzo 4:3); tinta justa, sin tinta, pasos diminutos repetidos |
| `drawing/drawing.engine.spec.ts` (Fase 4) | El juego de Dibujo con timers simulados | el impostor nunca recibe la palabra (tampoco en los resultados de la partida en curso), el lienzo sigue entre rondas y se vacía en la partida nueva, colores/grosores fuera de la paleta, color fijo por jugador, tinta entre varios trazos, tinta mínima 0 y 50 %, timer de seguridad, 2 vueltas por ronda, se va el que dibuja |
| `social/social.rules.spec.ts` (Fase 5) | Relación entre dos cuentas, presencia y búsqueda | amistad pedida por cualquiera de los dos, filas de terceros, desconectado dentro de una sala, sala en juego o terminada (no se pasa el código), búsqueda con `@`, `*`, `,` y `)` (no se cuelan en la consulta), 21 caracteres |
| `social/social.service.spec.ts` (Fase 5) | Solicitudes, aceptar/rechazar, eliminar y búsqueda, contra un repositorio en memoria | pedirse a uno mismo (sin importar mayúsculas), solicitud repetida, solicitudes cruzadas (quedan amigos), responder una solicitud propia, `accept` que no es `true`, cancelar una recibida, base caída → `unavailable` |
| `workshop/workshop.rules.spec.ts` (Fase 6) | Validar listas y presets del workshop | 9, 10, 300 y 301 palabras; repetidas con otras mayúsculas y vacías (no cuentan); palabra de 30 y 31 letras; título de 2/3/40/41; descripción de 200/201; idioma `pt`; categoría inventada → "other"; preset con valores fuera de rango, claves extra y listas de palabras (se descartan) |
| `workshop/workshop.service.spec.ts` (Fase 6) | Crear, editar, publicar, copiar, actualizar copias, likes y uso en salas, contra un repositorio en memoria | editar sólo el título no sube la versión; copiar algo privado de otro; copiar dos veces; copia editada → "modificada"; actualizar con el original despublicado; like doble; lista de otro idioma o privada de otro en una sala; un preset no sirve como lista; base caída |

Como los impostores se eligen al azar, la suite se corrió 5 veces seguidas para confirmar
que no hay tests que pasen "por casualidad".

### Cobertura de ramas

El CI exige un umbral de **cobertura de ramas** sólo en la lógica crítica (lo que decide
quién gana y qué datos se aceptan), no en todo el código:

| Módulo | Ramas cubiertas | Umbral del CI |
|---|---|---|
| `game/engines/core/` (votos y reglas) | 100 % | 100 % |
| `game/settings.ts` | 81 % | 80 % |
| `room/room.validation.ts` | 96 % | 90 % |

## 3. Prueba de mutación manual

Cambiamos un operador a propósito y corrimos la suite: si sigue en verde, falta un caso.
**Los 8 mutantes fueron detectados.**

| Archivo | Mutación | Tests que fallaron |
|---|---|---|
| `votes.ts` | `leaders.length === 1` → `>= 1` | 2 |
| `votes.ts` | `counts[id] === maxVotes` → `>= maxVotes - 1` | 2 |
| `votes.ts` | `(… ?? 0) + 1` → `+ 0` | 4 |
| `votes.ts` | `Math.max(0, …)` → `Math.min(Infinity, …)` | 3 |
| `rules.ts` | `impostores >= inocentes` → `>` | 1 |
| `rules.ts` | `round >= maxRounds` → `>` | 2 |
| `rules.ts` | `maxRounds > 0` → `>= 0` | 6 |
| `rules.ts` | `(jugadores - 1) / 2` → `jugadores / 2` | 5 |

## 4. Guardrails

### Análisis estático
- **ESLint** en web y server (el server incluye Prettier como regla). Al empezar había
  6 errores y 6 warnings en el web, y el server nunca se había formateado con su
  propio Prettier; hoy los dos están en 0.
- **TypeScript** en modo estricto en los tres paquetes; `npm run build` hace el type check.

### Hook pre-commit (`.githooks/pre-commit`)
Corre en ≈6 segundos: búsqueda de secretos en el diff → lint → tests unitarios.
Se activa solo al hacer `npm install` (script `prepare`, que ejecuta
`git config core.hooksPath .githooks`).

Comprobamos que **aborta el commit** en los tres casos:

| Prueba | Resultado |
|---|---|
| Variable sin usar agregada a `votes.ts` | ❌ commit abortado por `no-unused-vars` |
| Assert roto (mutación `=== 1` → `>= 1`) | ❌ commit abortado: 3 tests fallan |
| Una clave secreta de Supabase (`sb_secret_…`) asignada en un comentario | ❌ commit abortado: "posible credencial en el código" |

### Secretos (`scripts/check-secrets.sh`)
Busca claves secretas y `service_role` de Supabase, llaves privadas, tokens de GitHub y de
OpenAI, URLs de Postgres con contraseña y archivos `.env` versionados. Las claves
*publishable* / *anon* de Supabase son públicas por diseño y no se marcan.
`.env` está en `.gitignore`; sólo se commitean los `.env.example`.

### CI (`.github/workflows/ci.yml`)
En cada push a `main` y en cada pull request:
secretos → lint → type check + build → tests con umbral de ramas → `npm audit` de producción.

> Para que el CI bloquee merges hay que activarlo en GitHub:
> *Settings → Branches → Add rule → Require status checks to pass before merging* → `verificar`.

**Auditoría de dependencias:** al configurar el CI, `npm audit` encontró 30 vulnerabilidades
(2 críticas, entre ellas RCE en Next.js < 16.3.6). Se actualizó Next a 16.3.6 y se corrió
`npm audit fix`: **las dependencias de producción quedaron en 0**. Las que quedan están en
herramientas de desarrollo (el linter) y no tienen arreglo publicado, por eso el CI audita
con `--omit=dev`.

## 5. Bugs encontrados en nuestro código

Todos estaban en el MVP; ninguno rompía la compilación del servidor.

| # | Bug | Cómo se encontró | Arreglo |
|---|---|---|---|
| 1 | El build del web fallaba (`room` posiblemente `null`) | `next build` | tipar el callback con `Room` |
| 2 | Los separadores "Partida X · Ronda Y" nunca llegaban al chat: el servidor emitía `room:chat` y el cliente escuchaba `chat:message` | review manual | emitir `chat:message` |
| 3 | Cualquier jugador podía mandar `game:back-to-lobby` y cortar la partida de todos | review manual | chequeo de admin + test e2e |
| 4 | En modo voz cualquier jugador podía saltear al que hablaba | review manual | `advance` sólo del admin + test |
| 5 | `room:update-settings` aceptaba cualquier cosa (`as any`) | linter + review | `sanitizeRoomSettings` + tests |
| 6 | Los ajustes del juego no se validaban (partidas = 999, strings, claves extra) | casos borde | `sanitizeGameSettings` contra el schema + tests |
| 7 | `chat:send` con un `message` que no es texto tiraba `TypeError` en el handler | casos borde (tipo incorrecto) | validar el tipo |
| 8 | `room:kick` / `room:transfer-admin` con payload `null` tiraban `TypeError` | casos borde (null) | validar el payload |
| 9 | Se podía votar a un jugador inexistente y el voto contaba | casos borde | validar que el votado esté activo + test |
| 10 | Los eliminados podían chatear (sólo se ocultaba el input en el cliente) | review manual | `canChat` validado en el servidor + test |
| 11 | La pantalla de fin de juego nunca se veía: la sala volvía al lobby y el cliente saltaba directo | prueba en el navegador | mostrarla mientras la fase sea `game-end` |
| 12 | Con 4 jugadores se podían configurar hasta 5 impostores → la partida empezaba ya ganada por paridad | caso borde de `maxImpostorsFor` | `validateStart` + test |
| 13 | El ajuste `rounds` tenía tres valores por defecto distintos (1, 3 y 1) y en realidad significaba "partidas" | review manual | un solo schema como fuente de verdad (`partidas`, default 3) |
| 14 | El lobby mandaba los ajustes por defecto cada vez que el admin abría la pantalla | review manual | el lobby muestra lo que guarda el servidor |
| 15 | 2 vulnerabilidades críticas y 22 altas en dependencias | `npm audit` en el CI | Next 16.3.6 + `npm audit fix` |

| 16 | Al desconectarse, el jugador salía de la sala al instante y no podía volver (la constante de gracia existía pero no se usaba) | review manual | identidad estable + reconexión con pausa (Fase 1) |
| 17 | Los `<label>` de los formularios no estaban asociados a su `<input>` (lectores de pantalla y clic en la etiqueta) | el test de login en el navegador no encontraba los campos por su etiqueta | `useId` + `htmlFor` en `Input` |
| 18 | Tests de salida de jugadores que fallaban 1 de cada 3 veces: si el jugador sacado era el único impostor, la partida terminaba y el test pasaba por otra rama | correr la suite varias veces seguidas | 2 impostores entre 6 jugadores: el caso es el mismo saque a quien saque (25/25 corridas en verde) |
| 19 | `jose` v6 sólo viene como ESM y el servidor compila a CommonJS: en Node 20 fallaría al arrancar | Jest no podía cargarlo | `jose` v5 (misma API, con build CommonJS) |
| 20 | El cliente sólo usaba WebSocket (`transports: ["websocket", "polling"]` no cae a polling si falla): en redes que bloquean WebSockets (colegios, empresas) no se podía jugar | prueba en producción desde una red con proxy | transporte por defecto de Socket.io (HTTP primero, después sube a WebSocket) |
| 21 | Al mover `RoomGateway` de módulo, el CORS de Socket.io pasó a depender del orden de los providers y el polling por HTTP quedó bloqueado | la prueba del navegador al cambiar el transporte | `GATEWAY_OPTIONS` compartido por los tres gateways |
| 22 | Al pasar de turno el motor emitía el estado **antes** de preparar el turno nuevo: en el Tiempo, el siguiente jugador recibía el reloj del anterior como "corriendo", no podía tocar EMPEZAR y se le vencía el turno | una partida sólo con bots (dos de cuatro quedaban en el máximo) | `nextTurn` prepara el turno y después emite; test que revisa el estado en el momento en que se emite (falla sin el arreglo) |
| 23 | El perfil sólo mostraba las estadísticas del Impostor: las del Tiempo se guardaban pero no se veían | revisando el perfil al agregar el Dibujo | el perfil muestra un bloque por cada juego jugado |
| 24 | Volver a tocar en el lobby el juego que ya estaba elegido reiniciaba todos sus ajustes (y las listas elegidas) | el e2e del workshop: después de aplicar un preset, la palabra salía de las listas del juego | elegir el mismo juego no hace nada |
