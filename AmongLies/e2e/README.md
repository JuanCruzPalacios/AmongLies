# Pruebas de punta a punta (e2e)

Juegan partidas reales: un navegador (Playwright + Chromium) maneja la página
como un jugador y los demás jugadores son bots que se conectan por Socket.io.
Cada suite imprime sus checks (`OK` / `FAIL`) y termina con `N/M checks OK`.

## Cómo correrlas

```bash
npm ci
npx playwright install chromium        # una sola vez
npm run build
(cd apps/server && node dist/main.js) &   # http://localhost:3001
(cd apps/web && npx next start) &         # http://localhost:3000

node e2e/run.cjs              # invitados (+ cuentas si hay clave de Supabase)
node e2e/run.cjs invitados    # las que corre el CI
node e2e/run.cjs cuentas      # las que usan cuentas temporales de Supabase
node e2e/run.cjs dibujo chat  # las que se nombren
```

Las capturas quedan en `e2e/output/` (no se commitean).

| Variable | Para qué |
| --- | --- |
| `E2E_WEB`, `E2E_SERVER` | Contra qué web y servidor probar (por defecto, localhost). Con las URLs de Render prueban producción. |
| `E2E_SERVER_STOP`, `E2E_SERVER_START` | Comandos de shell para apagar y prender el servidor. Sin ellos, `sala-perdida` se saltea. |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Sólo para las suites con cuentas. Si no están, se leen de `apps/server/.env`. |

## Suites

**Invitados** (no tocan la base; las corre el CI en cada push):

| Suite | Qué prueba |
| --- | --- |
| `impostor` | Partida completa de El Impostor: turnos, discusión, votación, final y vuelta al lobby. |
| `tiempo` | Partida completa del juego de Tiempo (reloj, impostor que no conoce el tiempo). |
| `dibujo` / `dibujo-celular` | Partida de Dibujo en escritorio y en celular (táctil): tinta, trazos en vivo, adivinanzas. |
| `recarga` | Recargar la página en medio de la partida y seguir jugando. |
| `reconexion` | Cortes de conexión: el jugador vuelve a su lugar; el admin se transfiere si se va. |
| `servidor` | Reglas que valida el servidor (no confía en el cliente): turnos, votos, ajustes, admin. |
| `salas-publicas` | Listado de salas públicas, unirse desde la lista y desde el celular. |
| `chat` | Chat del lobby y del juego, mensajes largos (cortan línea) e interfaz en inglés. |
| `carrera-al-entrar` | Un mensaje enviado justo cuando el otro entra no se pierde. |
| `expulsado` | El anfitrión saca a un jugador: vuelve al inicio con un aviso. |
| `sala-perdida` | El servidor se reinicia o está dormido: aviso de sala perdida y "Despertando el servidor…". |

**Cuentas** (crean cuentas temporales confirmadas en Supabase y las borran al terminar):

| Suite | Qué prueba |
| --- | --- |
| `cuenta-y-estadisticas` | Login, ajustes de la partida, puntaje y estadísticas guardadas en el perfil. |
| `amigos` | Solicitudes, presencia en vivo, invitar a la sala y eliminar amigos. |
| `workshop` | Crear, publicar, filtrar, like, copias, versiones, listas en el lobby y presets. |
| `moderacion` | Filtro de insultos, reportes, panel de admin, suspensiones y permisos en la base (RLS). |
| `ajustes` | Idioma, sonido, privacidad, cambio de contraseña y borrar la cuenta. |
