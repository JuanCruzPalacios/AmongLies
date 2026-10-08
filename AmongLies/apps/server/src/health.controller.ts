import { Controller, Get } from '@nestjs/common';

/**
 * Lo consultan los clientes que están en una sala. En el plan gratis de Render
 * el servidor se duerme sin tráfico HTTP y al despertar se pierden las salas
 * (viven en memoria): mientras alguien juega, esto lo mantiene despierto.
 */
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { ok: true };
  }
}
