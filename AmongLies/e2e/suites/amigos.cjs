// Amigos de punta a punta con dos cuentas reales en dos navegadores.
const { WEB, OUT, launch, newPage, login, withAccounts, suite, visible } = require('../common.cjs');

const { log, check, done } = suite('amigos');
const USER_A = 'E2eAmigoA';
const USER_B = 'E2eAmigoB';

withAccounts([{ username: USER_A }, { username: USER_B }], async ([A, B]) => {
  const browser = await launch();

  const guest = await newPage(browser);
  await guest.goto(`${WEB}/amigos`);
  check('un invitado ve que necesita cuenta', await visible(guest.getByText('Para tener amigos necesitás una cuenta.')));

  const a = await login(browser, A);
  const b = await login(browser, B);
  check('el header muestra "Amigos"', await visible(a.getByRole('link', { name: 'Amigos' })));

  await a.getByRole('link', { name: 'Amigos' }).click();
  await a.waitForURL(/\/amigos/);
  await a.getByLabel('Buscar jugadores').fill('@' + USER_B.slice(0, 6));
  check('la búsqueda encuentra a B', await visible(a.getByText('@' + USER_B)));
  await a.getByRole('button', { name: 'Agregar' }).first().click();
  check('A: solicitud enviada', await visible(a.getByText('Solicitud enviada.')));
  check('A la ve en "enviadas"', await visible(a.getByText('Solicitudes enviadas')));

  check('B recibe el aviso en vivo', await visible(b.getByText('quiere ser tu amigo')));
  check('B tiene el contador en el header', (await b.getByRole('link', { name: /Amigos/ }).textContent()).includes('1'));
  await b.screenshot({ path: `${OUT}/amigos-1-request-toast.png` });
  await b.getByRole('button', { name: 'Ver' }).click();
  await b.waitForURL(/\/amigos/);
  await b.getByRole('button', { name: 'Aceptar' }).click();
  check('B: ahora son amigos', await visible(b.getByText('¡Ahora son amigos!')));
  check('A ve a B en línea, sin recargar', await visible(a.getByText('Amigos (1)')) && await visible(a.getByText('En línea')));

  // A crea una sala: B lo ve "En una sala" con el botón Unirme.
  await a.goto(WEB);
  await a.getByRole('button', { name: /Crear Sala/i }).click();
  await a.waitForURL(/\/room\/[A-Z0-9]{6}/);
  const code = a.url().split('/').pop();
  check('B ve a A "En una sala" con "Unirme"', await visible(b.getByText('En una sala'), 8000) && await visible(b.getByRole('button', { name: 'Unirme' })));
  await b.screenshot({ path: `${OUT}/amigos-2-friends.png` });

  // A invita a B desde el lobby.
  check('el lobby ofrece invitar a B', await visible(a.getByText('Invitar amigos')) && await visible(a.getByText('@' + USER_B)));
  await a.getByRole('button', { name: 'Invitar', exact: true }).click();
  check('A: invitado', await visible(a.getByText('Invitado ✓')));
  await a.screenshot({ path: `${OUT}/amigos-3-lobby-invite.png` });
  check('B recibe la invitación en vivo', await visible(b.getByText('te invitó a su sala')));
  await b.screenshot({ path: `${OUT}/amigos-4-invite-toast.png` });
  await b.getByRole('status').filter({ hasText: 'te invitó' }).getByRole('button', { name: 'Unirme' }).click();
  await b.waitForURL(new RegExp(`/room/${code}`));
  await b.getByRole('button', { name: /^Unirse$/ }).click();
  check('B entra a la sala de A', await visible(a.getByText(USER_B, { exact: true }).first(), 10000));

  // B elimina a A.
  await b.goto(`${WEB}/amigos`);
  b.once('dialog', (d) => d.accept());
  await b.getByRole('button', { name: 'Eliminar' }).click();
  check('B eliminó a A', await visible(b.getByText('Todavía no tenés amigos')));
  await a.waitForTimeout(1000);
  await a.goto(`${WEB}/amigos`);
  check('A tampoco lo tiene más', await visible(a.getByText('Amigos (0)')));

  await browser.close();
}).then(done, (e) => { console.error(e); process.exit(1); });
