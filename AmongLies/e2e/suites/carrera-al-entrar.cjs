// Un mensaje de chat enviado justo cuando el otro entra (mientras su navegador
// va a la sala) no se pierde (bug #29).
const { WEB, launch, newPage, bot, suite, visible } = require('../common.cjs');

const { log, check, done } = suite('carrera-al-entrar');

(async () => {
  const browser = await launch();
  let ok = 0;
  const tries = 5;
  for (let i = 0; i < tries; i++) {
    const page = await newPage(browser);
    // A es un bot: crea la sala y manda un mensaje apenas entra B.
    const a = bot('Rapido');
    const code = await new Promise((resolve) => {
      a.s.on('session:ready', () => a.s.emit('room:create', { nickname: 'Rapido', avatarId: 'fox', locale: 'es' }));
      a.s.on('room:created', ({ room }) => resolve(room.code));
    });
    a.s.on('room:player-joined', () => a.s.emit('chat:send', { message: `hola-${i}` }));
    await page.goto(WEB);
    await page.getByPlaceholder(/Ingres[aá] tu apodo/).fill('Lento');
    await page.getByRole('button', { name: 'Unirse a Sala' }).click();
    await page.getByPlaceholder(/C[oó]digo de sala/).fill(code);
    await page.getByRole('button', { name: /^Unirse$/ }).click();
    const seen = await visible(page.getByText(`hola-${i}`));
    log(`intento ${i + 1}:`, seen ? 'llegó' : 'se perdió');
    if (seen) ok++;
    a.s.close();
    await page.context().close();
  }
  check(`los ${tries} mensajes llegaron (${ok}/${tries})`, ok === tries);
  await browser.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
