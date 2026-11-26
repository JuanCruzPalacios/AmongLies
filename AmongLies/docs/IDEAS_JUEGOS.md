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

## Requisito para todos: modo aleatorio y puntaje individual

La idea es poder crear una sala, elegir **modo aleatorio** y jugar **una ronda de cada juego**:
el servidor sortea un juego, se juega una ronda corta, se suman los puntos y sale otro juego.
Para que eso funcione, todos los juegos (los actuales y los nuevos) tienen que cumplir:

1. **Puntaje individual.** Cada jugador suma sus propios puntos. Nada de juegos cooperativos
   ni por equipos: el marcador del modo aleatorio es una tabla única de jugadores.
2. **Una ronda corta y cerrada.** Cada juego define su "ronda" (2 a 5 minutos): empieza,
   reparte puntos y termina, sin depender de rondas anteriores.
3. **Mismo mínimo de jugadores** (4, como los actuales) y que funcione con muchos.
4. **Configuración por defecto** que sirva sin tocar nada (el anfitrión puede elegir qué juegos
   entran en el sorteo).

**Cómo implementarlo**: un motor "mezcla" (`MixEngine`) que también cumple `GameEngine`.
Por dentro crea el motor de cada juego sorteado, configurado para una ronda, espera a que
termine, suma los puntos al marcador general, muestra una pantalla de puntajes y crea el
siguiente (sin repetir el mismo juego dos veces seguidas). Para el resto del servidor es un
juego más, así que salas, chat, reconexión y pausa no cambian. Cada motor tiene que exponer
los puntos de la ronda por jugador (hoy ya lo hacen con `getPlayerStats()`).

En los juegos de impostor actuales, una "ronda" del modo aleatorio sería **una partida con
tope de 2 o 3 rondas** (los impostores se eligen al empezar y se revelan al final).

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

**En modo aleatorio**: todos escriben sus frases, pero sólo se presentan **2 jugadores
sorteados** (o todos sin interrogatorio, si son pocos), para que la ronda dure 3 a 4 minutos.

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

## 2. Onda (estilo *Wavelength*, versión individual)

**De qué trata.** Un juego de "leer la mente": hay una escala entre dos extremos (por ejemplo,
*frío ↔ caliente*) y una posición secreta en esa escala. Un jugador da una pista y **cada uno,
por su cuenta**, marca dónde cree que está. El original es cooperativo; esta versión es
individual para que encaje con el modo aleatorio.

**Reglas**
1. Cada turno, un jugador es el **psíquico**: ve una escala (*"Aburrido ↔ Divertido"*) y un
   objetivo secreto en ella (un número de 0 a 100).
2. El psíquico escribe **una sola pista** (*"un recreo"*). No puede usar números ni decir la
   posición.
3. **Cada jugador mueve su propio dial** en secreto y confirma. Nadie ve el dial de los demás
   hasta la revelación.
4. Se revelan el objetivo y todos los diales a la vez. Puntos según la distancia: a menos de 5,
   4 puntos; a menos de 10, 3; a menos de 20, 2.
5. **El psíquico también suma**: el promedio de los puntos que hicieron los demás. Así le
   conviene dar una pista clara (y no se puede sabotear).
6. El rol de psíquico rota.

**Configuración**: cantidad de turnos, tiempo para la pista y para marcar, pista por chat o en
voz.

**En modo aleatorio**: una ronda son **2 psíquicos** sorteados (unos 3 minutos).

**Implementación**
- Fases: `clue → guessing → reveal → (siguiente psíquico) → game-end`.
- Acciones: `give-clue { text }`, `set-dial { value }`, `confirm`.
- Vista por jugador: el objetivo sólo lo ve el psíquico, y los diales ajenos no se mandan hasta
  la revelación (cada uno ve sólo el suyo).
- Validación: pista de 1 a 40 caracteres, sin números, filtro de insultos.
- Contenido: listas de escalas por idioma (`packages/shared/src/word-lists/`, ~60 pares para
  empezar). Más adelante, escalas del workshop.
- Pantalla: un semicírculo con el dial (SVG), táctil en el celular; en la revelación, todos los
  diales con el avatar de cada jugador sobre la escala.

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

**En modo aleatorio**: la ronda dura un tiempo fijo (por ejemplo, 4 minutos); quien no
adivinó a tiempo no suma.

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

## 4. Ranking secreto (estilo *Ito*, versión individual)

**De qué trata.** Cada jugador recibe un número secreto del 1 al 100 y hay un tema con una
escala. Cada uno escribe una palabra que represente su número en esa escala. Después, **cada
jugador, por su cuenta**, ordena las palabras de todos de menor a mayor. Suma más quien mejor
ordena, y también quien escribió una palabra que los demás supieron ubicar. La gracia está en
interpretar a los demás: *"para Sofi, ¿una araña es un 80 o un 40?"*.

**Ejemplo de ronda.** Tema: *"Cosas que dan miedo"* (1 = nada de miedo, 100 = terror).
- Lucas tiene el 15 y escribe *"una mariposa"*.
- Juan tiene el 41 y escribe *"el dentista"*.
- Mica tiene el 60 y escribe *"hablar en público"*.
- Sofi tiene el 92 y escribe *"un tiburón"*.

Cada uno ve las cuatro palabras (sin saber de quién es cada una) y las ordena en su pantalla.
Al revelar, el orden real es mariposa → dentista → hablar en público → tiburón. Quien lo armó
igual suma el máximo; quien cambió el dentista con hablar en público suma un poco menos.

**Reglas**
1. **Reparto**: cada jugador recibe un número del 1 al 100 (sin repetidos y separados por al
   menos 5 entre sí, para que no haya empates imposibles). Sólo lo ve él.
2. **Tema**: aparece un tema con sus dos extremos (*"Comidas: 1 = la odian todos, 100 = la ama
   todo el mundo"*).
3. **Palabra** (45 s): cada uno escribe una palabra o frase corta que represente su número. No
   puede escribir números ni pistas directas ("casi 100").
4. **Orden** (90 s): todos ven todas las palabras, **anónimas y mezcladas**, y cada uno las
   ordena de menor a mayor en su propia pantalla, arrastrando. Su propia palabra también está
   (le sirve de referencia, porque conoce su número).
5. **Revelación**: se muestran los números, el orden real y cuántos puntos hizo cada uno.

**Puntaje** (individual)
- **Por ordenar**: 1 punto por cada par de palabras que ordenaste bien entre sí, escalado a un
  máximo de 10. Es más justo que contar posiciones exactas: un solo error al principio no
  arruina todo el resto.
- **Por comunicar**: el autor de cada palabra suma 1 punto por cada jugador que la ubicó en su
  posición exacta. Así nadie gana escribiendo palabras ambiguas para confundir: a cada uno le
  conviene que su palabra se entienda.

**Configuración**: tiempo para escribir y para ordenar, categorías de temas, palabras anónimas o
con autor (con autor es más fácil y más social: *"Lucas siempre exagera"*).

**En modo aleatorio**: una ronda es un tema (unos 3 minutos). Fuera del modo aleatorio, se
juegan varios temas seguidos y gana quien más suma.

**Por qué funciona**
- No requiere saber nada: sólo interpretar a los demás, así que pueden jugar todos.
- Todos juegan a la vez (no hay que esperar turnos), así que con 8 personas dura lo mismo.
- Cada jugador tiene dos objetivos que lo hacen pensar: escribir bien y ordenar bien.
- Las revelaciones generan debate: *"¿cómo que el dentista da menos miedo que hablar en público?"*.

**Implementación**
- Fases: `deal → writing → ordering → reveal → game-end` (o siguiente tema).
- Acciones: `submit-word { text }`, `submit-order { cardIds: [...] }`.
- **Vista por jugador**: cada uno recibe sólo su número. Las palabras se muestran con un id
  aleatorio que no revela al autor ni el número; el orden de cada jugador tampoco se comparte
  hasta la revelación.
- **Puntaje**: el servidor compara el orden de cada jugador con el real contando pares bien
  ordenados (una función pura, fácil de probar con tests unitarios, como `resolveVotes`).
- **Validación**: palabra de 2 a 40 caracteres, filtro de insultos, rechazo de dígitos y de
  palabras como "cien", "máximo" o "mínimo"; el orden enviado tiene que contener exactamente
  todas las palabras. Si alguien no ordena a tiempo, no suma por ordenar.
- **Desconexión**: se pausa como en los demás juegos; si alguien se va, su palabra sale de la
  lista.
- **Contenido**: ~80 temas por idioma con sus dos extremos, en el mismo formato que las listas de
  palabras (`packages/shared/src/word-lists/`). Más adelante, temas creados en el workshop.
- **Pantalla**: tarjetas con las palabras que se arrastran (táctil en el celular) y una escala de
  fondo de 1 a 100. En la revelación, cada tarjeta muestra su número y su autor, y tu orden queda
  al lado del real, con verde o rojo según estés bien o mal.

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
| Onda | Medio | Votación con valor numérico, vista por jugador | Individual; cada uno marca su dial y el psíquico suma si su pista sirve. |
| Ranking secreto | Medio | Vista por jugador, listas de contenido | Todos juegan a la vez; puntos por ordenar y por comunicar. |
| Chamullo | Medio | Votación | Hay que armar el banco de preguntas. |
| Mente colmena | Bajo | Timers | Rápido de hacer; ideal como juego corto. |

Antes del primero que no sea de impostor conviene separar `RoundEngine` y resolver las
estadísticas genéricas (ver "Cómo se agrega un juego"). El modo aleatorio (`MixEngine`) se puede
hacer en cualquier momento con los tres juegos actuales, y cada juego nuevo se suma al sorteo.
