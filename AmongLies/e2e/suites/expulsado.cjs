// El anfitrión saca a un jugador: vuelve al inicio con un aviso (antes volvía sin explicación).
const { WEB, launch, newPage, bot, suite, visible, waitFor } = require('../common.cjs');

const { check, out, done } = suite('expulsado');

(async () => {
  const browser = await launch();
  const page = await newPage(browser);
  const host = bot('Anfitrion');
  const code = await new Promise((resolve) => {
    host.s.on('session:ready', () => host.s.emit('room:create', { nickname: 'Anfitrion', avatarId: 'fox', locale: 'es' }));
    host.s.on('room:created', ({ room }) => { host.room = room; resolve(room.code); });
    host.s.on('room:player-joined', ({ player }) => host.room.players.push(player));
  });
  await page.goto(`${WEB}/room/${code}`);
  await page.getByPlaceholder(/Ingres[aá] tu apodo/).fill('Echado');
  await page.getByRole('button', { name: /^Unirse$/ }).click();
  const joined = () => host.room?.players.find((p) => p.nickname === 'Echado');
  check('entra a la sala', await waitFor(() => Boolean(joined())));
  const echado = joined();
  host.s.emit('room:kick', { playerId: echado.id });
  check('vuelve al inicio', await page.waitForURL(WEB + '/', { timeout: 10000 }).then(() => true).catch(() => false));
  check('con el aviso "El anfitrión te sacó de la sala."', await visible(page.getByText('El anfitrión te sacó de la sala.')));
  await page.screenshot({ path: out('aviso.png') });
  host.s.close();
  await browser.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
