// Cuenta + partida de El Impostor con ajustes, puntaje y estadísticas en el perfil.
const { WEB, OUT, launch, login, bot: socketBot, withAccounts, suite, visible } = require('../common.cjs');

const { log, check, done } = suite('cuenta-y-estadisticas');

function bot(name, code) {
  return socketBot(name, code, {
    onState(v, b) {
      const s = b.s;
      if (v.phase === 'turns' && v.isMyTurn) setTimeout(() => s.emit('game:action', { type: 'submit-word', payload: `${name}-${v.roundWithinPartida}-${Math.random()}` }), 200);
      if (v.phase === 'discussion' && !v.skipDiscussionVotes.includes(b.id)) s.emit('game:action', { type: 'skip-discussion' });
      if (v.phase === 'voting' && !v.hasVoted && !v.eliminatedPlayerIds.includes(b.id)) {
        // Todos los bots votan "saltear": nadie sale y las rondas siguen hasta el tope.
        setTimeout(() => s.emit('game:action', { type: 'vote', payload: 'skip' }), 200);
      }
    },
  });
}

withAccounts([{ username: 'StatsE2E' }], async ([account]) => {
  const browser = await launch();
  const page = await login(browser, account);
  check('la cuenta inició sesión', await visible(page.getByText('@StatsE2E').first()));
  await page.getByRole('button', { name: /Crear Sala/i }).click();
  await page.waitForURL(/\/room\/[A-Z0-9]{6}/);
  const code = page.url().split('/').pop();
  const bots = ['Sofi', 'Lucas', 'Vale'].map((n) => bot(n, code));
  await page.waitForTimeout(1500);

  await page.getByText('El Impostor').first().click();
  await page.waitForTimeout(600);
  // Ajustes: 1 partida, tope de 1 ronda, pista de categoría y voto secreto
  const sliders = page.locator('input[type=range]');
  await sliders.nth(0).focus(); await page.keyboard.press('Home');
  await sliders.nth(1).focus(); await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  // Los interruptores del juego (el de "Sala pública" es de la sala, no del juego).
  const switches = page.locator('[role=switch]:not([aria-labelledby])');
  check('aparecen los 3 interruptores del Impostor', (await switches.count()) === 3);
  await switches.nth(0).click(); // pista de categoría
  await switches.nth(1).click(); // voto secreto
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/cuenta-lobby.png`, fullPage: true });

  await page.getByRole('button', { name: /Iniciar Juego/i }).click();
  await page.waitForTimeout(1500);
  const settings = bots[0].view?.settings;
  check('ajustes aplicados en la partida (pista, voto secreto, tope 1)', settings?.impostorCategoryHint === true && settings?.secretVote === true && settings?.maxRoundsPerPartida === 1);
  const botImpostor = bots.find((b) => b.view?.isImpostor);
  if (botImpostor) check('el impostor ve la categoría pero no la palabra', typeof botImpostor.view.category === 'string' && botImpostor.view.secretWord === null);

  let voted = false;
  const deadline = Date.now() + 150000;
  while (Date.now() < deadline) {
    const input = page.getByPlaceholder(/Escrib[eí] una palabra/);
    if (await input.isVisible().catch(() => false) && await input.isEnabled().catch(() => false)) {
      await input.fill(`admin-${Date.now()}`);
      await page.getByRole('button', { name: /Enviar palabra/i }).click().catch(() => {});
    }
    const skipDisc = page.getByRole('button', { name: /Saltear discusión/ });
    if (await skipDisc.isVisible().catch(() => false) && await skipDisc.isEnabled().catch(() => false)) await skipDisc.click().catch(() => {});
    const skipVote = page.getByRole('button', { name: /Saltear \(no expulsar/ });
    if (!voted && await skipVote.isVisible().catch(() => false)) {
      await page.screenshot({ path: `${OUT}/cuenta-voting.png` });
      await skipVote.click();
      await page.getByRole('button', { name: /^Votar$/ }).click();
      voted = true;
    }
    if (bots[0].view?.phase === 'vote-results') {
      check('voto secreto: no llega quién votó a quién', Object.keys(bots[0].view.votes).length === 0);
      const counts = bots[0].view.results.at(-1)?.voteCounts;
      check('llega el recuento con los 4 votos a "saltear"', counts?.skip === 4);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/cuenta-results.png` });
      break;
    }
    await page.waitForTimeout(500);
  }

  // Tope de 1 ronda sin expulsados → ganan los impostores y termina el juego
  await visible(page.getByRole('button', { name: /Volver al Lobby/i }), 20000);
  const end = bots[0].view;
  const impostorId = end.partidaResults[0]?.impostorIds[0];
  check('gana el impostor por tope de rondas', end.partidaResults[0]?.reason === 'max-rounds' && end.partidaResults[0]?.winner === 'impostor');
  check('el impostor suma 2 (sobrevivir) + 3 (ganar) = 5', end.scores[impostorId] === 5);
  check('los inocentes que votaron "saltear" suman 0', Object.entries(end.scores).every(([id, pts]) => id === impostorId || pts === 0));
  check('la pantalla final muestra el puntaje', await visible(page.getByText('Puntaje')));
  await page.screenshot({ path: `${OUT}/cuenta-end.png`, fullPage: true });

  bots.forEach((b) => b.s.close());
  await page.waitForTimeout(3000); // el servidor guarda las estadísticas en segundo plano
  await page.goto(`${WEB}/perfil`);
  check('el perfil muestra las estadísticas', await visible(page.getByText('Juegos'), 10000));
  await page.screenshot({ path: `${OUT}/cuenta-profile.png`, fullPage: true });

  await browser.close();
}).then(done, (e) => { console.error(e); process.exit(1); });
