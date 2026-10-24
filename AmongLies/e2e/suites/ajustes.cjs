// Ajustes y sonido: idioma, preferencias guardadas, efectos/música, privacidad, contraseña y borrar cuenta.
const { WEB, OUT, PASSWORD, launch, bot, selectRows, withAccounts, suite, visible } = require('../common.cjs');

const { log, check, done } = suite('ajustes');
const USER = 'E2eAjustes';
// Cuenta los osciladores que arrancan (cada nota de un efecto o de la música).
const COUNT_OSC = `(() => { window.__osc = 0; const C = window.AudioContext; const orig = C.prototype.createOscillator;
  C.prototype.createOscillator = function () { window.__osc++; return orig.call(this); }; })();`;
const osc = (p) => p.evaluate(() => window.__osc);

withAccounts([{ username: USER }], async ([account]) => {
  const browser = await launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-AR' });
  await ctx.addInitScript(COUNT_OSC);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log('PAGE ERROR', e.message));

  // ── Invitado: idioma y sonido ──
  await page.goto(`${WEB}/ajustes`);
  check('un invitado ve idioma, sonido y avisos (sin cuenta)', await visible(page.getByText('Estás jugando como invitado.')));
  await page.getByRole('button', { name: /English/ }).click();
  check('cambiar el idioma traduce la página', await visible(page.getByRole('heading', { name: 'Settings' })));
  await page.getByRole('button', { name: /Español/ }).click();
  await page.getByRole('switch', { name: /Música de fondo/ }).check();
  await page.getByRole('switch', { name: /Mostrar avisos/ }).uncheck();
  await page.reload();
  check('las preferencias quedan guardadas al recargar', await page.getByRole('switch', { name: /Música de fondo/ }).isChecked() && !(await page.getByRole('switch', { name: /Mostrar avisos/ }).isChecked()));
  await page.mouse.click(5, 5); // primera interacción: desbloquea el audio
  const before = await osc(page);
  await page.waitForTimeout(4500);
  check(`con la música prendida suenan notas (${(await osc(page)) - before})`, (await osc(page)) - before >= 4);
  await page.getByRole('switch', { name: /Música de fondo/ }).uncheck();
  await page.waitForTimeout(500);
  const afterOff = await osc(page);
  await page.waitForTimeout(4500);
  check('al apagarla deja de sonar', (await osc(page)) === afterOff);

  // Efectos: alguien entra a la sala → "join". Con los efectos apagados, nada.
  await page.goto(WEB);
  await page.getByPlaceholder('Ingresa tu apodo...').fill('Oyente');
  await page.getByRole('button', { name: /Crear Sala/i }).click();
  await page.waitForURL(/\/room\/[A-Z0-9]{6}/);
  const code = page.url().split('/').pop();
  const join = async (name) => {
    const b = bot(name, code);
    await page.waitForTimeout(1200);
    return b.s;
  };
  let n = await osc(page);
  const b1 = await join('Bot1');
  check('con efectos: cuando entra alguien suena', (await osc(page)) > n);
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('amonglies-settings'));
    raw.state.sfxOn = false;
    localStorage.setItem('amonglies-settings', JSON.stringify(raw));
  });
  await page.reload();
  await page.mouse.click(5, 5);
  await page.waitForTimeout(800);
  n = await osc(page);
  const b2 = await join('Bot2');
  check('sin efectos: no suena', (await osc(page)) === n);
  b1.close(); b2.close();

  // ── Cuenta ──
  await page.goto(`${WEB}/login`);
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Contraseña').fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).last().click();
  await page.waitForURL(WEB + '/');
  await page.getByRole('link', { name: 'Ajustes' }).click();
  check('con cuenta aparecen privacidad y cuenta', await visible(page.getByText('Aparecer desconectado')) && await visible(page.getByText('@' + USER).first()));
  await page.getByRole('switch', { name: /Aparecer desconectado/ }).check();
  await page.getByRole('switch', { name: /Aceptar invitaciones/ }).uncheck();
  await page.waitForTimeout(1500);
  const [row] = await selectRows('profiles', `id=eq.${account.id}&select=appear_offline,allow_invites`);
  check(`la privacidad queda guardada en la cuenta (${JSON.stringify(row)})`, row?.appear_offline === true && row?.allow_invites === false);
  await page.screenshot({ path: `${OUT}/ajustes-settings.png`, fullPage: true });
  await page.getByLabel('Nueva contraseña').fill('Nueva456!');
  await page.getByLabel('Repetí la contraseña').fill('Nueva456!');
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
  check('cambia la contraseña', await visible(page.getByText('Contraseña cambiada.')));

  await page.getByLabel('Tu usuario').fill('otro');
  check('borrar exige escribir tu usuario', await page.getByRole('button', { name: /Borrar mi cuenta/ }).isDisabled());
  await page.getByLabel('Tu usuario').fill(USER.toLowerCase());
  await page.getByRole('button', { name: /Borrar mi cuenta/ }).click();
  check('al borrar la cuenta vuelve al inicio sin sesión', await page.waitForURL(WEB + '/', { timeout: 15000 }).then(() => true).catch(() => false) && await visible(page.getByRole('link', { name: 'Iniciar sesión' })));

  await browser.close();
}).then(done, (e) => { console.error(e); process.exit(1); });
