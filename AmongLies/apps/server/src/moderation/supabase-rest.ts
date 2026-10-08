/** Llamada a la API REST de Supabase con la clave secreta (sólo desde el servidor). */
export async function supabaseRest(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Supabase no configurado');
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!response.ok)
    throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  return response;
}

export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
