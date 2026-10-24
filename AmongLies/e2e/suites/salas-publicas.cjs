// Salas públicas: hacer pública, listado con filtros, unirse, cupo y volver a privada.
const { WEB, SERVER, OUT, launch } = require('../common.cjs');
const { io } = require('socket.io-client');
const { randomUUID } = require('crypto');
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const results = [];
const check = (name, ok) => { results.push(!!ok); log(ok ? 'OK  ' : 'FAIL', name); };
const visible = (loc, ms = 8000) => loc.waitFor({ state: 'visible', timeout: ms }).then(() => true).catch(() => false);
const gone = (loc, ms = 8000) => loc.waitFor({ state: 'detached', timeout: ms }).then(() => true).catch(() => false);

function bot(name, code) {
  const s = io(SERVER, { transports: ['websocket'], forceNew: true, auth: { sessionToken: randomUUID() } });
  const b = { s, room: null };
  s.on('session:ready', () => s.emit('room:join', { code, nickname: name, avatarId: 'cat', locale: 'es' }));
  s.on('room:joined', ({ room }) => { b.room = room; });
  s.on('room:updated', ({ room }) => { b.room = room; });
  s.on('room:error', (e) => { b.error = e.code; });
  return b;
}

(async () => {
  const browser = await launch();
  const page = async (nick) => {
    const p = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-AR' })).newPage();
    await p.goto(WEB);
    await p.getByPlaceholder(/Ingres[aá] tu apodo/).fill(nick);
    return p;
  };
  const a = await page('Anfitrion');
  const b = await page('Visitante');
  await a.getByRole('button', { name: /Crear Sala/i }).click();
  await a.waitForURL(/\/room\/[A-Z0-9]{6}/);
  const code = a.url().split('/').pop();
  const row = b.getByRole('listitem').filter({ hasText: 'de Anfitrion' });
  check('una sala nueva es privada: no aparece en el listado', !(await visible(row, 6000)));

  await a.getByRole('switch', { name: 'Sala pública' }).click();
  await a.getByLabel('Cupo').selectOption('4');
  await a.getByText('Impostor dibujo').click();
  check('al hacerla pública aparece con juego, idioma, jugadores y estado', await visible(row.filter({ hasText: '🎨 Impostor dibujo' }), 8000) && await visible(row.getByText(/ES · 1\/4 · esperando/)));
  await b.screenshot({ path: `${OUT}/p1-home.png`, fullPage: true });
  await b.getByLabel('Juego').selectOption('time');
  check('el filtro por juego la oculta', await gone(row, 3000));
  await b.getByLabel('Juego').selectOption('drawing');
  await b.getByLabel('Idioma').selectOption('es');
  check('con su juego e idioma vuelve a aparecer', await visible(row));

  await row.getByRole('button', { name: 'Unirse' }).click();
  check('se une desde el listado', await b.waitForURL(new RegExp(`/room/${code}`), { timeout: 10000 }).then(() => true).catch(() => false) && await visible(a.getByText('Visitante')));

  // Cupo de 4: con dos bots se llena.
  const bots = [bot('Bot1', code), bot('Bot2', code)];
  await a.waitForTimeout(1500);
  const extra = bot('Bot3', code);
  await a.waitForTimeout(1500);
  check('el cupo se respeta (el quinto no entra)', extra.error === 'ROOM_FULL');
  const c = await page('Otro');
  const rowC = c.getByRole('listitem').filter({ hasText: 'de Anfitrion' });
  check('llena: no aparece con "sólo las que se pueden unir"', !(await visible(rowC, 6000)));
  await c.getByLabel(/Sólo las que se pueden unir/).uncheck();
  check('sin ese filtro aparece como "Llena", sin poder unirse', await visible(rowC.getByRole('button', { name: 'Llena' })) && await rowC.getByRole('button', { name: 'Llena' }).isDisabled());

  // Idioma de la sala en el Dibujo: sólo listas dibujables.
  await a.getByLabel('Idioma de la sala').selectOption('en');
  await a.waitForTimeout(1000);
  const lists = bots[0].room.gameSettings.selectedWordLists;
  check(`al cambiar el idioma quedan las listas dibujables en inglés (${lists.join(', ')})`, lists.length === 5 && lists.every((id) => id.startsWith('en-')) && !lists.includes('en-countries'));

  await a.getByRole('switch', { name: 'Sala pública' }).click();
  await c.getByLabel(/Sólo las que se pueden unir/).uncheck().catch(() => {});
  check('al volver a privada desaparece', await gone(rowC, 8000));
  await a.screenshot({ path: `${OUT}/p2-lobby.png`, fullPage: true });

  [...bots, extra].forEach((x) => x.s.close());
  await browser.close();
  log(`${results.filter(Boolean).length}/${results.length} checks OK`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
