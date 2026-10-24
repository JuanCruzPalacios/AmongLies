// Juego de Dibujo de punta a punta: admin dibujando con el mouse + 3 bots.
const { WEB, SERVER, OUT, launch } = require('../common.cjs');
const { io } = require('socket.io-client');
const { randomUUID } = require('crypto');

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const results = [];
const check = (name, ok) => { results.push(!!ok); log(ok ? 'OK  ' : 'FAIL', name); };
const visible = (loc, ms = 8000) => loc.waitFor({ state: 'visible', timeout: ms }).then(() => true).catch(() => false);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const COLOR = '#ef4444';

function bot(name, code, line) {
  const s = io(SERVER, { transports: ['websocket'], forceNew: true, auth: { sessionToken: randomUUID() } });
  const b = { name, s, id: null, view: null, drewKey: null, drawing: false, line };
  s.on('session:ready', () => s.emit('room:join', { code, nickname: name, avatarId: 'cat', locale: 'es' }));
  s.on('room:joined', ({ playerId }) => { b.id = playerId; });
  s.on('game:state-update', async (v) => {
    b.view = v;
    const key = `${v.partida}-${v.roundWithinPartida}-${v.lap}-${v.currentTurnIndex}`;
    if (v.phase === 'turns' && v.isMyTurn && b.drewKey !== key) {
      b.drewKey = key;
      b.drawing = true;
      const y = b.line + (v.roundWithinPartida - 1) * 0.1;
      // Intenta dibujar 3 anchos de lienzo: el servidor lo tiene que cortar en la tinta del turno.
      s.emit('game:action', { type: 'stroke-start', payload: { x: 0.05, y, color: COLOR, size: 0.024 } });
      for (let i = 1; i <= 30; i++) {
        const x = i % 2 === 1 ? 0.95 : 0.05;
        s.emit('game:action', { type: 'stroke-points', payload: { points: [x, y] } });
        await sleep(40);
      }
      b.drawing = false;
    }
    if (v.phase === 'discussion' && !v.skipDiscussionVotes.includes(b.id)) s.emit('game:action', { type: 'skip-discussion' });
    if (v.phase === 'voting' && !v.hasVoted && !v.eliminatedPlayerIds.includes(b.id)) {
      setTimeout(() => s.emit('game:action', { type: 'vote', payload: 'skip' }), 300);
    }
  });
  return b;
}

/** Color del lienzo del admin en un punto normalizado. */
async function pixel(page, x, y) {
  return page.evaluate(([x, y]) => {
    const c = document.querySelector('[data-testid=drawing-canvas]');
    if (!c) return null;
    const d = c.getContext('2d').getImageData(Math.floor(x * c.width), Math.floor(y * c.height), 1, 1).data;
    return [d[0], d[1], d[2]];
  }, [x, y]);
}
const isRed = (p) => p && p[0] > 200 && p[1] < 120 && p[2] < 120;
const isDark = (p) => p && p[0] < 100 && p[1] < 100 && p[2] < 100;

(async () => {
  const browser = await launch();
  // E2E_MOBILE=1: la misma partida en un celular (dibujando con el dedo).
  const page = await browser.newPage(
    process.env.E2E_MOBILE === '1'
      ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'es-AR' }
      : { viewport: { width: 1280, height: 900 }, locale: 'es-AR' },
  );
  page.on('pageerror', (e) => log('PAGE ERROR', e.message));

  await page.goto(WEB);
  await page.getByPlaceholder(/Ingres[aá] tu apodo/).fill('Admin');
  await page.getByRole('button', { name: /Crear Sala/i }).click();
  await page.waitForURL(/\/room\/[A-Z0-9]{6}/);
  const code = page.url().split('/').pop();
  const bots = [['Sofi', 0.25], ['Lucas', 0.45], ['Vale', 0.65]].map(([n, l]) => bot(n, code, l));
  for (let i = 0; i < 40 && bots.some((b) => !b.id); i++) await sleep(250);

  check('el lobby ofrece el juego de Dibujo', await visible(page.getByText('Impostor dibujo')));
  await page.getByText('Impostor dibujo').click();
  await page.waitForTimeout(800);
  check('sólo ofrece listas dibujables', await visible(page.getByText('Animales').first()) &&
    !(await page.getByText('Países').isVisible().catch(() => false)) &&
    !(await page.getByText('Películas').isVisible().catch(() => false)));
  const sliders = page.locator('input[type=range]');
  await sliders.nth(0).focus(); await page.keyboard.press('Home');        // 1 partida
  await sliders.nth(1).focus(); await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(600);
  await sliders.nth(1).focus(); await page.keyboard.press('ArrowRight');   // tope 2 rondas
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/d1-lobby.png`, fullPage: true });

  await page.getByRole('button', { name: /Iniciar Juego/i }).click();
  await page.waitForTimeout(1500);
  check('la partida es de Dibujo', bots[0].view?.gameId === 'drawing' && bots[0].view?.phase === 'word-reveal');
  const impostorBot = bots.find((b) => b.view?.isImpostor);
  const innocentBot = bots.find((b) => !b.view?.isImpostor);
  if (impostorBot) check('el impostor no recibe la palabra', impostorBot.view.secretWord === null);
  check('los inocentes sí', typeof innocentBot.view.secretWord === 'string');
  await page.screenshot({ path: `${OUT}/d2-reveal.png` });

  let adminDrew = 0, sawLive = false, sawRound2Canvas = false;
  const deadline = Date.now() + 200000;
  while (Date.now() < deadline) {
    const v = bots[0].view;
    if (v?.phase === 'game-end') break;
    // Un bot dibujando: ¿el admin lo ve en vivo, antes de que termine su turno?
    const drawingBot = bots.find((b) => b.drawing);
    if (drawingBot && !sawLive) {
      await sleep(300);
      const y = drawingBot.line + (v.roundWithinPartida - 1) * 0.1;
      if (drawingBot.drawing && isRed(await pixel(page, 0.3, y))) {
        sawLive = true;
        await page.screenshot({ path: `${OUT}/d3-live.png` });
      }
    }
    const done = page.getByRole('button', { name: /^Listo$/ });
    if (await page.getByText('¡Te toca dibujar!').isVisible().catch(() => false) && adminDrew < v.roundWithinPartida) {
      const box = await page.getByTestId('drawing-canvas').boundingBox();
      const y0 = box.y + box.height * (0.85 - (v.roundWithinPartida - 1) * 0.08);
      check(`ronda ${v.roundWithinPartida}: "Listo" deshabilitado antes de dibujar`, await done.isDisabled());
      await page.mouse.move(box.x + box.width * 0.1, y0);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.5, y0, { steps: 25 });
      await page.mouse.up();
      await page.waitForTimeout(300);
      const ink = Number(await page.getByRole('progressbar').getAttribute('aria-valuenow'));
      check(`ronda ${v.roundWithinPartida}: la barra de tinta baja (${ink}%)`, ink >= 50 && ink <= 65);
      if (v.roundWithinPartida === 2) {
        sawRound2Canvas = isRed(await pixel(page, 0.5, bots[0].line));
        await page.screenshot({ path: `${OUT}/d4-round2.png` });
      }
      await done.click();
      adminDrew = v.roundWithinPartida;
      await page.waitForTimeout(500);
    }
    const skipDisc = page.getByRole('button', { name: /Saltear discusión/ });
    if (await skipDisc.isVisible().catch(() => false) && await skipDisc.isEnabled().catch(() => false)) {
      await skipDisc.click().catch(() => {});
    }
    const skipVote = page.getByRole('button', { name: /Saltear \(no expulsar/ });
    if (await skipVote.isVisible().catch(() => false)) {
      if (!results.voting) {
        results.voting = true;
        check('en la votación se ve el dibujo', await page.getByTestId('drawing-canvas').isVisible());
        await page.screenshot({ path: `${OUT}/d5-voting.png` });
      }
      await skipVote.click().catch(() => {});
      await page.getByRole('button', { name: /^Votar$/ }).click().catch(() => {});
    }
    await page.waitForTimeout(250);
  }

  const v = bots[0].view;
  check('el admin dibujó en las 2 rondas', adminDrew === 2);
  check('los trazos de los bots se vieron en vivo', sawLive);
  check('la ronda 2 sigue sobre el mismo dibujo', sawRound2Canvas);
  const budget = v.inkBudget;
  const botStrokes = v.strokes.filter((s) => bots.some((b) => b.id === s.playerId));
  const len = (p) => { let t = 0; for (let i = 2; i < p.length; i += 2) t += Math.hypot(p[i] - p[i - 2], (p[i + 1] - p[i - 1]) * 0.75); return t; };
  check(`el servidor cortó la tinta de los bots (${botStrokes.map((s) => len(s.points).toFixed(2)).join(', ')} ≤ ${budget})`,
    botStrokes.length === 6 && botStrokes.every((s) => len(s.points) <= budget + 0.01));
  check('6 trazos de bots + 2 del admin en el mismo lienzo', v.strokes.length === 8);
  check('el juego termina y muestra el puntaje', await visible(page.getByText('Puntaje'), 25000));
  check('el final muestra el dibujo y la palabra', await visible(page.getByText(/La palabra era/).first(), 3000) &&
    isRed(await pixel(page, 0.5, bots[0].line)) && isDark(await pixel(page, 0.3, 0.85)));
  await page.screenshot({ path: `${OUT}/d6-end.png`, fullPage: true });

  bots.forEach((b) => b.s.close());
  await browser.close();
  log(`${results.filter(Boolean).length}/${results.length} checks OK`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
