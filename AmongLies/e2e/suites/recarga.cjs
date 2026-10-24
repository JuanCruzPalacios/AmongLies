// Navegador: recargar a mitad de partida y "Seguir sin él" desde el overlay de pausa.
const { WEB, SERVER, OUT, launch } = require('../common.cjs');
const { io } = require('socket.io-client');
const { randomUUID } = require('crypto');

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const results = [];
const check = (name, ok) => { results.push(ok); log(ok ? 'OK  ' : 'FAIL', name); };

function bot(name, code) {
  const s = io(SERVER, { transports: ['websocket'], forceNew: true, auth: { sessionToken: randomUUID() } });
  const b = { name, s, view: null };
  s.on('session:ready', () => s.emit('room:join', { code, nickname: name, avatarId: 'cat', locale: 'es' }));
  s.on('game:state-update', (v) => { b.view = v; });
  return b;
}

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, locale: 'es-AR' });
  page.on('pageerror', (e) => log('PAGE ERROR', e.message));

  await page.goto(WEB);
  await page.getByPlaceholder('Ingresa tu apodo...').fill('Admin');
  await page.getByRole('button', { name: /Crear Sala/i }).click();
  await page.waitForURL(/\/room\/[A-Z0-9]{6}/);
  const code = page.url().split('/').pop();
  const bots = ['Sofi', 'Lucas', 'Vale', 'Diego'].map((n) => bot(n, code));
  await page.waitForTimeout(1200);

  await page.getByText('El Impostor').first().click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Iniciar Juego/i }).click();
  await page.waitForTimeout(1500);
  check('arranca la partida', bots[0].view?.phase === 'word-reveal');

  // 1) Recargar la página a mitad de partida
  await page.reload();
  await page.waitForTimeout(2500);
  const stillInGame = await page.getByText(/Partida 1\/\d · Ronda 1/).isVisible().catch(() => false);
  await page.screenshot({ path: `${OUT}/r1-after-reload.png` });
  check('después de recargar sigue en la partida (no pide unirse de nuevo)', stillInGame);
  check('la partida no quedó en pausa', bots[0].view?.paused === false);
  const joinFormVisible = await page.getByRole('button', { name: /^Unirse$/ }).isVisible().catch(() => false);
  check('no aparece el formulario para unirse', !joinFormVisible);

  // 2) Un bot se cae: el admin ve el overlay y sigue sin él
  bots[3].s.disconnect();
  await page.waitForTimeout(800);
  const overlay = page.getByText('Partida en pausa');
  check('aparece el aviso de partida en pausa', await overlay.isVisible());
  await page.screenshot({ path: `${OUT}/r2-paused.png` });
  check('los demás ven la partida pausada', bots[0].view?.paused === true);
  await page.getByRole('button', { name: /Seguir sin esperar/ }).click();
  await page.waitForTimeout(800);
  check('el aviso desaparece al seguir sin él', !(await overlay.isVisible().catch(() => false)));
  check('la partida se reanuda', bots[0].view?.paused === false);
  await page.screenshot({ path: `${OUT}/r3-resumed.png` });

  bots.forEach((b) => b.s.close());
  await browser.close();
  log(`${results.filter(Boolean).length}/${results.length} checks OK`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
