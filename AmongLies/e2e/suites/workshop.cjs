// Workshop de punta a punta: autora (A), quien descarga (B), un invitado, y el lobby con bots.
const { WEB, OUT, launch, newPage, login, bot, withAccounts, suite, visible } = require('../common.cjs');

const { log, check, done } = suite('workshop');
const USER_A = 'E2eAutora';
const TITLE = 'Bichos raros E2E';
const WORDS_V1 = ['Ornitorrinco', 'Axolote', 'Pangolín', 'Tardígrado', 'Okapi', 'Quokka', 'Narval', 'Tapir', 'Fosa', 'Dugongo', 'Aye-aye', 'Mandril'];

withAccounts([{ username: USER_A }, { username: 'E2eLector' }], async ([A, B]) => {
  const browser = await launch();
  const a = await login(browser, A);
  const b = await login(browser, B);

  // ── A crea una lista ──
  await a.getByRole('link', { name: 'Workshop' }).click();
  await a.getByRole('tab', { name: 'Mi colección' }).click();
  await a.getByRole('link', { name: /Nueva lista/ }).click();
  await a.getByLabel('Nombre').fill(TITLE);
  await a.getByLabel('Categoría').selectOption('animals');
  await a.getByLabel(/Se pueden dibujar/).check();
  await a.getByLabel(/Palabras/).fill(WORDS_V1.slice(0, 5).join('\n'));
  check('con 5 palabras no deja guardar', await a.getByRole('button', { name: 'Guardar' }).isDisabled());
  await a.getByLabel(/Palabras/).fill([...WORDS_V1, 'axolote', '  '].join('\n'));
  check('cuenta 12 (sin repetidas ni vacías)', await visible(a.getByText('12 palabras (entre 10 y 300)')));
  await a.getByRole('button', { name: 'Guardar' }).click();
  check('la lista queda privada en su colección', await visible(a.getByText(TITLE)) && await visible(a.getByText('Privada')));
  await a.getByRole('button', { name: 'Publicar' }).click();
  check('A la publica', await visible(a.getByText('Publicada', { exact: true })));

  // ── Un invitado la ve en Explorar ──
  const guest = await newPage(browser);
  await guest.goto(`${WEB}/workshop`);
  await guest.getByLabel('Buscar por nombre').fill('Bichos raros');
  check('un invitado la ve publicada', await visible(guest.getByText(TITLE)) && await visible(guest.getByText('@' + USER_A + ' ·', { exact: false })));
  check('el invitado no puede guardarla', !(await guest.getByRole('button', { name: 'Guardar en mi colección' }).isVisible()));

  // ── B la encuentra con filtros, le da like y la guarda ──
  await b.goto(`${WEB}/workshop`);
  await b.getByLabel('Juego').selectOption('drawing');
  await b.getByLabel('Categoría').selectOption('animals');
  await b.getByLabel('Buscar por nombre').fill('Bichos');
  const card = b.getByRole('listitem').filter({ hasText: TITLE });
  check('B la encuentra filtrando por Dibujo + Animales', await visible(card));
  await card.getByRole('button', { name: 'Me gusta' }).click();
  check('like: 1', await visible(card.getByRole('button', { name: 'Me gusta' }).filter({ hasText: '♥ 1' })));
  await card.getByRole('button', { name: 'Ver' }).click();
  check('B ve las palabras', await visible(card.getByText('Ornitorrinco')));
  await card.getByRole('button', { name: 'Guardar en mi colección' }).click();
  check('queda en su colección', await visible(card.getByText('En tu colección ✓')));
  await b.screenshot({ path: `${OUT}/workshop-1-explore.png`, fullPage: true });
  await b.getByLabel('Juego').selectOption('time');
  check('filtrando por Tiempo no aparece (no usa listas)', await b.getByRole('listitem').filter({ hasText: TITLE }).waitFor({ state: 'detached', timeout: 5000 }).then(() => true).catch(() => false));

  // ── A saca una versión nueva → la copia de B queda vieja ──
  await a.getByRole('link', { name: 'Editar' }).click();
  await a.getByLabel(/Palabras/).fill([...WORDS_V1.slice(1), 'Capibara'].join('\n'));
  await a.getByRole('button', { name: 'Guardar' }).click();
  await a.getByText(TITLE).waitFor();
  await b.goto(`${WEB}/workshop?tab=mine`);
  const copy = b.getByRole('listitem').filter({ hasText: TITLE });
  check('B: su copia dice "Hay una versión nueva"', await visible(copy.getByText('Hay una versión nueva')));
  await b.screenshot({ path: `${OUT}/workshop-2-outdated.png`, fullPage: true });
  await copy.getByRole('button', { name: 'Actualizar' }).click();
  check('actualizar la deja al día', await visible(b.getByText('Copia actualizada.')) &&
    await copy.getByText('Hay una versión nueva').waitFor({ state: 'detached', timeout: 5000 }).then(() => true).catch(() => false));
  await copy.getByRole('button', { name: 'Ver' }).click();
  check('ahora tiene la palabra nueva', await visible(copy.getByText('Capibara')));

  // ── B edita su copia → "Editada por vos" ──
  await copy.getByRole('link', { name: 'Editar' }).click();
  await b.getByLabel(/Palabras/).fill([...WORDS_V1, 'Yeti'].join('\n'));
  await b.getByRole('button', { name: 'Guardar' }).click();
  check('su copia editada queda marcada', await visible(b.getByRole('listitem').filter({ hasText: TITLE }).getByText('Editada por vos')));

  // ── Lobby: A usa su lista del workshop ──
  await a.goto(WEB);
  await a.getByRole('button', { name: /Crear Sala/i }).click();
  await a.waitForURL(/\/room\/[A-Z0-9]{6}/);
  const code = a.url().split('/').pop();
  const bots = ['Sofi', 'Lucas', 'Vale'].map((n) => bot(n, code));
  await a.getByText('El Impostor', { exact: true }).first().click();
  const mine = a.getByRole('button', { name: new RegExp(TITLE) });
  check('el lobby ofrece "Tus listas del workshop"', await visible(a.getByText('Tus listas del workshop')) && await visible(mine));
  await mine.click();
  await a.waitForTimeout(1200);
  for (const name of ['Animales', 'Comida', 'Paises', 'Deportes', 'Profesiones', 'Peliculas', 'Objetos', 'Marcas']) {
    const btn = a.getByRole('button', { name: new RegExp('^' + name) });
    if (await btn.isVisible().catch(() => false)) { await btn.click(); await a.waitForTimeout(300); }
  }
  await a.waitForTimeout(1000);
  const room = bots[0].room;
  log('elegidas:', JSON.stringify(room?.gameSettings.selectedWordLists), 'custom:', JSON.stringify(room?.customWordLists.map((l) => l.title)));
  check('la sala sólo tiene elegida la lista del workshop', room?.gameSettings.selectedWordLists.length === 1 && room.customWordLists.length === 1);
  check('los demás no reciben las palabras de la lista', !JSON.stringify(room).includes('Capibara'));
  await a.screenshot({ path: `${OUT}/workshop-3-lobby.png`, fullPage: true });

  // ── Presets: guardar y aplicar ──
  const ink = a.locator('input[type=range]').nth(3); // turno (seg) del Impostor
  await a.getByText('El Impostor', { exact: true }).first().click();
  a.once('dialog', (d) => d.accept('Impostor rápido E2E'));
  const before = bots[0].room.gameSettings.turnTimeSeconds;
  await ink.focus(); await a.keyboard.press('Home'); await a.waitForTimeout(800);
  const saved = bots[0].room.gameSettings.turnTimeSeconds;
  await a.getByRole('button', { name: 'Guardar como preset' }).click();
  check('guarda el preset', await visible(a.getByText('Preset guardado en tu colección.')));
  await ink.focus(); await a.keyboard.press('End'); await a.waitForTimeout(800);
  check(`cambian los ajustes (${before} → ${saved} → ${bots[0].room.gameSettings.turnTimeSeconds})`, bots[0].room.gameSettings.turnTimeSeconds !== saved);
  await a.getByLabel('Presets').selectOption({ label: 'Impostor rápido E2E' });
  await a.getByRole('button', { name: 'Aplicar' }).click();
  await a.waitForTimeout(1000);
  check('aplicar el preset vuelve a esos ajustes', bots[0].room.gameSettings.turnTimeSeconds === saved);
  check('el preset no tocó las listas elegidas', bots[0].room.gameSettings.selectedWordLists.length === 1);

  // ── La partida usa la lista del workshop ──
  await a.getByRole('button', { name: /Iniciar Juego/i }).click();
  await a.waitForTimeout(2000);
  const innocent = bots.find((x) => x.view && !x.view.isImpostor);
  const allowed = [...WORDS_V1.slice(1), 'Capibara'];
  check(`la palabra secreta sale de la lista (${innocent?.view?.secretWord})`, allowed.includes(innocent?.view?.secretWord));

  bots.forEach((x) => x.s.close());
  await browser.close();
}).then(done, (e) => { console.error(e); process.exit(1); });
