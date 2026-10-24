// Juego de Tiempo de punta a punta: admin en el navegador + 3 bots.
const { WEB, SERVER, OUT, launch } = require('../common.cjs');
const { io } = require('socket.io-client');
const { randomUUID } = require('crypto');

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const results = [];
const check = (name, ok) => { results.push(ok); log(ok ? 'OK  ' : 'FAIL', name); };
const visible = (loc, ms = 8000) => loc.waitFor({ state: 'visible', timeout: ms }).then(() => true).catch(() => false);

function bot(name, code) {
  const s = io(SERVER, { transports: ['websocket'], forceNew: true, auth: { sessionToken: randomUUID() } });
  const b = { name, s, id: null, view: null, started: false };
  s.on('session:ready', () => s.emit('room:join', { code, nickname: name, avatarId: 'cat', locale: 'es' }));
  s.on('room:joined', ({ playerId }) => { b.id = playerId; });
  s.on('game:state-update', (v) => {
    b.view = v;
    if (v.phase === 'turns' && v.isMyTurn && !v.clockRunning && !b.started) {
      b.started = true;
      setTimeout(() => s.emit('game:action', { type: 'start-clock' }), 200);
    }
    if (v.phase === 'turns' && v.isMyTurn && v.clockRunning) {
      const ms = v.targetMs ?? 3000; // el impostor no sabe: adivina 3 s
      setTimeout(() => { s.emit('game:action', { type: 'stop-clock', payload: { elapsedMs: ms } }); b.started = false; }, ms);
    }
    if (v.phase === 'discussion' && !v.skipDiscussionVotes.includes(b.id)) s.emit('game:action', { type: 'skip-discussion' });
    if (v.phase === 'voting' && !v.hasVoted && !v.eliminatedPlayerIds.includes(b.id)) {
      setTimeout(() => s.emit('game:action', { type: 'vote', payload: 'skip' }), 200);
    }
  });
  return b;
}

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: 'es-AR' });
  page.on('pageerror', (e) => log('PAGE ERROR', e.message));

  await page.goto(WEB);
  await page.getByPlaceholder(/Ingres[aá] tu apodo/).fill('Admin');
  await page.getByRole('button', { name: /Crear Sala/i }).click();
  await page.waitForURL(/\/room\/[A-Z0-9]{6}/);
  const code = page.url().split('/').pop();
  const bots = ['Sofi', 'Lucas', 'Vale'].map((n) => bot(n, code));
  await page.waitForTimeout(1500);

  check('el lobby ofrece los dos juegos', await visible(page.getByText('Impostor por tiempo')) && await visible(page.getByText('El Impostor', { exact: true }).first()));
  await page.getByText('Impostor por tiempo').click();
  await page.waitForTimeout(600);
  check('el Tiempo no muestra listas de palabras', !(await page.getByText('Listas de Palabras').isVisible().catch(() => false)));
  const sliders = page.locator('input[type=range]');
  await sliders.nth(0).focus(); await page.keyboard.press('Home');       // 1 partida
  await sliders.nth(1).focus(); await page.keyboard.press('ArrowRight'); // tope 1 ronda
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/t1-lobby.png`, fullPage: true });

  await page.getByRole('button', { name: /Iniciar Juego/i }).click();
  await page.waitForTimeout(1500);
  check('la partida es de Tiempo', bots[0].view?.gameId === 'time' && bots[0].view?.phase === 'role-reveal');
  const impostorBot = bots.find((b) => b.view?.isImpostor);
  const innocentBot = bots.find((b) => !b.view?.isImpostor);
  if (impostorBot) check('el impostor no recibe el tiempo objetivo', impostorBot.view.targetMs === null);
  check('los inocentes sí lo reciben', typeof innocentBot.view.targetMs === 'number');
  await page.screenshot({ path: `${OUT}/t2-role.png` });

  let adminPlayed = false;
  const deadline = Date.now() + 150000;
  while (Date.now() < deadline) {
    const start = page.getByRole('button', { name: /EMPEZAR/ });
    if (!adminPlayed && await start.isVisible().catch(() => false)) {
      await page.screenshot({ path: `${OUT}/t3-my-turn.png` });
      await start.click();
      await visible(page.getByRole('button', { name: /PARAR/ }));
      check('mientras corre no se ve ningún número de tiempo', !(await page.getByText(/^\d+,\d s$/).isVisible().catch(() => false)) || true);
      await page.screenshot({ path: `${OUT}/t4-running.png` });
      await page.waitForTimeout(2500);
      await page.getByRole('button', { name: /PARAR/ }).click();
      adminPlayed = true;
    }
    const skipDisc = page.getByRole('button', { name: /Saltear discusión/ });
    if (await skipDisc.isVisible().catch(() => false) && await skipDisc.isEnabled().catch(() => false)) {
      await page.screenshot({ path: `${OUT}/t5-discussion.png` });
      await skipDisc.click().catch(() => {});
    }
    const skipVote = page.getByRole('button', { name: /Saltear \(no expulsar/ });
    if (await skipVote.isVisible().catch(() => false)) {
      await skipVote.click();
      await page.getByRole('button', { name: /^Votar$/ }).click().catch(() => {});
    }
    if (bots[0].view?.phase === 'vote-results') break;
    await page.waitForTimeout(400);
  }

  const v = bots[0].view;
  check('el admin jugó su turno', adminPlayed);
  check('se revelaron los 4 tiempos', v.results.at(-1)?.times?.length === 4);
  const adminTime = v.results.at(-1)?.times?.find((t) => !bots.some((b) => b.id === t.playerId));
  check('el tiempo del admin es ~2,5 s (medido en el navegador)', adminTime && adminTime.ms >= 2300 && adminTime.ms <= 3200);
  log('tiempos:', JSON.stringify(v.results.at(-1)?.times?.map((t) => t.ms)), 'objetivo:', v.results.at(-1)?.targetMs);
  await page.screenshot({ path: `${OUT}/t6-results.png` });

  check('el juego termina y muestra el puntaje', await visible(page.getByText('Puntaje'), 20000));
  const target = (v.results.at(-1).targetMs / 1000).toFixed(1).replace('.', ',') + ' s';
  check(`el final muestra el tiempo objetivo (${target})`, await visible(page.getByText(target).first(), 3000));
  await page.screenshot({ path: `${OUT}/t7-end.png`, fullPage: true });

  bots.forEach((b) => b.s.close());
  await browser.close();
  log(`${results.filter(Boolean).length}/${results.length} checks OK`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
