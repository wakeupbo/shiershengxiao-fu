'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const WebSocket = require('ws');
const { createOnlineServer } = require('./online-server');

function createMessageReader(socket) {
  const queue = [];
  const waiters = [];

  function resolveWaiters() {
    for (let waiterIndex = waiters.length - 1; waiterIndex >= 0; waiterIndex -= 1) {
      const waiter = waiters[waiterIndex];
      const messageIndex = queue.findIndex((message) => message.type === waiter.expectedType);
      if (messageIndex < 0) continue;
      const message = queue.splice(messageIndex, 1)[0];
      clearTimeout(waiter.timer);
      waiters.splice(waiterIndex, 1);
      waiter.resolve(message);
    }
  }

  socket.on('message', (data) => {
    queue.push(JSON.parse(data.toString('utf8')));
    resolveWaiters();
  });

  return {
    waitFor(expectedType) {
      return new Promise((resolve, reject) => {
        const messageIndex = queue.findIndex((message) => message.type === expectedType);
        if (messageIndex >= 0) {
          resolve(queue.splice(messageIndex, 1)[0]);
          return;
        }
        const waiter = {
          expectedType,
          resolve,
          timer: setTimeout(() => {
            const index = waiters.indexOf(waiter);
            if (index >= 0) waiters.splice(index, 1);
            reject(new Error(`等待 ${expectedType} 超时`));
          }, 2000)
        };
        waiters.push(waiter);
      });
    }
  };
}

function openClient(port) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const reader = createMessageReader(socket);
  return new Promise((resolve, reject) => {
    socket.once('open', () => resolve({ socket, reader }));
    socket.once('error', reject);
  });
}

function send(socket, message) {
  socket.send(JSON.stringify(message));
}

async function withServer(run) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wukong-online-test-'));
  const dataFile = path.join(tempDir, 'online-store.json');
  const server = createOnlineServer({ dataFile });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.server.address().port;
  try {
    await run({ port, dataFile });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function registerClient(port, username, password, displayName) {
  const client = await openClient(port);
  await client.reader.waitFor('hello');
  send(client.socket, { type: 'register', username, password, displayName });
  const registered = await client.reader.waitFor('auth_ok');
  assert.strictEqual(registered.user.username, username.toLowerCase());
  assert.strictEqual(registered.user.displayName, displayName);
  assert.ok(registered.token.length >= 32);
  return { ...client, token: registered.token, user: registered.user };
}

test('registers, logs in, restores profile from token, and persists account data', async () => {
  await withServer(async ({ port, dataFile }) => {
    const alice = await registerClient(port, 'Alice_01', 'secret-123', '悟空玩家');
    alice.socket.close();

    const loginClient = await openClient(port);
    await loginClient.reader.waitFor('hello');
    send(loginClient.socket, { type: 'login', username: 'alice_01', password: 'secret-123' });
    const loggedIn = await loginClient.reader.waitFor('auth_ok');
    assert.strictEqual(loggedIn.user.displayName, '悟空玩家');
    assert.deepStrictEqual(loggedIn.user.stats, { matches: 0, wins: 0, losses: 0, bestWave: 0 });
    loginClient.socket.close();

    const tokenClient = await openClient(port);
    await tokenClient.reader.waitFor('hello');
    send(tokenClient.socket, { type: 'auth', token: loggedIn.token });
    const restored = await tokenClient.reader.waitFor('auth_ok');
    assert.strictEqual(restored.user.username, 'alice_01');
    tokenClient.socket.close();

    const persisted = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    assert.strictEqual(Object.keys(persisted.users).length, 1);
    const savedUser = Object.values(persisted.users)[0];
    assert.notStrictEqual(savedUser.passwordHash, 'secret-123');
    assert.ok(savedUser.passwordSalt);
  });
});

test('requires accounts, shows a lobby, waits for both players to ready, then relays snapshots', async () => {
  await withServer(async ({ port }) => {
    const host = await registerClient(port, 'hoster', 'secret-123', '房主');
    const guest = await registerClient(port, 'guest01', 'secret-456', '客人');

    send(host.socket, { type: 'create' });
    const created = await host.reader.waitFor('room_created');
    assert.match(created.roomId, /^[A-Z0-9]{4,8}$/);
    assert.strictEqual(created.room.status, 'waiting');
    assert.strictEqual(created.room.players[0].displayName, '房主');
    assert.strictEqual(created.room.players[0].ready, false);

    send(guest.socket, { type: 'join', roomId: created.roomId });
    const joined = await guest.reader.waitFor('room_joined');
    const hostUpdate = await host.reader.waitFor('room_update');
    assert.strictEqual(joined.room.status, 'waiting');
    assert.strictEqual(hostUpdate.room.players.length, 2);
    assert.strictEqual(hostUpdate.room.players[1].displayName, '客人');

    send(host.socket, { type: 'ready', ready: true });
    const readyUpdate = await guest.reader.waitFor('room_update');
    assert.strictEqual(readyUpdate.room.players.find((player) => player.playerId === 'a').ready, true);

    send(guest.socket, { type: 'ready', ready: true });
    const hostStart = await host.reader.waitFor('match_start');
    const guestStart = await guest.reader.waitFor('match_start');
    assert.strictEqual(hostStart.mapIndex, guestStart.mapIndex);
    assert.strictEqual(hostStart.room.status, 'playing');

    const snapshot = { hearts: 2, wave: 3, units: { '1_8': { kind: 's', ch: '刀', lv: 2 } } };
    send(host.socket, { type: 'snapshot', payload: snapshot, sentAt: 123 });
    const relayed = await guest.reader.waitFor('snapshot');
    assert.strictEqual(relayed.from, 'a');
    assert.deepStrictEqual(relayed.payload, snapshot);

    host.socket.close();
    guest.socket.close();
  });
});

test('rejects unauthenticated create and rejects a third account when a room is full', async () => {
  await withServer(async ({ port }) => {
    const anonymous = await openClient(port);
    await anonymous.reader.waitFor('hello');
    send(anonymous.socket, { type: 'create' });
    const authError = await anonymous.reader.waitFor('error');
    assert.strictEqual(authError.message, '请先登录账号');
    anonymous.socket.close();

    const host = await registerClient(port, 'hoster', 'secret-123', '房主');
    const guest = await registerClient(port, 'guest01', 'secret-456', '客人');
    const extra = await registerClient(port, 'extra01', 'secret-789', '第三人');

    send(host.socket, { type: 'create' });
    const created = await host.reader.waitFor('room_created');
    send(guest.socket, { type: 'join', roomId: created.roomId });
    await guest.reader.waitFor('room_joined');
    send(extra.socket, { type: 'join', roomId: created.roomId });
    const fullError = await extra.reader.waitFor('error');
    assert.strictEqual(fullError.message, '房间已满');

    host.socket.close();
    guest.socket.close();
    extra.socket.close();
  });
});

test('records match results and updates both account profiles', async () => {
  await withServer(async ({ port, dataFile }) => {
    const host = await registerClient(port, 'hoster', 'secret-123', '房主');
    const guest = await registerClient(port, 'guest01', 'secret-456', '客人');
    send(host.socket, { type: 'create' });
    const created = await host.reader.waitFor('room_created');
    send(guest.socket, { type: 'join', roomId: created.roomId });
    await guest.reader.waitFor('room_joined');
    send(host.socket, { type: 'ready', ready: true });
    await guest.reader.waitFor('room_update');
    send(guest.socket, { type: 'ready', ready: true });
    await host.reader.waitFor('match_start');
    await guest.reader.waitFor('match_start');

    send(guest.socket, { type: 'game_over', payload: { hearts: 0, wave: 4, time: 90, reason: 'hearts' } });
    const hostRecorded = await host.reader.waitFor('match_recorded');
    const guestRecorded = await guest.reader.waitFor('match_recorded');
    assert.strictEqual(hostRecorded.match.winnerUserId, host.user.id);
    assert.strictEqual(guestRecorded.match.players.length, 2);

    send(host.socket, { type: 'profile' });
    const hostProfile = await host.reader.waitFor('profile');
    assert.strictEqual(hostProfile.user.stats.matches, 1);
    assert.strictEqual(hostProfile.user.stats.wins, 1);
    assert.strictEqual(hostProfile.user.stats.bestWave, 4);
    assert.strictEqual(hostProfile.user.recentMatches.length, 1);

    const persisted = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    assert.strictEqual(persisted.matches.length, 1);
    assert.strictEqual(persisted.matches[0].winnerUserId, host.user.id);

    host.socket.close();
    guest.socket.close();
  });
});
test('records an in-game leave as a surrender loss', async () => {
  await withServer(async ({ port }) => {
    const host = await registerClient(port, 'hoster', 'secret-123', '房主');
    const guest = await registerClient(port, 'guest01', 'secret-456', '客人');
    send(host.socket, { type: 'create' });
    const created = await host.reader.waitFor('room_created');
    send(guest.socket, { type: 'join', roomId: created.roomId });
    await guest.reader.waitFor('room_joined');
    send(host.socket, { type: 'ready', ready: true });
    await guest.reader.waitFor('room_update');
    send(guest.socket, { type: 'ready', ready: true });
    await host.reader.waitFor('match_start');
    await guest.reader.waitFor('match_start');

    send(guest.socket, { type: 'leave', reason: 'user_leave' });
    const recorded = await host.reader.waitFor('match_recorded');
    const guestResult = recorded.match.players.find((player) => player.userId === guest.user.id).result;

    assert.strictEqual(recorded.match.winnerUserId, host.user.id);
    assert.strictEqual(guestResult.hearts, 0);
    assert.strictEqual(guestResult.reason, 'surrender');

    host.socket.close();
    guest.socket.close();
  });
});
