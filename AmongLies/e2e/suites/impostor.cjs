// El Impostor de punta a punta: 1 admin en el navegador + 3 bots por socket.
const { WEB, launch, newPage, bot, suite, visible, sleep } = require('../common.cjs');

const { log, check, out, done } = suite('impostor');
let pageErrors = 0;

function player(name, code) {
  let clue = 0;
  return bot(name, code, {
    onState(v, b) {
      if (v.phase === 'turns' && v.isMyTurn) {
        setTimeout(() => b.s.emit('game:action', { type: 'submit-word', payload: `${name}-pista-${++clue}` }), 300);
      }
      if (v.phase === 'discussion' && !v.skipDiscussionVotes.includes(b.id)) b.s.emit('game:action', { type: 'skip-discussion' });
      if (v.phase === 'voting' && !v.hasVoted && !v.eliminatedPlayerIds.includes(b.id)) {
        const target = v.turnOrder.find((id) => id !== b.id && !v.eliminatedPlayerIds.includes(id));
        setTimeout(() => b.s.emit('game:action', { type: 'vote', payload: target }), 300);
      }
    },
  });
}

(async () => {
  const browser = await launch();
  const page = await newPage(browser);
  page.on('pageerror', () => pageErrors++);

  await page.goto(WEB);
  await page.getByPlaceholder(/Ingres[aá] tu apodo/).fill('Admin');
  await page.getByRole('button', { name: /Crear Sala/i }).click();
  await page.waitForURL(/\/room\/[A-Z0-9]{6}/);
  const code = page.url().split('/').pop();
  log('sala', code);

  const bots = ['Sofi', 'Lucas', 'Vale'].map((n) => player(n, code));
  await sleep(1500);
  await page.getByText('El Impostor').first().click();
  await sleep(500);
  // Partidas = 1 (el primer slider)
  await page.locator('input[type=range]').first().focus();
  await page.keyboard.press('Home');
  await sleep(500);
  await page.screenshot({ path: out('lobby.png'), fullPage: true });

  await page.getByRole('button', { name: /Iniciar Juego/i }).click();
  check('la partida empieza', await visible(page.getByText(/palabra|impostor/i).first(), 10000));

  const phases = new Set();
  let clue = 0;
  const deadline = Date.now() + 240000;
  while (Date.now() < deadline) {
    const phase = bots[0].view?.phase;
    if (phase) phases.add(phase);
    if (phase === 'game-end') break;
    const input = page.getByPlaceholder(/Escrib[eí] una palabra/);
    if (await input.isVisible().catch(() => false) && await input.isEnabled().catch(() => false)) {
      await input.fill(`admin-pista-${++clue}`);
      await page.getByRole('button', { name: /Enviar palabra/i }).click().catch(() => {});
    }
    const skip = page.getByRole('button', { name: /Saltear discusión/ });
    if (await skip.isVisible().catch(() => false) && await skip.isEnabled().catch(() => false)) await skip.click().catch(() => {});
    const vote = page.getByRole('button', { name: /^Votar$/ });
    if (await vote.isVisible().catch(() => false)) {
      await page.getByText('Sofi', { exact: true }).last().click().catch(() => {});
      await vote.click().catch(() => {});
    }
    await sleep(500);
  }
  log('fases:', [...phases].join(' → '));
  check('pasa por turnos, discusión y votación', ['turns', 'discussion', 'voting'].every((p) => phases.has(p)));
  check('llega al final de la partida', bots[0].view?.phase === 'game-end');
  check('hay resultados de la partida', (bots[0].view?.partidaResults?.length ?? 0) > 0);
  check('ningún bot recibió errores', bots.every((b) => b.errors.length === 0));
  await sleep(1500);
  await page.screenshot({ path: out('final.png'), fullPage: true });

  await page.getByRole('button', { name: /Volver al Lobby/i }).click();
  check('vuelve al lobby', await visible(page.getByRole('button', { name: /Iniciar Juego/i })));
  check('sin errores en la página', pageErrors === 0);

  bots.forEach((b) => b.s.close());
  await browser.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
