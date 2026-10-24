// Verifica en el servidor real los bugs de permisos y validación de la Fase 0.
const { WEB, SERVER, OUT, launch } = require('../common.cjs');
const { io } = require('socket.io-client');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok) => { results.push(ok); console.log(ok ? 'OK  ' : 'FAIL', name); };

function client() {
  const s = io(SERVER, { transports: ['websocket'], forceNew: true });
  const c = { s, room: null, id: null, view: null, chat: [], errors: [] };
  s.on('room:created', ({ room, playerId }) => { c.room = room; c.id = playerId; });
  s.on('room:joined', ({ room, playerId }) => { c.room = room; c.id = playerId; });
  s.on('room:updated', ({ room }) => { c.room = room; });
  s.on('room:error', (e) => c.errors.push(e.code));
  s.on('game:error', (e) => c.errors.push(e.code));
  s.on('game:state-update', (v) => { c.view = v; });
  s.on('chat:message', (m) => c.chat.push(m));
  return c;
}

(async () => {
  // Identidad inválida
  const bad = client();
  bad.s.emit('room:create', { nickname: 'x', avatarId: 'fox', locale: 'es' });
  bad.s.emit('room:create', { nickname: 'Valido', avatarId: 'no-existe' });
  bad.s.emit('room:create', null);
  await wait(300);
  check('rechaza apodo corto, avatar inexistente y payload null', bad.errors.filter((e) => e === 'INVALID_IDENTITY').length === 3);

  const admin = client();
  admin.s.emit('room:create', { nickname: 'Admin', avatarId: 'fox', locale: 'es' });
  await wait(300);
  const code = admin.room.code;
  const others = [client(), client(), client()];
  others.forEach((c, i) => c.s.emit('room:join', { code: code.toLowerCase(), nickname: `Bot${i}`, avatarId: 'cat' }));
  await wait(400);
  check('unirse con el código en minúsculas funciona', others.every((c) => c.room?.code === code));

  // Ajustes: sólo el admin, y validados
  others[0].s.emit('game:select', { gameId: 'impostor' });
  await wait(200);
  check('un no-admin no puede elegir juego', admin.room.selectedGameId === null);
  admin.s.emit('game:select', { gameId: 'no-existe' });
  await wait(200);
  check('no se puede elegir un juego inexistente', admin.room.selectedGameId === null);
  admin.s.emit('game:select', { gameId: 'impostor' });
  await wait(200);
  admin.s.emit('game:update-settings', { partidas: 999, impostorCount: 'dos', hack: 1, discussionTimeSeconds: 0, wordRevealTimeSeconds: 5 });
  await wait(200);
  const gs = admin.room.gameSettings;
  check('ajustes recortados y validados (partidas 999 → 10, string ignorado, clave extra ignorada)', gs.partidas === 10 && gs.impostorCount === 1 && !('hack' in gs));
  admin.s.emit('room:update-settings', { locale: 'en', maxPlayers: '8' });
  await wait(200);
  check('cambiar el idioma de la sala cambia las listas al idioma nuevo', admin.room.settings.locale === 'en' && gs !== admin.room.gameSettings && admin.room.gameSettings.selectedWordLists.every((id) => id.startsWith('en-')));
  check('maxPlayers de tipo incorrecto se ignora', admin.room.settings.maxPlayers === 0);
  admin.s.emit('game:update-settings', { partidas: 1, impostorCount: 2 });
  await wait(200);
  admin.s.emit('game:start');
  await wait(300);
  check('no arranca con 2 impostores y 4 jugadores', admin.errors.includes('too_many_impostors'));
  admin.s.emit('game:update-settings', { impostorCount: 1, communicationMode: 'voice' });
  await wait(200);
  admin.s.emit('game:start');
  await wait(500);
  check('arranca la partida', admin.room.state === 'playing' && admin.view?.phase === 'word-reveal');

  // Bug 2: un no-admin no puede terminar la partida
  others[0].s.emit('game:back-to-lobby');
  await wait(300);
  check('un no-admin no puede volver al lobby a todos', admin.room.state === 'playing');

  // Bug 3: en modo voz sólo el admin saltea al que habla
  await wait(5200);
  check('fase de turnos', admin.view.phase === 'turns');
  const nonAdminNotSpeaking = others.find((c) => !c.view.isMyTurn);
  nonAdminNotSpeaking.s.emit('game:action', { type: 'advance' });
  await wait(300);
  check('un no-admin no puede saltear al que habla', admin.view.currentTurnIndex === 0 && nonAdminNotSpeaking.errors.includes('not_admin'));
  admin.s.emit('game:action', { type: 'advance' });
  await wait(300);
  check('el admin sí puede saltear', admin.view.currentTurnIndex === 1);

  // Payloads basura no tiran el servidor
  others[1].s.emit('chat:send', { message: { evil: true } });
  others[1].s.emit('chat:send', null);
  others[1].s.emit('game:action', null);
  others[1].s.emit('room:kick', null);
  others[1].s.emit('room:transfer-admin', undefined);
  await wait(300);
  others[1].s.emit('chat:send', { message: 'sigo vivo' });
  await wait(300);
  check('payloads inválidos no rompen el servidor', admin.chat.some((m) => m.message === 'sigo vivo'));

  // El admin sí puede volver al lobby
  admin.s.emit('game:back-to-lobby');
  await wait(300);
  check('el admin vuelve al lobby', admin.room.state === 'lobby');

  [bad, admin, ...others].forEach((c) => c.s.close());
  console.log(`\n${results.filter(Boolean).length}/${results.length} checks OK`);
  process.exit(results.every(Boolean) ? 0 : 1);
})();
