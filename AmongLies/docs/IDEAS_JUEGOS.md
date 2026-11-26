# Ideas de juegos nuevos

Notas para sumar juegos a AmongLies más adelante: de qué trata cada uno, sus reglas y cómo
encaja en la arquitectura actual. No es documentación definitiva; cuando se implemente uno,
se documenta como los demás (manual de usuario, catálogo de ventanas y arquitectura).

## Cómo se agrega un juego (vale para todos)

La arquitectura ya está preparada para esto (ADR-08, motores enchufables):

1. **Definición** en `packages/shared/src/constants/games.ts`: id, nombre, mínimo de jugadores
   y `settingsSchema` (el lobby arma los controles de configuración solo a partir de esto).
2. **Tipos** en `packages/shared/src/types/<juego>.ts`: fases, acciones y la vista por jugador.
3. **Motor** en `apps/server/src/game/engines/<juego>/`, que cumple la interfaz `GameEngine`
   (`start`, `handleAction`, `getStateForPlayer`, `pause`/`resume`, `removePlayer`…), y se
   registra en `game.registry.ts`. El servidor sigue siendo la única fuente de verdad: valida
   cada acción y le manda a cada jugador sólo lo que puede ver.
4. **Pantallas** en `apps/web/src/components/<juego>/` y textos en `lib/i18n.ts` (es/en).
5. **Pruebas**: unitarias del motor con timers simulados y una suite e2e con bots.

Dos cosas a resolver antes del primer juego que no sea de impostor:

- **Motor base común.** `DeductionEngine` mezcla lo que sirve para cualquier juego por turnos
  (partidas, rondas, turnos, timers, pausa por desconexión, puntaje) con lo propio de la
  deducción (roles ocultos, discusión, votación para expulsar). Conviene separar una clase base
  `RoundEngine` con lo general y que `DeductionEngine` la extienda; así los juegos nuevos
  reutilizan la pausa, la reconexión y los timers sin heredar los impostores.
- **Estadísticas.** `player_stats` tiene columnas pensadas para impostores
  (`partidas_as_impostor`, `correct_votes`…). Para juegos sin roles alcanza con guardar
  `games_played`, `partidas_played` y `total_points` (lo demás en 0), o agregar una columna
  `extra jsonb` para métricas propias (por ejemplo, "veces que engañaste" o "aciertos
  exactos") y mostrarlas en el perfil según el juego.

---

## 1. Dos verdades y una mentira

**De qué trata.** Cada jugador escribe tres frases sobre sí mismo: dos verdaderas y una falsa.
El resto tiene que descubrir cuál es la mentira. Es ideal para grupos que se conocen (o para
conocerse) y genera mucha conversación.

**Reglas**
1. *Escritura* (2 minutos): cada uno escribe 3 frases y marca cuál es la mentira.
2. *Turnos*: se muestran las 3 frases de un jugador, en orden aleatorio.
3. *Interrogatorio* (opcional, 60 s): los demás le hacen preguntas por chat o en voz; el autor
   puede defenderse e incluso mentir.
4. *Votación* (20 s): cada uno vota cuál frase es la mentira. El autor no vota.
5. *Revelación*: se muestra la mentira y quién votó qué.
6. Se repite con cada jugador. Gana quien más puntos suma.

**Puntaje**: +1 por adivinar la mentira de otro; el autor suma +1 por cada jugador que no la
adivinó (bonus si no la adivinó nadie).

**Configuración**: tiempo de escritura, con o sin interrogatorio, modo chat o voz, rondas
(una o varias vueltas, con frases nuevas).

**Implementación**
- Fases: `writing → presenting → questioning → voting → reveal → (siguiente) → game-end`.
- Acciones: `submit-statements { statements: [a, b, c], lieIndex }`, `vote { index }`.
- Vista por jugador: el `lieIndex` nunca sale del servidor hasta la revelación (igual que la
  palabra en El Impostor). Las frases se mezclan en el servidor.
- Validación: 3 frases de 5 a 120 caracteres, filtro de insultos (se censuran) y exactamente una
  mentira. Si alguien no escribe a tiempo, se saltea su turno.
- Reutiliza: votación (`core/votes`), timers, pausa por desconexión y chat.
- No necesita contenido: lo generan los jugadores.

---

## 2. Onda (estilo *Wavelength*)

**De qué trata.** Un juego cooperativo de "leer la mente": hay una escala entre dos extremos
(por ejemplo, *frío ↔ caliente*) y una posición secreta en esa escala. Un jugador da una pista
y el grupo tiene que ubicar dónde está.

**Reglas**
1. Cada ronda, un jugador es el **psíquico**: ve una escala (*"Aburrido ↔ Divertido"*) y un
   objetivo secreto en ella (un número de 0 a 100).
2. El psíquico da **una sola pista** que ubique el objetivo: si está cerca de "Divertido",
   podría decir *"un recreo"*. No puede decir números ni la posición.
3. El resto del grupo discute y mueve **un dial compartido** hasta acordar una posición.
   Cualquiera puede moverlo; el último confirma.
4. Se revela el objetivo. Puntos según la distancia: en el centro 4, cerca 3, más lejos 2.
5. El rol de psíquico rota. El grupo juega contra un objetivo de puntos o un número de rondas.

**Variante por equipos**: dos equipos se turnan; el equipo contrario puede apostar si el
objetivo está a la izquierda o a la derecha del dial para robar 1 punto.

**Configuración**: cantidad de rondas, tiempo para dar la pista y para mover el dial, modo
cooperativo o por equipos, pista por chat o en voz.

**Implementación**
- Fases: `clue → guessing → reveal → (siguiente psíquico) → game-end`.
- Acciones: `give-clue { text }`, `move-dial { value }`, `lock-dial`, y en equipos
  `bet { side }`.
- El dial se mueve en vivo: se reenvía la posición a la sala con un evento liviano (como los
  trazos del dibujo, `onDraw`), con límite de frecuencia, sin mandar todo el estado.
- Vista por jugador: el objetivo sólo lo ve el psíquico hasta la revelación.
- Contenido: listas de escalas por idioma (`packages/shared/src/word-lists/`, ~60 pares
  para empezar). Más adelante, escalas del workshop.
- Pantalla: un semicírculo con el dial (SVG), táctil en el celular.

---

## 3. En la frente (estilo *¿Quién soy?* / *Hedbanz*)

**De qué trata.** Cada jugador tiene "pegada en la frente" una carta que **ven todos menos él**:
un personaje, un objeto, un animal o una edad. Con preguntas de sí o no tiene que adivinar
qué es. Es el clásico juego de la vincha, pero la app reparte las cartas y las esconde.

**Reglas**
1. A cada jugador le toca una carta al azar de la categoría elegida (por ejemplo, *Personajes
   famosos*). En su pantalla ve las cartas de los demás, pero en lugar de la suya ve un "?".
2. Por turnos, el jugador hace **una pregunta de sí o no** sobre su carta ("¿Soy una persona
   real?", "¿Tengo más de 40 años?").
3. Los demás responden con botones **Sí / No / Más o menos**; se toma la respuesta de la
   mayoría (o el anfitrión decide en caso de empate).
4. Si la respuesta es "sí", puede seguir preguntando; si es "no", pasa el turno.
5. En cualquier turno puede **arriesgar**: escribe qué cree que es. Si acierta, sale del juego
   con los puntos de su posición; si se equivoca, pierde el resto del turno.
6. Termina cuando todos adivinaron o se acaba el tiempo. Más puntos cuanto antes adivinás.

**Modo "Edad"** (el que mencionaste): en lugar de un personaje, cada uno recibe una **edad**
o un número (de 1 a 100) que ven todos menos él, y tiene que adivinarla con preguntas
("¿Puedo votar?", "¿Ya estoy jubilado?"). Para arriesgar, ingresa un número: acierto exacto
3 puntos, a menos de 5 años 2 puntos, a menos de 10, 1 punto.

**Configuración**: categoría (personajes, animales, objetos, profesiones, edad), tiempo total,
cantidad de preguntas por turno, respuestas por botones o en voz.

**Implementación**
- Fases: `asking → answering → (siguiente turno) → game-end`, con la acción `guess` posible en
  el turno propio.
- Acciones: `ask { question }`, `answer { value: 'yes' | 'no' | 'maybe' }`,
  `guess { text | number }`, `pass`.
- **Vista por jugador**: es el ejemplo perfecto del servidor autoritativo; cada uno recibe las
  cartas de todos **excepto la suya**, así que no hay forma de verla ni inspeccionando el
  tráfico.
- Comparación de respuestas: normalizar (minúsculas, sin tildes, sin espacios extra) y aceptar
  sinónimos cargados en la carta (*"Messi" / "Lionel Messi"*). En modo edad, comparación
  numérica.
- Contenido: listas de cartas por categoría e idioma, reutilizando el formato de las listas
  de palabras; se pueden sumar categorías desde el workshop.

---

## 4. Ranking secreto (estilo *Ito*)

**De qué trata.** Un juego **cooperativo**: todos ganan o pierden juntos. Cada jugador recibe un
número secreto del 1 al 100 y hay un tema con una escala. Nadie puede decir su número: cada uno
lo "traduce" a una respuesta sobre el tema, y entre todos tienen que **ordenarse de menor a
mayor** sólo a partir de esas respuestas. La gracia está en la discusión: *"¿una araña da más
miedo que un examen?"*.

**Ejemplo de ronda.** Tema: *"Cosas que dan miedo"* (1 = nada de miedo, 100 = terror).
- Sofi tiene el 92 y escribe *"un tiburón al lado tuyo"*.
- Lucas tiene el 15 y escribe *"una mariposa"*.
- Mica tiene el 60 y escribe *"hablar en público"*.
- Juan tiene el 41 y escribe *"el dentista"*.

Discuten, ordenan *mariposa → dentista → hablar en público → tiburón*, confirman y se dan
vuelta las cartas: 15, 41, 60, 92. Orden perfecto, pasan de nivel.

**Reglas**
1. **Reparto**: cada jugador recibe un número del 1 al 100 (sin repetidos) que sólo ve él.
2. **Tema**: aparece un tema con sus dos extremos, por ejemplo *"Comidas: 1 = la odio todos,
   100 = la ama todo el mundo"* o *"Superpoderes: 1 = inútil, 100 = el mejor"*.
3. **Respuestas** (60 s): cada uno escribe algo del tema que represente su número. No se
   pueden escribir números ni pistas directas ("casi 100"); el filtro las rechaza.
4. **Orden** (2 minutos): se muestran todas las respuestas en una lista compartida y el grupo
   la ordena de menor a mayor arrastrando. Se puede hablar por chat o en voz, pero **nadie
   puede decir su número**.
5. **Confirmación**: cuando todos tocan "Listo" (o se acaba el tiempo), el orden queda fijo.
6. **Revelación**: las cartas se dan vuelta de a una, de la primera a la última. Cada carta
   que está fuera de lugar cuesta **una vida**.
7. **Niveles**: el grupo empieza con 3 vidas. Si el orden sale bien, pasan al nivel
   siguiente, donde cada jugador recibe **una carta más** (en el nivel 2 cada uno tiene dos
   números y escribe dos respuestas). Si se quedan sin vidas, termina el juego.
8. **Resultado**: el puntaje del grupo es el nivel al que llegaron. En el perfil se guarda el
   mejor nivel alcanzado.

**Variantes**
- **Modo rápido**: sin niveles; se juegan N temas con una carta cada uno y se cuenta cuántos
  órdenes perfectos lograron.
- **Modo impostor** (competitivo, para quien extrañe la deducción): un jugador no recibe número
  y tiene que inventar una respuesta que encaje en algún lugar. Si al final el grupo lo
  descubre por votación, gana el grupo; si no, gana el impostor.
- **Ordenar a ciegas** (difícil): no se puede hablar; sólo se ven las respuestas escritas.

**Configuración**: vidas (1 a 5), tiempo para responder y para ordenar, modo (niveles, rápido,
impostor), chat o voz, categorías de temas.

**Por qué funciona**
- No requiere saber nada: sólo opinar, así que pueden jugar todos.
- Es cooperativo, un cambio de ritmo frente a los juegos de impostor.
- Las respuestas generan risas y debate: *"¿cómo que el dentista da menos miedo?"*.
- Escala bien con muchos jugadores (con 8 personas, ordenar es un desafío real).

**Implementación**
- Fases: `deal → answering → ordering → reveal → (nivel siguiente | game-end)`.
- Acciones: `submit-answer { cardIndex, text }`, `move-card { cardId, toIndex }`,
  `confirm-order`, `unconfirm`.
- **Vista por jugador**: cada uno recibe sólo sus propios números; los de los demás no salen del
  servidor hasta la revelación (igual que la palabra en El Impostor). Las respuestas sí las ven
  todos.
- **Lista compartida en vivo**: cada movimiento se reenvía a la sala con un evento liviano (como
  los trazos del dibujo), con límite de frecuencia. Si dos personas mueven a la vez, gana el
  último movimiento que llega al servidor, que siempre manda el orden completo.
- **Revelación**: el servidor calcula qué cartas están fuera de lugar comparando el orden del
  grupo con el orden real (una carta está mal si hay una mayor antes que ella). Las vuelve de a
  una con un timer corto, para que haya suspenso en la pantalla.
- **Validación**: respuestas de 2 a 60 caracteres, filtro de insultos y rechazo de números
  (`/\d/`) y de palabras como "cien" o "máximo".
- **Desconexión**: se pausa como en los demás juegos; si alguien se va, sus cartas salen del
  orden.
- **Contenido**: ~80 temas por idioma con sus dos extremos, en el mismo formato que las listas
  de palabras (`packages/shared/src/word-lists/`). Más adelante, temas creados en el workshop.
- **Estadísticas**: juegos jugados, mejor nivel alcanzado y órdenes perfectos (se guardan en la
  columna genérica propuesta arriba).
- **Pantalla**: tarjetas con la respuesta y el avatar de su autor, que se arrastran (táctil en el
  celular); arriba, las vidas y el nivel. En la revelación, cada carta se da vuelta y queda
  verde (bien) o roja (fuera de lugar).

---

## Otras ideas que valen la pena

### 5. Pregunta trampa (la mejor candidata con impostor)
Todos reciben una pregunta, salvo el impostor, que recibe **otra parecida**. Por ejemplo, los
inocentes ven *"¿Cuántas horas dormís por día?"* y el impostor *"¿Cuántas horas usás el
celular por día?"*. Cada uno responde (un número o una palabra), se revelan todas las
respuestas junto con la pregunta verdadera, y el grupo discute y vota quién respondió otra
cosa. Es muy popular en redes y **calza directo en `DeductionEngine`**: sólo cambia la
actividad de la ronda (responder en lugar de dar una pista). Contenido: pares de preguntas
por idioma.

### 6. Chamullo (estilo *Fibbage*): cultura general con mentiras
Aparece una pregunta curiosa de cultura general con un espacio en blanco (*"El primer helado
de Argentina se vendió en el año ___"*). Cada uno inventa una respuesta falsa creíble; se
mezclan con la verdadera y todos votan cuál es la real. Puntos por acertar y por engañar.
Encaja con el nombre AmongLies. Necesita un banco de preguntas con su respuesta verdadera y
detectar respuestas inventadas que coinciden con la real.

### 7. Mente colmena
Aparece una consigna (*"Nombrá una fruta roja"*) y todos escriben una respuesta a la vez. Suma
puntos quien coincide con la mayoría. Muy simple de implementar, rápido, y bueno para
"calentar" antes de un juego más largo.

---

## Prioridad sugerida

| Juego | Esfuerzo | Reutiliza | Por qué |
|---|---|---|---|
| Pregunta trampa | Bajo | `DeductionEngine` completo | Mismo estilo que los actuales; sólo cambia la ronda. |
| Dos verdades y una mentira | Medio | Votación, timers, chat | No necesita contenido; muy social. |
| En la frente | Medio | Vista por jugador, listas de palabras | Muestra bien el servidor autoritativo; modo edad incluido. |
| Onda | Medio-alto | Eventos en vivo del dibujo | El dial compartido en tiempo real es lo nuevo. |
| Ranking secreto | Medio | Vista por jugador, eventos en vivo, listas de contenido | Cooperativo; cambia el ritmo y escala bien con muchos jugadores. |
| Chamullo | Medio | Votación | Hay que armar el banco de preguntas. |
| Mente colmena | Bajo | Timers | Rápido de hacer; ideal como juego corto. |

Antes del primero que no sea de impostor conviene separar `RoundEngine` y resolver las
estadísticas genéricas (ver "Cómo se agrega un juego").
