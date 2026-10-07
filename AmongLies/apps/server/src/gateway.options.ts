import type { GatewayMetadata } from '@nestjs/websockets';

/**
 * Opciones compartidas por todos los gateways. Socket.io usa las del primer
 * gateway que crea Nest, así que todos tienen que declarar las mismas: si no,
 * el CORS depende del orden de los providers y el polling por HTTP se rompe.
 */
export const GATEWAY_OPTIONS: GatewayMetadata = {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  },
};
