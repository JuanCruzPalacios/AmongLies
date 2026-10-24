// Utilidades compartidas por las pruebas de punta a punta (ver e2e/README.md).
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { chromium } = require('playwright');
const { io } = require('socket.io-client');

const WEB = process.env.E2E_WEB ?? 'http://localhost:3000';
const SERVER = process.env.E2E_SERVER ?? 'http://localhost:3001';
const REMOTE = !WEB.includes('localhost');
const OUT = process.env.E2E_OUT ?? path.join(__dirname, 'output');
fs.mkdirSync(OUT, { recursive: true });

// Supabase sólo hace falta para las suites con cuentas (se lee de apps/server/.env si existe).
const serverEnv = path.join(__dirname, '..', 'apps', 'server', '.env');
if (fs.existsSync(serverEnv) && !process.env.SUPABASE_URL) process.loadEnvFile(serverEnv);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_XowZg_fp4JzC3aaUEbQqyQ_scBwh4y8';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const time = () => new Date().toISOString().slice(11, 19);

/** Lleva la cuenta de los checks de una suite; `done()` imprime "N/M checks OK" y sale. */
function suite(name) {
  const results = [];
  const log = (...a) => console.log(time(), ...a);
  return {
    log,
    out: (file) => path.join(OUT, `${name}-${file}`),
    check(label, ok) {
      results.push(!!ok);
      log(ok ? 'OK  ' : 'FAIL', label);
    },
    done() {
      log(`${results.filter(Boolean).length}/${results.length} checks OK`);
      process.exit(results.length > 0 && results.every(Boolean) && !process.exitCode ? 0 : 1);
    },
  };
}

const visible = (loc, ms = 8000) => loc.waitFor({ state: 'visible', timeout: ms }).then(() => true).catch(() => false);
const gone = (loc, ms = 8000) => loc.waitFor({ state: 'detached', timeout: ms }).then(() => true).catch(() => false);

/**
 * Chromium. Si hay un proxy de salida (HTTPS_PROXY), se usa para lo que va a
 * internet (Supabase, o todo si se prueba contra producción).
 */
function launch(options = {}) {
  const args = [...(options.args ?? [])];
  const proxy = process.env.HTTPS_PROXY?.replace(/^https?:\/\//, '');
  if (proxy) args.push(`--proxy-server=${REMOTE ? '' : 'https='}${proxy}`);
  return chromium.launch({ ...options, args });
}

async function newPage(browser, { mobile = false, locale = 'es-AR' } = {}) {
  const context = await browser.newContext(
    mobile
      ? { viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, locale }
      : { viewport: { width: 1280, height: 900 }, locale },
  );
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log(time(), 'PAGE ERROR', e.message));
  return page;
}

/** Un jugador por socket (invitado). `onState` recibe cada vista del juego. */
function bot(name, code, { locale = 'es', onState } = {}) {
  const s = io(SERVER, {
    transports: REMOTE ? ['polling'] : ['websocket'],
    forceNew: true,
    auth: { sessionToken: randomUUID() },
  });
  const b = { name, s, id: null, room: null, view: null, errors: [] };
  s.on('session:ready', () => code && s.emit('room:join', { code, nickname: name, avatarId: 'cat', locale }));
  s.on('room:joined', ({ playerId, room }) => { b.id = playerId; b.room = room; });
  s.on('room:updated', ({ room }) => { b.room = room; });
  s.on('room:error', (e) => b.errors.push(e.code));
  s.on('game:error', (e) => b.errors.push(e.code));
  s.on('game:state-update', (v) => { b.view = v; onState?.(v, b); });
  return b;
}

async function waitFor(condition, ms = 10000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (condition()) return true;
    await sleep(100);
  }
  return false;
}

/** El admin crea la sala desde la home; devuelve el código. */
async function createRoom(page, nickname) {
  await page.goto(WEB, { timeout: 90000 });
  if (nickname) await page.getByPlaceholder(/apodo|nickname/i).fill(nickname);
  await page.getByRole('button', { name: /Crear Sala|Create Room/i }).click();
  await page.waitForURL(/\/room\/[A-Z0-9]{6}/, { timeout: 90000 });
  return page.url().split('/').pop();
}

// ── Cuentas temporales (se borran siempre al final) ─────────────────────────

const hasAccounts = Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY);
const PASSWORD = 'Prueba123!';

async function admin(pathname, init = {}) {
  const res = await fetch(`${SUPABASE_URL}${pathname}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!res.ok && res.status !== 404) throw new Error(`${pathname}: ${res.status} ${await res.text()}`);
  return res;
}

/**
 * Crea cuentas de prueba (confirmadas), corre `fn` y las borra pase lo que pase.
 * `specs`: [{ username, admin? }]. Los emails son únicos por corrida.
 */
async function withAccounts(specs, fn) {
  if (!hasAccounts) throw new Error('Faltan SUPABASE_URL y SUPABASE_SECRET_KEY para las suites con cuentas.');
  const run = Math.random().toString(36).slice(2, 7);
  const accounts = [];
  try {
    for (const spec of specs) {
      const email = `e2e-${spec.username.toLowerCase()}-${run}@example.com`;
      const res = await admin('/auth/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email, password: PASSWORD, email_confirm: true, user_metadata: { username: spec.username } }),
      });
      const { id } = await res.json();
      accounts.push({ ...spec, id, email });
      if (spec.admin) {
        await admin(`/rest/v1/profiles?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ is_admin: true }) });
      }
    }
    return await fn(accounts);
  } finally {
    for (const a of accounts) await deleteUser(a);
  }
}

/** Borra la cuenta (y todo lo suyo, en cascada). Reintenta: no tienen que quedar usuarios de prueba. */
async function deleteUser(account) {
  for (let attempt = 1; ; attempt++) {
    try {
      await admin(`/auth/v1/admin/users/${account.id}`, { method: 'DELETE' });
      return;
    } catch (e) {
      if (attempt === 3) {
        console.error(`No se pudo borrar la cuenta de prueba ${account.email}: ${e.message}`);
        process.exitCode = 1;
        return;
      }
      await sleep(2000);
    }
  }
}

/** Fila de una tabla, leída con la clave secreta (para verificar lo que guardó la app). */
async function selectRows(table, query) {
  const res = await admin(`/rest/v1/${table}?${query}`);
  return res.json();
}

async function login(browser, account, options) {
  const page = await newPage(browser, options);
  await page.goto(`${WEB}/login`, { timeout: 90000 });
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Contraseña').fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).last().click();
  await page.waitForURL(WEB + '/', { timeout: 60000 });
  // El apodo se completa con el usuario de la cuenta apenas carga el perfil.
  await page.waitForFunction(() => document.querySelector('input[placeholder^="Ingresá"], input[placeholder^="Ingresa"]')?.value.length > 0);
  return page;
}

module.exports = {
  WEB, SERVER, REMOTE, OUT, SUPABASE_URL, PUBLISHABLE_KEY, PASSWORD, hasAccounts,
  sleep, suite, visible, gone, launch, newPage, bot, waitFor, createRoom,
  withAccounts, selectRows, login,
};
