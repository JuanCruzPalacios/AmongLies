import { existsSync } from 'node:fs';

// En desarrollo carga apps/server/.env; en producción las variables vienen de Railway.
// Se importa primero en main.ts porque los gateways leen process.env al cargarse.
if (existsSync('.env')) process.loadEnvFile('.env');
