/** Lo que el cliente manda en el handshake del socket (`io(url, { auth })`). */
export interface SocketAuth {
  /** Token aleatorio y secreto del navegador: identifica al invitado entre reconexiones. */
  sessionToken?: string;
  /** JWT de Supabase si inició sesión con una cuenta. */
  accessToken?: string;
}
