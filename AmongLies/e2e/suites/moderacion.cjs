// Moderación de punta a punta: admin (A), cuenta que insulta (V) e invitado.
// También prueba que un usuario común no pueda darse permisos con su token.
const { WEB, OUT, SUPABASE_URL, PUBLISHABLE_KEY, PASSWORD, launch, newPage, login, withAccounts, suite, visible } = require('../common.cjs');

const { log, check, done } = suite('moderacion');
const USER_V = 'E2eMalo';

/** Pedido a la API de Supabase como el usuario (con su propio token, igual que el navegador). */
async function asUser(email, pathname, init = {}) {
  const auth = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  }).then((r) => r.json());
  return fetch(`${SUPABASE_URL}${pathname}`, {
    ...init,
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${auth.access_token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
  });
}

withAccounts([{ username: 'E2eAdmin', admin: true }, { username: USER_V }], async ([A, V]) => {
  // ── Permisos en la base: sólo puede tocar su avatar, idioma y privacidad ──
  const selfAdmin = await asUser(V.email, `/rest/v1/profiles?id=eq.${V.id}`, { method: 'PATCH', body: JSON.stringify({ is_admin: true }) });
  check(`no puede hacerse admin (HTTP ${selfAdmin.status})`, selfAdmin.status === 401 || selfAdmin.status === 403);
  const unsuspend = await asUser(V.email, `/rest/v1/profiles?id=eq.${V.id}`, { method: 'PATCH', body: JSON.stringify({ suspended_until: null }) });
  check(`no puede tocar su suspensión (HTTP ${unsuspend.status})`, unsuspend.status === 401 || unsuspend.status === 403);
  const reports = await asUser(V.email, '/rest/v1/reports?select=id');
  const visibleReports = reports.ok ? await reports.json() : [];
  check(`no puede leer los reportes (HTTP ${reports.status}, ${visibleReports.length} filas)`, !reports.ok || visibleReports.length === 0);
  const avatar = await asUser(V.email, `/rest/v1/profiles?id=eq.${V.id}`, { method: 'PATCH', body: JSON.stringify({ avatar_id: 'cat' }) });
  check(`sí puede cambiar su avatar (HTTP ${avatar.status})`, avatar.ok);

  const browser = await launch();
  // Invitado con apodo insultante.
  const guest = await newPage(browser);
  await guest.goto(WEB);
  await guest.getByPlaceholder(/Ingres[aá] tu apodo/).fill('Pelotud0');
  await guest.getByRole('button', { name: /Crear Sala/i }).click();
  check('un apodo con insultos no se acepta', await visible(guest.getByText('Ese apodo no está permitido.')));

  const a = await login(browser, A);
  const v = await login(browser, V);
  check('el admin ve "Admin" en el header', await visible(a.getByRole('link', { name: 'Admin', exact: true })));
  check('el otro no', !(await v.getByRole('link', { name: 'Admin', exact: true }).isVisible()));

  // V crea sala, A entra, V insulta.
  await v.getByRole('button', { name: /Crear Sala/i }).click();
  await v.waitForURL(/\/room\/[A-Z0-9]{6}/);
  const url = v.url();
  await a.goto(url);
  await a.getByRole('button', { name: /^Unirse$/ }).click();
  await v.getByText('E2eAdmin', { exact: false }).first().waitFor();
  await v.getByPlaceholder(/Escrib[eí] un mensaje/).first().fill('sos un IDIOTA, mierda');
  await v.keyboard.press('Enter');
  check('el chat llega censurado', await visible(a.getByText('sos un ******, ******')));

  // A reporta a V desde la lista de jugadores.
  await a.getByRole('button', { name: `Reportar a ${USER_V}` }).click();
  await a.getByLabel('Insultos o acoso').check();
  await a.getByLabel(/Contanos qué pasó/).fill('Me insultó en el chat');
  await a.getByRole('button', { name: 'Enviar reporte' }).click();
  check('el reporte se envía', await visible(a.getByText('Gracias: un admin lo va a revisar.')));
  await a.screenshot({ path: `${OUT}/moderacion-1-report.png` });
  await a.getByRole('button', { name: 'Cerrar' }).click();

  // Panel de admin: el reporte con la evidencia; suspender 1 día.
  await a.goto(`${WEB}/admin`);
  const card = a.getByRole('listitem').filter({ hasText: 'Me insultó en el chat' });
  check('el panel muestra el reporte', await visible(card));
  await card.getByText(/Chat de la sala/).click();
  check('con la evidencia del chat', await visible(card.getByText('sos un ******, ******')));
  await a.screenshot({ path: `${OUT}/moderacion-2-admin.png`, fullPage: true });
  a.once('dialog', (d) => d.accept('Insultos en el chat'));
  await card.getByRole('button', { name: '1 d' }).click();
  check('suspensión aplicada', await visible(a.getByText('Cuenta suspendida.')));
  check('a V lo sacan de la sala con el aviso', await visible(v.getByText(/Tu cuenta está suspendida hasta/), 10000));
  await v.screenshot({ path: `${OUT}/moderacion-3-suspended.png` });
  await v.getByRole('button', { name: /Crear Sala/i }).click();
  check('suspendido no puede crear salas', await visible(v.getByText('Tu cuenta está suspendida: no podés entrar a salas.')));
  await v.goto(`${WEB}/admin`);
  check('V no tiene acceso al panel', await visible(v.getByText('No tenés acceso a esta página.')));

  // A resuelve el reporte y después levanta la suspensión.
  a.once('dialog', (d) => d.accept('Suspendido 1 día'));
  await card.getByRole('button', { name: 'Resolver' }).click();
  check('reporte resuelto', await visible(a.getByText('Reporte resuelto.')));
  await a.getByRole('tab', { name: 'Usuarios' }).click();
  await a.getByLabel('Buscar @usuario').fill(USER_V);
  const row = a.getByRole('listitem').filter({ hasText: '@' + USER_V });
  await row.getByRole('button', { name: 'Levantar suspensión' }).click();
  check('suspensión levantada', await visible(a.getByText('Suspensión levantada.')));
  await v.goto(WEB);
  await v.waitForTimeout(1500);
  await v.reload(); // reconecta: el servidor vuelve a leer la cuenta
  await v.getByRole('button', { name: /Crear Sala/i }).click();
  check('ya puede crear salas', await v.waitForURL(/\/room\/[A-Z0-9]{6}/, { timeout: 10000 }).then(() => true).catch(() => false));

  // Workshop con insultos.
  await v.goto(`${WEB}/workshop/editar/nueva`);
  await v.getByLabel('Nombre').fill('Lista de mierda');
  await v.getByLabel(/Palabras/).fill(Array.from({ length: 10 }, (_, i) => 'p' + i).join('\n'));
  await v.getByRole('button', { name: 'Guardar' }).click();
  check('el workshop rechaza títulos con insultos', await visible(v.getByText('Tiene palabras no permitidas (insultos).')));

  await browser.close();
}).then(done, (e) => { console.error(e); process.exit(1); });
