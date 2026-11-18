# Guion de la presentación frente al cliente

La consigna pide una demo **orientada al cliente**: cómo AmongLies resuelve su problema, qué le
aporta al usuario y cómo se cumplen los requerimientos. No hay defensa técnica, así que se
habla de **beneficios y experiencia**, no de código. Duración sugerida: 12 a 15 minutos.

Integrantes: Juan Cruz Palacios, Matias Budani y Valentino Barrio. Abajo hay una propuesta de
reparto; ajústenla a quién se siente más cómodo con cada parte.

---

## Antes de empezar (15 minutos antes)

- [ ] Abrir https://amonglies-web.onrender.com para **despertar el servidor** (tarda ~1 minuto
      la primera vez). Crear una sala de prueba y salir.
- [ ] Tener listos 4 dispositivos o pestañas: una notebook conectada al proyector (anfitrión)
      y 3 celulares o pestañas (jugadores). Batería cargada y la misma red Wi-Fi.
- [ ] Iniciar sesión con `jugador@amonglies.test` en la notebook y con `amiga@amonglies.test`
      en un celular (contraseña `AmongLies2026`). Tener `admin@amonglies.test` en otra pestaña.
- [ ] Subir el brillo y el zoom del navegador para que se lea en el proyector.
- [ ] **Plan B:** un video corto grabado de una partida completa, por si falla internet.

---

## 1. El problema (Juan · 1–2 min)

> "¿Cuántas veces quisieron jugar al Impostor con amigos y terminaron con papelitos, alguien
> que no juega para moderar, o una app que obliga a todos a registrarse antes de empezar?"

- Organizar estos juegos en grupo es engorroso: alguien tiene que repartir roles en secreto,
  controlar los tiempos y contar votos.
- Nuestro objetivo: que un grupo pueda **jugar en menos de un minuto**, desde el navegador o el
  celular, **sin instalar nada y sin cuenta obligatoria**.

## 2. Entrar y armar la sala (Matias · 2 min)

- Mostrar la página de inicio: elegir apodo y avatar → **Crear sala**. Remarcar: *sin registro*.
- Compartir el código o el link: los compañeros se suman desde sus celulares y aparecen al
  instante en el lobby.
- Mostrar que el anfitrión elige el juego y ajusta las reglas (tiempos, cantidad de
  impostores, pista de categoría) **sin tocar nada técnico**.
- Beneficio para el cliente: *el sistema hace de moderador*.

## 3. Jugar una partida de El Impostor (todos · 4–5 min)

- Iniciar el juego: cada uno ve en su celular si es inocente (con la palabra) o impostor.
  Mostrar al público las dos pantallas.
- Turnos de pistas, discusión con chat, votación y resultado con puntaje.
- Remarcar mientras juegan:
  - **Justo:** el impostor nunca puede ver la palabra, ni siquiera "haciendo trampa".
  - **Robusto:** si alguien pierde la conexión o recarga, la partida se pausa y vuelve a su lugar
    (se puede mostrar recargando un celular).
  - **Responsive:** funciona igual en el celular, con el chat flotante.

## 4. Los otros dos juegos (Valentino · 1–2 min)

- **Impostor por tiempo:** parar un reloj invisible; el impostor no sabe cuánto esperar.
- **Impostor dibujo:** todos dibujan la misma palabra con poca tinta; se puede mostrar el
  dibujo con el dedo en el celular.
- Mensaje: *tres juegos con las mismas reglas de deducción, así el grupo no tiene que
  aprender todo de nuevo*.

## 5. Lo que suma tener cuenta (Matias · 2 min)

- **Perfil y estadísticas** por juego (con `JugadorDemo`).
- **Amigos:** ver quién está conectado e invitarlo a la sala con un toque (se puede mostrar la
  invitación llegando al celular de `AmigaDemo`).
- **Workshop:** listas de palabras creadas por la comunidad (por ejemplo, "Comidas
  argentinas"), con likes, y presets de reglas para empezar más rápido.

## 6. Una comunidad cuidada (Juan · 1–2 min)

- Filtro de insultos en el chat y en los apodos.
- Cualquier jugador puede **reportar**; el administrador ve el reporte con el chat como
  evidencia y puede suspender la cuenta (mostrar el panel con `AdminDemo`).
- Ajustes de privacidad: aparecer desconectado, no recibir invitaciones.

## 7. Cierre (Valentino · 1 min)

- Repasar los requerimientos acordados y que **todos están funcionando**: salas privadas y
  públicas, tres juegos, cuentas opcionales, amigos, workshop, moderación, español e inglés,
  celular y computadora.
- "Está publicado y gratis: lo pueden probar ahora mismo desde su celular." Mostrar el link.
- Abrir a preguntas.

---

## Preguntas que puede hacer un cliente

| Pregunta | Respuesta orientada al cliente |
|---|---|
| ¿Cuánta gente puede jugar? | Mínimo 4; no hay máximo. El anfitrión puede poner un cupo. |
| ¿Hay que pagar o instalar algo? | No. Se juega desde el navegador; la cuenta es opcional y gratuita. |
| ¿Qué pasa si se corta internet? | La partida se pausa para todos y el jugador vuelve a su lugar al reconectarse. |
| ¿Se puede jugar con desconocidos? | Sí, con las salas públicas, que se filtran por juego e idioma. |
| ¿Cómo evitan los insultos? | Filtro automático, reportes y un panel para que el administrador actúe. |
| ¿Se puede jugar con nuestras propias palabras? | Sí, con el Workshop: se crean listas y se usan en la sala. |
| ¿Qué tan rápido arranca? | Elegir apodo, crear sala y compartir el link: menos de un minuto. |

## Consejos

- Hablen de lo que **gana el usuario** ("no tenés que registrarte"), no de cómo está hecho.
- Uno habla mientras otro maneja la demo; eviten silencios mientras carga algo.
- Si algo falla en vivo, mantengan la calma, expliquen qué debería pasar y sigan con el plan B.
