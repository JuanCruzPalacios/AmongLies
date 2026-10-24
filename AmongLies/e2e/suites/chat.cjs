// Chat con mensajes larguísimos (lobby y partida, escritorio y celular), menú ☰ e inglés.
const { WEB, SERVER, OUT, launch } = require('../common.cjs');
const { io } = require('socket.io-client');
const { randomUUID } = require('crypto');
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const results = [];
const check = (name, ok) => { results.push(!!ok); log(ok ? 'OK  ' : 'FAIL', name); };
const LONG = 'a'.repeat(190);
const URL = 'https://ejemplo.com/' + 'x'.repeat(170);

async function noHorizontalScroll(page) {
  return page.evaluate(() => {
    const doc = document.documentElement.scrollWidth <= document.documentElement.clientWidth;
    // Ningún contenedor del chat puede scrollear de costado.
    const inner = [...document.querySelectorAll('*')].every((el) => el.scrollWidth <= el.clientWidth + 1 || getComputedStyle(el).overflowX === 'hidden' || getComputedStyle(el).overflowX === 'visible' && el.scrollWidth <= document.documentElement.clientWidth);
    return doc && inner;
  });
}

(async () => {
  const browser = await launch();
  for (const [label, viewport] of [['escritorio', { width: 1280, height: 900 }], ['celular', { width: 360, height: 740 }]]) {
    const page = await (await browser.newContext({ viewport, locale: 'es-AR', hasTouch: label === 'celular' })).newPage();
    await page.goto(WEB);
    await page.getByPlaceholder(/Ingres[aá] tu apodo/).fill('Largo');
    await page.getByRole('button', { name: /Crear Sala/i }).click();
    await page.waitForURL(/\/room\//);
    const code = page.url().split('/').pop();
    const bots = ['Sofi', 'Lucas', 'Vale'].map((n) => {
      const s = io(SERVER, { transports: ['websocket'], forceNew: true, auth: { sessionToken: randomUUID() } });
      s.on('session:ready', () => s.emit('room:join', { code, nickname: n, avatarId: 'cat', locale: 'es' }));
      return s;
    });
    await page.waitForTimeout(1200);
    bots[0].emit('chat:send', { message: LONG });
    bots[1].emit('chat:send', { message: URL });
    await page.waitForTimeout(800);
    const bubble = page.getByText(LONG).first();
    const box = await bubble.boundingBox();
    check(`${label} · lobby: el mensaje largo se corta en varios renglones (alto ${Math.round(box?.height)}px)`, box && box.height > 40);
    check(`${label} · lobby: nada scrollea de costado`, await noHorizontalScroll(page));
    await page.screenshot({ path: `${OUT}/chat-lobby-${label}.png`, fullPage: true });

    await page.getByText('El Impostor', { exact: true }).first().click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /Iniciar Juego/i }).click();
    await page.waitForTimeout(1200);
    bots[2].emit('chat:send', { message: LONG + 'b' });
    await page.waitForTimeout(800);
    if (label === 'celular') await page.getByRole('button', { name: /Abrir chat/ }).click();
    await page.waitForTimeout(600);
    const gameBubble = page.getByText(LONG + 'b').locator('visible=true').first();
    const gbox = await gameBubble.boundingBox();
    check(`${label} · partida: se corta en varios renglones (alto ${Math.round(gbox?.height)}px)`, gbox && gbox.height > 40);
    check(`${label} · partida: nada scrollea de costado`, await noHorizontalScroll(page));
    await page.screenshot({ path: `${OUT}/chat-juego-${label}.png` });
    bots.forEach((s) => s.close());
    await page.context().close();
  }

  // Menú ☰ en el celular y la interfaz en inglés.
  const m = await (await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, locale: 'es-AR' })).newPage();
  await m.goto(WEB);
  await m.getByRole('button', { name: 'Menú' }).click();
  await m.getByRole('link', { name: 'Workshop' }).click();
  check('celular: el menú ☰ lleva al workshop', await m.waitForURL(/\/workshop/).then(() => true).catch(() => false));
  await m.getByRole('button', { name: 'Español' }).click();
  await m.getByRole('listbox').getByRole('option', { name: /English/ }).click();
  check('el selector de idioma funciona tocando', await m.getByRole('tab', { name: 'Explore' }).isVisible().catch(() => false));
  await m.goto(WEB);
  await m.getByPlaceholder(/nickname|apodo/i).fill('Eng');
  await m.getByRole('button', { name: /Create Room/i }).click();
  await m.waitForURL(/\/room\//);
  const code = m.url().split('/').pop();
  const bots = ['Ann', 'Bob', 'Cid'].map((n) => {
    const s = io(SERVER, { transports: ['websocket'], forceNew: true, auth: { sessionToken: randomUUID() } });
    s.on('session:ready', () => s.emit('room:join', { code, nickname: n, avatarId: 'cat', locale: 'en' }));
    s.on('game:state-update', (v) => {
      if (v.phase === 'turns' && v.isMyTurn) s.emit('game:action', { type: 'submit-word', payload: `${n}${Math.random()}` });
      if (v.phase === 'discussion' && !v.skipDiscussionVotes.includes(v.turnOrder[0] + 'x')) s.emit('game:action', { type: 'skip-discussion' });
      if (v.phase === 'voting' && !v.hasVoted) s.emit('game:action', { type: 'vote', payload: 'skip' });
    });
    return s;
  });
  await m.waitForTimeout(1500);
  await m.getByText('The Impostor', { exact: true }).first().click();
  await m.waitForTimeout(500);
  await m.screenshot({ path: `${OUT}/en-lobby.png`, fullPage: true });
  const body = await m.locator('body').innerText();
  const spanish = ['Jugadores', 'Sala pública', 'Configuración', 'Listas de palabras', 'Iniciar Juego', 'Sin mensajes', 'Cupo'].filter((w) => body.includes(w));
  check(`lobby en inglés sin textos en castellano (${spanish.join(', ') || 'ninguno'})`, spanish.length === 0);
  bots.forEach((s) => s.close());
  await browser.close();
  log(`${results.filter(Boolean).length}/${results.length} checks OK`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
