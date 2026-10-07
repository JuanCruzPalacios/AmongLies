import { Injectable } from '@nestjs/common';
import { createAccessTokenVerifier } from './token-verifier.js';

@Injectable()
export class AuthService {
  private readonly verify = process.env.SUPABASE_URL
    ? createAccessTokenVerifier(process.env.SUPABASE_URL)
    : null;

  /** id del usuario si el token es válido; null para invitados o tokens inválidos. */
  async getUserId(accessToken: unknown): Promise<string | null> {
    if (!this.verify || typeof accessToken !== 'string' || !accessToken)
      return null;
    return this.verify(accessToken);
  }
}
