import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { createAccessTokenVerifier } from './token-verifier.js';

const SUPABASE_URL = 'https://proyecto.supabase.co';
const ISSUER = `${SUPABASE_URL}/auth/v1`;

async function setup() {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const other = await generateKeyPair('ES256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'ES256' };
  const verify = createAccessTokenVerifier(
    SUPABASE_URL,
    createLocalJWKSet({ keys: [jwk] }),
  );

  const sign = (
    claims: Record<string, unknown> = {},
    key = privateKey,
    opts: { exp?: string } = {},
  ) =>
    new SignJWT({ role: 'authenticated', ...claims })
      .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
      .setSubject('user-123')
      .setIssuer((claims.iss as string) ?? ISSUER)
      .setAudience((claims.aud as string) ?? 'authenticated')
      .setIssuedAt()
      .setExpirationTime(opts.exp ?? '1h')
      .sign(key);

  return { verify, sign, otherKey: other.privateKey };
}

describe('createAccessTokenVerifier', () => {
  it('devuelve el id del usuario con un token válido', async () => {
    const { verify, sign } = await setup();
    await expect(verify(await sign())).resolves.toBe('user-123');
  });

  it('rechaza un token firmado con otra clave', async () => {
    const { verify, sign, otherKey } = await setup();
    await expect(verify(await sign({}, otherKey))).resolves.toBeNull();
  });

  it('rechaza un token de otro proyecto (issuer distinto)', async () => {
    const { verify, sign } = await setup();
    await expect(
      verify(await sign({ iss: 'https://otro.supabase.co/auth/v1' })),
    ).resolves.toBeNull();
  });

  it('rechaza un token que no es de usuario autenticado (audience distinta)', async () => {
    const { verify, sign } = await setup();
    await expect(verify(await sign({ aud: 'anon' }))).resolves.toBeNull();
  });

  it('rechaza un token vencido', async () => {
    const { verify, sign } = await setup();
    await expect(
      verify(await sign({}, undefined, { exp: '-1m' })),
    ).resolves.toBeNull();
  });

  it.each([[''], ['basura'], ['a.b.c']])(
    'rechaza texto que no es un JWT: %p',
    async (token) => {
      const { verify } = await setup();
      await expect(verify(token)).resolves.toBeNull();
    },
  );

  it('rechaza un token modificado después de firmarlo', async () => {
    const { verify, sign } = await setup();
    const [header, , signature] = (await sign()).split('.');
    const forged = Buffer.from(
      JSON.stringify({ sub: 'admin', iss: ISSUER, aud: 'authenticated' }),
    ).toString('base64url');
    await expect(
      verify(`${header}.${forged}.${signature}`),
    ).resolves.toBeNull();
  });
});
