# @amonglies/server

Servidor de AmongLies: NestJS 11 + Socket.io. Valida cada acción de juego, mantiene las salas en
memoria y le manda a cada jugador sólo lo que puede ver. Ver el README del monorepo para el
detalle del proyecto.

```bash
npm run start:dev          # desarrollo (puerto 3001)
npm test                   # tests unitarios (Jest)
npm run test:cov           # unitarios con cobertura de ramas mínima
npm run test:integration   # integración: HTTP + Socket.io contra el servidor real
```

Variables en `.env` (ver `.env.example`): `PORT`, `CLIENT_URL`, `SUPABASE_URL` y
`SUPABASE_SECRET_KEY`. Sin la clave secreta el servidor funciona igual para invitados.
