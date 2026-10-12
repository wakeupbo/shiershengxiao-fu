const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..');

function loadScript(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  delete require.cache[require.resolve(fullPath)];
  require(fullPath);
}

class FakeWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    FakeWebSocket.instances.push(this);
  }

  send(payload) {
    this.sent.push(JSON.parse(payload));
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    if (this.onopen) this.onopen();
  }

  receive(message) {
    if (this.onmessage) this.onmessage({ data: JSON.stringify(message) });
  }

  closeFromServer() {
    this.readyState = FakeWebSocket.CLOSED;
    if (this.onclose) this.onclose();
  }

  close() {
    this.closeFromServer();
  }
}

function createHarness() {
  FakeWebSocket.instances = [];
  globalThis.WebSocket = FakeWebSocket;
  globalThis.location = { protocol: 'http:', host: 'example.test', search: '', href: 'http://example.test/' };
  globalThis.ZY = {
    adapter: {
      storageGet() { return null; },
      storageSet() {}
    },
    UI: { toast() {} }
  };
  loadScript('js/online.js');
  return { ZY: globalThis.ZY, FakeWebSocket };
}

test('waiting room state is cleared when the websocket closes before a match starts', () => {
  const { ZY } = createHarness();
  const online = ZY.Online;
  const state = online.state();
  state.user = { id: 'u1', username: 'alice', displayName: 'Alice' };
  state.token = 'token-12345678901234567890123456789012';

  online.createRoom();
  const socket = FakeWebSocket.instances[0];
  socket.open();
  assert.equal(socket.sent[0].type, 'auth');
  socket.receive({ type: 'auth_ok', token: state.token, user: state.user });
  assert.equal(socket.sent[1].type, 'create');
  socket.receive({
    type: 'room_created',
    roomId: 'ABCD12',
    playerId: 'a',
    mapIndex: 0,
    room: {
      id: 'ABCD12',
      status: 'waiting',
      mapIndex: 0,
      players: [{ playerId: 'a', userId: 'u1', displayName: 'Alice', ready: false, connected: true }]
    }
  });
  assert.equal(state.roomId, 'ABCD12');

  socket.closeFromServer();

  assert.equal(state.active, false);
  assert.equal(state.roomId, null);
  assert.equal(state.room, null);
  assert.equal(state.lobbyOpen, true);
  assert.match(state.status, /重新创建房间/);
});