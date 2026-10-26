// Corre las pruebas de punta a punta y muestra un resumen.
//   node e2e/run.cjs              → las de invitados (y las de cuentas si hay clave de Supabase)
//   node e2e/run.cjs invitados    → sólo las que no usan cuentas (las que corre el CI)
//   node e2e/run.cjs cuentas      → sólo las que crean cuentas temporales en Supabase
//   node e2e/run.cjs tiempo dibujo → las que se nombren
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { hasAccounts } = require('./common.cjs');

const GUEST = ['impostor', 'tiempo', 'dibujo', 'dibujo-celular', 'recarga', 'reconexion', 'servidor', 'salas-publicas', 'chat', 'carrera-al-entrar', 'sala-perdida', 'expulsado'];
const ACCOUNTS = ['cuenta-y-estadisticas', 'amigos', 'workshop', 'moderacion', 'ajustes'];

const args = process.argv.slice(2);
let names;
if (args.length === 0) names = hasAccounts ? [...GUEST, ...ACCOUNTS] : GUEST;
else if (args[0] === 'invitados') names = GUEST;
else if (args[0] === 'cuentas') names = ACCOUNTS;
else names = args;

// En entornos con proxy de salida, Node también tiene que usarlo para llegar a Supabase.
const env = { ...process.env, ...(process.env.HTTPS_PROXY ? { NODE_USE_ENV_PROXY: '1' } : {}) };
const summary = [];
for (const name of names) {
  console.log(`\n━━ ${name} ━━`);
  const started = Date.now();
  const run = spawnSync(process.execPath, [path.join(__dirname, 'suites', `${name}.cjs`)], { env, encoding: 'utf8', timeout: 6 * 60 * 1000 });
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`.split('\n').filter((l) => !/UNDICI-EHPA|trace-warnings/.test(l)).join('\n');
  process.stdout.write(output);
  const line = output.match(/(\d+)\/(\d+) checks OK/);
  const skipped = /^SKIP/m.test(output);
  summary.push({ name, ok: run.status === 0, skipped, checks: line ? `${line[1]}/${line[2]}` : '—', seconds: Math.round((Date.now() - started) / 1000) });
}

console.log('\n━━ Resumen ━━');
for (const s of summary) console.log(`${s.skipped ? 'SALTEADA' : s.ok ? 'OK      ' : 'FALLÓ   '} ${s.name.padEnd(24)} ${s.checks.padStart(6)}  ${s.seconds}s`);
const failed = summary.filter((s) => !s.ok && !s.skipped);
console.log(failed.length ? `\n${failed.length} suite(s) fallaron.` : '\nTodas las suites pasaron.');
process.exit(failed.length ? 1 : 0);
