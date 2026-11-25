# Entrega final — 2.° Parcial de Desarrollo de Sistemas

**AmongLies** · Integrantes: Juan Cruz Palacios, Matias Budani y Valentino Barrio

Esta guía reúne todo lo que pide la consigna: el link al producto, las credenciales de prueba,
los documentos y en qué sección está cada punto. Al final hay un texto listo para pegar en
Classroom.

---

## 1. Proyecto funcional (70%)

| | |
|---|---|
| **Aplicación** | https://amonglies-web.onrender.com |
| **Servidor** (no hace falta abrirlo) | https://amonglies-server.onrender.com |
| **Repositorio** | https://github.com/JuanCruzPalacios/AmongLies |

> **Primera carga:** el hosting es el plan gratis de Render. Si nadie entró en los últimos
> 15 minutos, el servidor tarda alrededor de **un minuto** en despertar. La página lo avisa
> ("Despertando el servidor…") y sigue sola; no hace falta recargar.

### Credenciales de prueba

Todas las cuentas usan la contraseña **`AmongLies2026`**. Son de demostración, con datos ya
cargados (`supabase/seed/demo.sql`).

| Cuenta | Email | Para probar |
|---|---|---|
| **AdminDemo** (administrador) | `admin@amonglies.test` | Panel de admin: hay 2 reportes abiertos (uno con el chat como evidencia), búsqueda de usuarios, suspender, ocultar contenido. |
| **JugadorDemo** (usuario común) | `jugador@amonglies.test` | Perfil con estadísticas de los 3 juegos, 2 amigos y 1 solicitud pendiente, una lista privada y una copia del workshop con "versión nueva". |
| **AmigaDemo** (usuario común) | `amiga@amonglies.test` | Segunda cuenta para probar amigos e invitaciones a la sala junto con JugadorDemo. |

También se puede jugar **sin cuenta**, como invitado.

### Cómo probar una partida estando solo

Los juegos necesitan **4 jugadores**. Cada pestaña del navegador es un jugador distinto:

1. En una pestaña, elegir apodo y avatar → **Crear sala** (o iniciar sesión antes).
2. Copiar el link de la sala y abrirlo en **3 pestañas más**; en cada una, elegir otro apodo.
3. En la primera pestaña (el anfitrión), elegir el juego y tocar **Iniciar juego**.

En un celular se puede sumar un jugador más abriendo el mismo link.

---

## 2. Documentación corregida del TP3 (15%)

Archivo: [`AmongLies_TP3_Documentacion_Arquitectura.pdf`](AmongLies_TP3_Documentacion_Arquitectura.pdf)
(52 páginas, plantilla arc42 + modelo C4). El uso del sistema está en el
[Manual de usuario](AmongLies_TP3_Manual_de_Usuario.pdf) (93 páginas, con el catálogo de
todas las ventanas por tipo de usuario).

| Punto de la consigna | Dónde está |
|---|---|
| 2.1 Problema de negocio, objetivos y roles | §1.1 Propósito, §1.2 Objetivos, §1.5 Partes interesadas, tabla de actores en §3.1 |
| 2.1 Diagrama de contexto C4 Nivel 1 | §3.1, Figura 1 |
| 2.2 Diagrama entidad-relación | §8.2.2, Figura 14 |
| 2.2 Diccionario de datos | §8.2.4 (una tabla por cada tabla de la base) |
| 2.2 Diagrama de clases / módulos | §5.3, Figura 6 (motores de juego); módulos en §5.2, Figuras 4 y 5 |
| 2.2 Diagramas de secuencia | §6.1 crear sala y unirse, §6.2 ronda de El Impostor, §6.4 estadísticas, §6.5 login, §6.6 reconexión (Figuras 7, 8, 10, 11 y 12) |
| 2.3 Contrato de API | §8.3.1 endpoints HTTP, §8.3.2 conexión, §8.3.3 eventos con ejemplos, §8.3.4 códigos de error y su equivalente HTTP |
| 2.4 Decisiones arquitectónicas | §9: 23 ADRs con alternativas, criterios y consecuencias (stack, base de datos, hosting, patrones) |

### Observaciones de entregas anteriores y dónde se resolvieron

| Observación | Cómo se resolvió | Dónde |
|---|---|---|
| Describía el MVP y no la versión final. | Todo el documento describe el sistema terminado y desplegado. | Todo el documento |
| Faltaban diagramas y ayuda para todas las funcionalidades. | 18 diagramas como código y un manual que cubre todas las funcionalidades. | Arquitectura §3–§8; Manual de usuario |
| Faltaban los objetivos del proyecto. | Objetivos medibles con su verificación y objetivos de calidad priorizados. | §1.2, §1.4 |
| Faltaban restricciones, contexto y alcance. | Restricciones técnicas, organizativas y legales; contexto de negocio y técnico; alcance. | §2, §3 |
| Faltaban gráficos para explicar la arquitectura. | Modelo C4 completo, secuencias, estados, datos y despliegue. | §3–§8 |
| Poco detalle en el criterio de las decisiones. | Criterios ponderados, 23 ADRs con alternativas y consecuencias. | §9 |
| Faltaba un índice. | Índice con páginas en los tres documentos. | Índice |
| Manual sin ayudas visuales. | Capturas reales del sistema, anotadas. | Manual de usuario |
| Mostrar todas las ventanas por tipo de usuario y cómo interactúa con cada componente. | Catálogo de 43 ventanas con su tabla de componentes. | Manual de usuario, M18 |

---

## 3. Manual técnico: testeo y seguridad (15%)

Archivo: [`AmongLies_TP3_Manual_Tecnico_Testing_y_Seguridad.pdf`](AmongLies_TP3_Manual_Tecnico_Testing_y_Seguridad.pdf) (11 páginas).

| Punto de la consigna | Dónde está |
|---|---|
| 3.1 Niveles de prueba (unitarias, integración, E2E) | §2.1–§2.4 |
| 3.1 Matriz de casos de prueba | §3 (15 casos, TC-001 a TC-015) |
| 3.2 Seguridad delegada en hosting y librerías | §4.1 |
| 3.2 Autenticación y sesiones | §4.2 |
| 3.2 Autorización y control de acceso | §4.3 |
| 3.2 Contraseñas y secretos | §4.4 |
| 3.2 Validación y sanitización | §4.5 |
| 3.2 Manejo seguro de errores | §4.6 |

El detalle del ciclo TDD y los bugs encontrados está en [`TESTING.md`](TESTING.md).

---

## 4. Presentación frente al cliente

Guion de la demo: [`PRESENTACION.md`](PRESENTACION.md).

---

## Texto para Classroom

```
AmongLies — Juan Cruz Palacios, Matias Budani y Valentino Barrio

1) Proyecto: https://amonglies-web.onrender.com
   Repositorio: https://github.com/JuanCruzPalacios/AmongLies
   Cuentas de prueba (contraseña AmongLies2026):
   - Administrador: admin@amonglies.test
   - Usuario: jugador@amonglies.test  (segunda cuenta: amiga@amonglies.test)
   También se puede jugar como invitado. Los juegos necesitan 4 jugadores: cada pestaña del
   navegador cuenta como un jugador distinto. La primera carga puede tardar un minuto
   (plan gratis de Render).

2) Documentación corregida del TP3: AmongLies_TP3_Documentacion_Arquitectura.pdf
   (contexto C4 en §3.1, DER y diccionario de datos en §8.2, clases en §5.3, secuencias en §6,
   contrato de API en §8.3, ADRs en §9). Manual de usuario: AmongLies_TP3_Manual_de_Usuario.pdf.

3) Manual técnico de testing y seguridad: AmongLies_TP3_Manual_Tecnico_Testing_y_Seguridad.pdf
   (niveles de prueba en §2, matriz de casos en §3, medidas de seguridad en §4).

Cómo se resolvió cada observación de las entregas anteriores: AmongLies/docs/ENTREGA.md en el
repositorio.

Los PDFs están adjuntos y también en la carpeta AmongLies/docs del repositorio.
```
