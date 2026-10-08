import { Injectable, Logger } from '@nestjs/common';
import type { GameId } from '@amonglies/shared';
import type { PlayerGameStats } from '../game/engine.js';

export interface AccountStats extends PlayerGameStats {
  userId: string;
}

/** Guarda en Supabase las estadísticas de las cuentas al terminar un juego. */
@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);
  private readonly url = process.env.SUPABASE_URL;
  private readonly secretKey = process.env.SUPABASE_SECRET_KEY;

  /** No bloquea el juego: si Supabase falla, se registra el error y listo. */
  async record(gameId: GameId, entries: AccountStats[]): Promise<void> {
    if (!this.url || !this.secretKey || entries.length === 0) return;

    const body = {
      entries: entries.map((e) => ({
        user_id: e.userId,
        game_id: gameId,
        partidas_played: e.partidasPlayed,
        partidas_as_impostor: e.partidasAsImpostor,
        partidas_won_as_impostor: e.partidasWonAsImpostor,
        partidas_as_innocent: e.partidasAsInnocent,
        partidas_won_as_innocent: e.partidasWonAsInnocent,
        correct_votes: e.correctVotes,
        innocent_votes: e.innocentVotes,
        points: e.points,
      })),
    };

    try {
      const response = await fetch(
        `${this.url}/rest/v1/rpc/record_game_stats`,
        {
          method: 'POST',
          headers: {
            apikey: this.secretKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        this.logger.error(
          `No se guardaron las estadísticas: ${response.status} ${await response.text()}`,
        );
      }
    } catch (error) {
      this.logger.error(`No se guardaron las estadísticas: ${String(error)}`);
    }
  }
}
