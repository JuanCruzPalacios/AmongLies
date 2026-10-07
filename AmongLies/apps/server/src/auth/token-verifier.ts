import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

/**
 * Verifica el JWT de Supabase Auth (claves ECC: se valida con el JWKS público
 * del proyecto, sin ningún secreto). Devuelve el id del usuario o null.
 */
export function createAccessTokenVerifier(
  supabaseUrl: string,
  keys?: JWTVerifyGetKey,
): (token: string) => Promise<string | null> {
  const issuer = `${supabaseUrl}/auth/v1`;
  const jwks =
    keys ?? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

  return async (token) => {
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer,
        audience: 'authenticated',
      });
      return typeof payload.sub === 'string' ? payload.sub : null;
    } catch {
      return null;
    }
  };
}
