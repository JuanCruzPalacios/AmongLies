/**
 * Filtro de insultos (español e inglés). Compara palabras enteras, así no marca
 * palabras normales que contienen un insulto adentro ("computadora", "disputa").
 * Antes de comparar normaliza: minúsculas, sin acentos, leetspeak y letras repetidas.
 */
const WORDS = [
  // Español
  'puta', 'puto', 'putita', 'mierda', 'mierdoso', 'pelotudo', 'pelotuda', 'boludazo',
  'forro', 'forra', 'pija', 'verga', 'idiota', 'imbecil', 'estupido', 'estupida', 'tarado',
  'tarada', 'mogolico', 'mogolica', 'retrasado', 'retrasada', 'subnormal', 'maricon', 'trolo',
  'sorete', 'garca', 'malparido', 'malparida', 'gonorrea', 'cabron', 'cabrona', 'pendejo',
  'pendeja', 'coño', 'culiao', 'culiado', 'conchudo', 'conchuda', 'chupala', 'mamaguevo',
  'hijodeputa', 'hdp', 'lpm', 'ctm', 'ptm', 'concha',
  // English
  'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'bullshit', 'bitch', 'asshole',
  'bastard', 'cunt', 'dick', 'dickhead', 'pussy', 'faggot', 'fag', 'nigger', 'nigga',
  'retard', 'retarded', 'whore', 'slut', 'idiot', 'moron', 'wanker', 'twat',
];

const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's',
};

/** "MiÉÉrda" → "mierda"; "p3l0tud0" → "pelotudo"; "asshole" → "ashole". */
function normalize(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[013457@$]/g, (c) => LEET[c] ?? c)
    .replace(/(.)\1+/g, '$1');
}

const BLOCKED = new Set(WORDS.map(normalize));

function isBlocked(token: string): boolean {
  const word = normalize(token);
  if (BLOCKED.has(word)) return true;
  // Plurales: "idiotas", "bitches".
  if (word.endsWith('es') && BLOCKED.has(word.slice(0, -2))) return true;
  return word.endsWith('s') && BLOCKED.has(word.slice(0, -1));
}

const TOKEN = /[\p{L}\p{N}@$]+/gu;

export function containsProfanity(text: string): boolean {
  for (const [token] of text.matchAll(TOKEN)) {
    if (isBlocked(token)) return true;
  }
  return false;
}

/** Reemplaza cada insulto por asteriscos del mismo largo; el resto del texto queda igual. */
export function censor(text: string): string {
  return text.replace(TOKEN, (token) =>
    isBlocked(token) ? '*'.repeat([...token].length) : token,
  );
}
