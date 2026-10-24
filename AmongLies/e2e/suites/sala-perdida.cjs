// Servidor dormido o reiniciado (plan gratis de Render): aviso de sala perdida
// y espera mientras despierta. Necesita poder apagar y prender el servidor:
//   E2E_SERVER_STOP / E2E_SERVER_START = comandos de shell para hacerlo.
const { execSync } = require('node:child_process');
const { WEB, REMOTE, launch, newPage, suite, visible, sleep } = require('../common.cjs');

const STOP = process.env.E2E_SERVER_STOP;
const START = process.env.E2E_SERVER_START;
if (!STOP || !START || REMOTE) {
  console.log('SKIP: hace falta E2E_SERVER_STOP y E2E_SERVER_START (y un servidor local).');
  process.exit(0);
}
const { check, out, done } = suite('sala-perdida');
const stopServer = () => execSync(STOP, { stdio: 'inherit' });
const startServer = () => execSync(START, { stdio: 'inherit' });

(async () => {
  const browser = await launch();
  const page = await newPage(browser);
  const health = [];
  page.on('request', (r) => { if (r.url().endsWith('/health')) health.push(r.url()); });

  // 1) Sala abierta + el servidor se reinicia → aviso claro, no sala fantasma.
  await page.goto(WEB);
  await page.getByPlaceholder(/Ingres[aá] tu apodo/).fill('Juan');
  await page.getByRole('button', { name: /Crear Sala/i }).click();
  await page.waitForURL(/\/room\/[A-Z0-9]{6}/);
  await sleep(1000);
  check('estando en una sala se avisa al servidor (/health)', health.length >= 1);
  stopServer();
  await sleep(1500);
  startServer();
  check('al volver el servidor, avisa que la sala ya no existe', await visible(page.getByText('La sala ya no existe'), 30000));
  check('y vuelve al inicio', new URL(page.url()).pathname === '/');
  await page.screenshot({ path: out('aviso.png') });
  await page.getByRole('button', { name: /Crear Sala/i }).click();
  check('se puede crear otra sala enseguida, sin recargar', await page.waitForURL(/\/room\/[A-Z0-9]{6}/, { timeout: 15000 }).then(() => true).catch(() => false));
  await page.goto(WEB);

  // 2) Servidor "dormido" al crear: muestra que se está despertando y después crea la sala.
  await sleep(2000);
  stopServer();
  await page.reload();
  await page.getByPlaceholder(/Ingres[aá] tu apodo/).fill('Juan');
  await page.getByRole('button', { name: /Crear Sala/i }).click();
  check('muestra "Despertando el servidor…"', await visible(page.getByText(/Despertando el servidor/)));
  await sleep(8000); // más que el viejo límite de 10 s
  startServer();
  check('cuando despierta, crea la sala igual', await page.waitForURL(/\/room\/[A-Z0-9]{6}/, { timeout: 40000 }).then(() => true).catch(() => false));

  await browser.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
