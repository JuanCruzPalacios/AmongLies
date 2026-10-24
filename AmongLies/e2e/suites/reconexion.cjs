// Reconexión, pausa y "continuar sin él" contra el servidor real.
const { WEB, SERVER, OUT, launch } = require('../common.cjs');
const { io } = require('socket.io-client');
const { randomUUID } = require('crypto');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok) => { results.push(ok); console.log(ok ? 'OK  ' : 'FAIL', name); };

function client(token = randomUUID(), extraAuth = {}) {
  const s = io(SERVER, { transports: ['websocket'], forceNew: true, auth: { sessionToken: token, ...extraAuth } });
  const c = { s, token, room: null, id: null, view: null, ready: null, replaced: false, events: [] };
  s.on('session:ready', (d) => { c.ready = d; if (d.restored) { c.room = d.room; c.id = d.playerId; } });
  s.on('session:replaced', () => { c.replaced = true; });
  s.on('room:created', ({ room, playerId }) => { c.room = room; c.id = playerId; });
  s.on('room:joined', ({ room, playerId }) => { c.room = room; c.id = playerId; });
  s.on('room:updated', ({ room }) => { c.room = room; });
  s.on('room:player-left', (d) => c.events.push(['left', d.playerId, d.newAdminId]));
  s.on('player:disconnected', (d) => c.events.push(['disc', d.playerId]));
  s.on('player:reconnected', (d) => c.events.push(['reco', d.playerId]));
  s.on('game:state-update', (v) => { c.view = v; });
  return c;
}

(async () => {
  const admin = client();
  await wait(300);
  check('al conectar llega session:ready sin sala', admin.ready?.restored === false);
  admin.s.emit('room:create', { nickname: 'Admin', avatarId: 'fox', locale: 'es' });
  await wait(300);
  const code = admin.room.code;
  const p = [client(), client(), client(), client()];
  await wait(300);
  p.forEach((c, i) => c.s.emit('room:join', { code, nickname: `Bot${i}`, avatarId: 'cat' }));
  await wait(400);
  check('los invitados quedan marcados como invitados', admin.room.players.every((pl) => pl.isGuest));

  admin.s.emit('game:select', { gameId: 'impostor' });
  await wait(200);
  admin.s.emit('game:update-settings', { partidas: 1, impostorCount: 2, wordRevealTimeSeconds: 5 });
  await wait(200);
  admin.s.emit('game:start');
  await wait(500);
  check('arranca la partida con 5', admin.view?.phase === 'word-reveal' && !admin.view.paused);

  // 1) Se cae un jugador: la partida se pausa
  const lost = p[0];
  const lostId = lost.id;
  lost.s.disconnect();
  await wait(400);
  check('al desconectarse se avisa y la partida se pausa', admin.events.some(([e, id]) => e === 'disc' && id === lostId) && admin.view.paused === true);
  await wait(6000);
  check('en pausa los timers no avanzan (sigue en word-reveal tras 6 s)', admin.view.phase === 'word-reveal');

  // 2) Vuelve con el mismo token: recupera su lugar y se reanuda
  const back = client(lost.token);
  await wait(600);
  check('al volver con el mismo token se restaura la sesión', back.ready?.restored === true && back.id === lostId && back.room?.code === code);
  check('recibe el estado del juego y la partida se reanuda', back.view?.paused === false && admin.view.paused === false);
  check('los demás ven que volvió', admin.events.some(([e, id]) => e === 'reco' && id === lostId));

  // 3) Otra pestaña con el mismo token reemplaza a la anterior
  const dup = client(lost.token);
  await wait(600);
  check('una segunda conexión con el mismo token reemplaza a la primera', back.replaced === true && dup.ready?.restored === true && dup.id === lostId);
  check('el reemplazo no pausa la partida', admin.view.paused === false);

  // 4) El admin se cae: decide el conectado más antiguo
  const adminToken = admin.token;
  const adminId = admin.id;
  admin.s.disconnect();
  await wait(400);
  const oldest = dup; // p[0] fue el primero en unirse después del admin
  check('la partida se pausa al caerse el admin', oldest.view?.paused === true);
  p[1].s.emit('game:continue-without', { playerId: adminId });
  await wait(300);
  check('un jugador que no decide no puede seguir sin el admin', !oldest.events.some(([e, id]) => e === 'left' && id === adminId));
  oldest.s.emit('game:continue-without', { playerId: adminId });
  await wait(400);
  const leftEvent = oldest.events.find(([e, id]) => e === 'left' && id === adminId);
  check('el conectado más antiguo sí puede seguir sin él', !!leftEvent);
  check('la partida se reanuda y el rol de admin pasa al más antiguo', oldest.view.paused === false && leftEvent?.[2] === oldest.id);

  // 5) El admin vuelve tarde: ya no está en la sala
  const lateAdmin = client(adminToken);
  await wait(500);
  check('si ya se siguió sin él, al volver no se restaura', lateAdmin.ready?.restored === false);

  [dup, lateAdmin, ...p.slice(1)].forEach((c) => c.s.close());
  console.log(`\n${results.filter(Boolean).length}/${results.length} checks OK`);
  process.exit(results.every(Boolean) ? 0 : 1);
})();
