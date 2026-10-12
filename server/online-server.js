'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { WebSocket, WebSocketServer } = require('ws');

const DEFAULT_PORT = 8787;
const DEFAULT_HOST = '0.0.0.0';
const MAX_MESSAGE_BYTES = 16 * 1024;
const ROOM_TTL_MS = 30 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;
const MAX_REPORTED_WAVE = 9999;
const ROOM_ID_PATTERN = /^[A-Z0-9]{4,8}$/;
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const PUBLIC_ROOT = path.resolve(__dirname, '..');
const DEFAULT_DATA_FILE = path.join(PUBLIC_ROOT, 'data', 'online-store.json');
const PASSWORD_ITERATIONS = 120000;
const PASSWORD_KEY_LENGTH = 32;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wav': 'audio/wav',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon'
};

const FORBIDDEN_STATIC_DIRS = new Set([
  '.git',
  '.github',
  '.uploads',
  'data',
  'node_modules',
  'server',
  'sim',
  'tools',
  'tmp'
]);

function now() {
  return Date.now();
}

function sendJson(socket, payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function parseMessage(data) {
  const text = data.toString('utf8');
  if (Buffer.byteLength(text, 'utf8') > MAX_MESSAGE_BYTES) throw new Error('消息过大');
  const message = JSON.parse(text);
  if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
    throw new Error('消息格式无效');
  }
  return message;
}

function normalizeUsername(value) {
  if (typeof value !== 'string') return null;
  const username = value.trim().toLowerCase();
  return USERNAME_PATTERN.test(username) ? username : null;
}

function normalizePassword(value) {
  if (typeof value !== 'string') return null;
  if (value.length < 6 || value.length > 72) return null;
  return value;
}

function sanitizeDisplayName(value, fallback) {
  if (typeof value !== 'string') return fallback || '玩家';
  const cleaned = value.trim().replace(/[<>{}()[\]"'`\\/]/g, '').replace(/\s+/g, ' ');
  return cleaned.slice(0, 16) || fallback || '玩家';
}

function normalizeRoomId(value) {
  if (typeof value !== 'string') return null;
  const roomId = value.trim().toUpperCase();
  return ROOM_ID_PATTERN.test(roomId) ? roomId : null;
}

function defaultStats() {
  return { matches: 0, wins: 0, losses: 0, bestWave: 0 };
}

function emptyData() {
  return { version: 1, users: {}, usernameIndex: {}, sessions: {}, matches: [] };
}

function secretHash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function passwordHash(password, salt) {
  return crypto.pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, 'sha256').toString('hex');
}

function verifyPassword(password, salt, expectedHash) {
  const actual = Buffer.from(passwordHash(password, salt), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function createId(prefix) {
  return prefix + '_' + crypto.randomBytes(12).toString('hex');
}

function generateRoomId(rooms) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const roomId = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
    if (!rooms.has(roomId)) return roomId;
  }
  throw new Error('无法创建房间码');
}

function randomMapIndex() {
  return crypto.randomInt(0, 5);
}

function clampInt(value, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}

function sanitizeSnapshot(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const out = {};
  if (Object.prototype.hasOwnProperty.call(source, 'hearts')) out.hearts = clampInt(source.hearts, 0, 99);
  if (Object.prototype.hasOwnProperty.call(source, 'mantou')) out.mantou = clampInt(source.mantou, 0, 9999);
  if (Object.prototype.hasOwnProperty.call(source, 'wave')) out.wave = clampInt(source.wave, 0, MAX_REPORTED_WAVE);
  if (typeof source.waveState === 'string') out.waveState = source.waveState.slice(0, 16);
  if (Number.isFinite(source.restTimer)) out.restTimer = Math.max(0, source.restTimer);
  if (source.units && typeof source.units === 'object') out.units = source.units;
  if (Array.isArray(source.bench)) out.bench = source.bench.slice(0, 8);
  if (Number.isFinite(source.time)) out.time = Math.max(0, source.time);
  return out;
}

function sanitizeFinish(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  return {
    hearts: clampInt(source.hearts, 0, 99),
    wave: clampInt(source.wave, 0, MAX_REPORTED_WAVE),
    time: Number.isFinite(source.time) ? Math.max(0, source.time) : 0,
    reason: typeof source.reason === 'string' ? source.reason.slice(0, 32) : 'unknown'
  };
}

function replaceDataFile(tempFile, targetFile) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      fs.renameSync(tempFile, targetFile);
      return;
    } catch (error) {
      if (!['EEXIST', 'EPERM', 'EACCES'].includes(error.code) || attempt === 2) throw error;
      try { fs.rmSync(targetFile, { force: true }); } catch (removeError) {}
    }
  }
}
function safeResolveStaticPath(urlPath) {
  let rawPath;
  try {
    rawPath = decodeURIComponent(urlPath.split('?')[0]);
  } catch (error) {
    return null;
  }
  const cleanPath = rawPath === '/' ? '/index.html' : rawPath;
  const parts = cleanPath.split('/').filter(Boolean);
  if (parts.some((part) => part === '..' || FORBIDDEN_STATIC_DIRS.has(part))) return null;
  const filePath = path.resolve(PUBLIC_ROOT, ...parts);
  if (filePath === PUBLIC_ROOT || filePath.startsWith(PUBLIC_ROOT + path.sep)) return filePath;
  return null;
}

class OnlineDataStore {
  constructor(dataFile) {
    this.dataFile = dataFile || DEFAULT_DATA_FILE;
    this.data = emptyData();
    this.load();
  }

  load() {
    if (!fs.existsSync(this.dataFile)) {
      this.data = emptyData();
      return;
    }
    const parsed = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
    this.data = this.normalizeData(parsed);
  }

  normalizeData(value) {
    const data = value && typeof value === 'object' ? value : {};
    return {
      version: 1,
      users: data.users && typeof data.users === 'object' ? data.users : {},
      usernameIndex: data.usernameIndex && typeof data.usernameIndex === 'object' ? data.usernameIndex : {},
      sessions: data.sessions && typeof data.sessions === 'object' ? data.sessions : {},
      matches: Array.isArray(data.matches) ? data.matches : []
    };
  }

  save() {
    fs.mkdirSync(path.dirname(this.dataFile), { recursive: true });
    fs.writeFileSync(this.dataFile, JSON.stringify(this.data, null, 2) + '\n', 'utf8');
  }
  register(input) {
    const username = normalizeUsername(input.username);
    const password = normalizePassword(input.password);
    if (!username) throw new Error('账号需为 3-20 位小写字母、数字或下划线');
    if (!password) throw new Error('密码需为 6-72 位');
    if (this.data.usernameIndex[username]) throw new Error('账号已存在');
    const user = this.createUser(username, password, input.displayName);
    this.data.users[user.id] = user;
    this.data.usernameIndex[username] = user.id;
    const token = this.createSession(user.id);
    this.save();
    return { token, user: this.publicUser(user.id) };
  }

  createUser(username, password, displayName) {
    const salt = crypto.randomBytes(16).toString('hex');
    const timestamp = now();
    return {
      id: createId('user'),
      username,
      displayName: sanitizeDisplayName(displayName, username),
      passwordHash: passwordHash(password, salt),
      passwordSalt: salt,
      createdAt: timestamp,
      updatedAt: timestamp,
      stats: defaultStats(),
      recentMatches: []
    };
  }

  login(input) {
    const username = normalizeUsername(input.username);
    const password = normalizePassword(input.password);
    const userId = username ? this.data.usernameIndex[username] : null;
    const user = userId ? this.data.users[userId] : null;
    if (!user || !password || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      throw new Error('账号或密码错误');
    }
    const token = this.createSession(user.id);
    this.save();
    return { token, user: this.publicUser(user.id) };
  }

  authenticate(token) {
    if (typeof token !== 'string' || token.length < 32) throw new Error('登录已失效');
    const session = this.data.sessions[secretHash(token)];
    if (!session || !this.data.users[session.userId]) throw new Error('登录已失效');
    session.lastSeenAt = now();
    this.save();
    return { token, user: this.publicUser(session.userId) };
  }

  createSession(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    this.data.sessions[secretHash(token)] = { userId, createdAt: now(), lastSeenAt: now() };
    return token;
  }

  updateProfile(userId, input) {
    const user = this.data.users[userId];
    if (!user) throw new Error('账号不存在');
    user.displayName = sanitizeDisplayName(input.displayName, user.displayName);
    user.updatedAt = now();
    this.save();
    return this.publicUser(userId);
  }

  publicUser(userId) {
    const user = this.data.users[userId];
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      stats: { ...defaultStats(), ...(user.stats || {}) },
      recentMatches: Array.isArray(user.recentMatches) ? user.recentMatches.slice(0, 10) : [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  recordMatch(input) {
    const timestamp = now();
    const maxWave = Math.max(...input.players.map((player) => player.result.wave), 0);
    const match = {
      id: createId('match'),
      roomId: input.roomId,
      winnerUserId: input.winnerUserId,
      createdAt: timestamp,
      durationMs: input.durationMs,
      players: input.players.map((player) => ({ ...player }))
    };
    this.data.matches.push(match);
    for (const player of match.players) this.applyMatchToUser(player, match, maxWave);
    this.save();
    return match;
  }

  applyMatchToUser(player, match, maxWave) {
    const user = this.data.users[player.userId];
    if (!user) return;
    user.stats = { ...defaultStats(), ...(user.stats || {}) };
    user.stats.matches += 1;
    if (match.winnerUserId === user.id) user.stats.wins += 1;
    else user.stats.losses += 1;
    user.stats.bestWave = Math.max(user.stats.bestWave || 0, maxWave);
    user.recentMatches = this.createRecentMatches(user, player, match, maxWave);
    user.updatedAt = now();
  }

  createRecentMatches(user, player, match, maxWave) {
    const entry = {
      id: match.id,
      roomId: match.roomId,
      result: match.winnerUserId === user.id ? 'win' : 'loss',
      wave: player.result.wave,
      bestWave: maxWave,
      hearts: player.result.hearts,
      createdAt: match.createdAt
    };
    const previous = Array.isArray(user.recentMatches) ? user.recentMatches : [];
    return [entry].concat(previous).slice(0, 10);
  }
}

class OnlineRoomServer {
  constructor(options = {}) {
    this.rooms = new Map();
    this.store = options.store || new OnlineDataStore(options.dataFile || process.env.ONLINE_DATA_FILE || DEFAULT_DATA_FILE);
    this.server = options.server || http.createServer((req, res) => this.serveStatic(req, res));
    this.wss = new WebSocketServer({
      server: this.server,
      path: options.wsPath || '/ws',
      maxPayload: MAX_MESSAGE_BYTES
    });
    this.cleanupTimer = null;
    this.wss.on('connection', (socket) => this.handleConnection(socket));
  }

  listen(port = DEFAULT_PORT, host = DEFAULT_HOST, callback) {
    this.cleanupTimer = setInterval(() => this.cleanupRooms(), CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
    this.server.listen(port, host, callback);
  }

  close(callback) {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    for (const room of this.rooms.values()) this.terminateRoom(room);
    this.rooms.clear();
    this.wss.close(() => this.server.close(callback));
  }

  terminateRoom(room) {
    for (const player of Object.values(room.players)) {
      if (player && player.socket && player.socket.readyState === WebSocket.OPEN) player.socket.terminate();
    }
  }

  serveStatic(req, res) {
    if (!['GET', 'HEAD'].includes(req.method)) return this.textResponse(res, 405, 'Method not allowed');
    if (!req.url || req.url.startsWith('/ws')) return this.textResponse(res, 404, 'Not found');
    const filePath = safeResolveStaticPath(req.url);
    if (!filePath) return this.textResponse(res, 403, 'Forbidden');
    this.sendStaticFile(req, res, filePath);
  }

  textResponse(res, statusCode, text) {
    res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(text);
  }

  sendStaticFile(req, res, filePath) {
    fs.stat(filePath, (error, stats) => {
      if (error || !stats.isFile()) return this.textResponse(res, 404, 'Not found');
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300'
      });
      if (req.method === 'HEAD') res.end();
      else fs.createReadStream(filePath).pipe(res);
    });
  }
  handleConnection(socket) {
    socket.user = null;
    socket.roomId = null;
    socket.playerId = null;
    socket.on('message', (data) => this.handleRawMessage(socket, data));
    socket.on('close', () => this.handleDisconnect(socket));
    sendJson(socket, { type: 'hello', serverTime: now() });
  }

  handleRawMessage(socket, data) {
    try {
      this.handleMessage(socket, parseMessage(data));
    } catch (error) {
      sendJson(socket, { type: 'error', message: error.message || '消息处理失败' });
    }
  }

  handleMessage(socket, message) {
    if (message.type === 'ping') return sendJson(socket, { type: 'pong', serverTime: now() });
    if (message.type === 'register') return this.register(socket, message);
    if (message.type === 'login') return this.login(socket, message);
    if (message.type === 'auth') return this.auth(socket, message);
    if (message.type === 'profile') return this.profile(socket);
    if (message.type === 'update_profile') return this.updateProfile(socket, message);
    if (!this.requireAuth(socket)) return;
    if (message.type === 'create') return this.createRoom(socket);
    if (message.type === 'join') return this.joinRoom(socket, message);
    if (message.type === 'ready') return this.setReady(socket, message);
    if (message.type === 'snapshot') return this.handleSnapshot(socket, message);
    if (message.type === 'game_over') return this.handleGameOver(socket, message);
    if (message.type === 'leave') return this.leaveRoom(socket, 'user_leave');
    sendJson(socket, { type: 'error', message: '不支持的消息类型' });
  }

  register(socket, message) {
    const result = this.store.register(message);
    socket.user = result.user;
    sendJson(socket, { type: 'auth_ok', token: result.token, user: result.user });
  }

  login(socket, message) {
    const result = this.store.login(message);
    socket.user = result.user;
    sendJson(socket, { type: 'auth_ok', token: result.token, user: result.user });
  }

  auth(socket, message) {
    const result = this.store.authenticate(message.token);
    socket.user = result.user;
    sendJson(socket, { type: 'auth_ok', token: result.token, user: result.user });
  }

  profile(socket) {
    if (!this.requireAuth(socket)) return;
    sendJson(socket, { type: 'profile', user: this.store.publicUser(socket.user.id) });
  }

  updateProfile(socket, message) {
    if (!this.requireAuth(socket)) return;
    socket.user = this.store.updateProfile(socket.user.id, message);
    this.syncUserInRoom(socket);
    sendJson(socket, { type: 'profile', user: socket.user });
  }

  requireAuth(socket) {
    if (socket.user) return true;
    sendJson(socket, { type: 'error', message: '请先登录账号' });
    return false;
  }

  createRoom(socket) {
    if (socket.roomId) return sendJson(socket, { type: 'error', message: '已经在房间中' });
    const roomId = generateRoomId(this.rooms);
    const room = this.createRoomState(roomId, socket);
    this.rooms.set(roomId, room);
    sendJson(socket, {
      type: 'room_created',
      roomId,
      playerId: 'a',
      mapIndex: room.mapIndex,
      room: this.publicRoom(room)
    });
  }

  createRoomState(roomId, socket) {
    socket.roomId = roomId;
    socket.playerId = 'a';
    return {
      id: roomId,
      createdAt: now(),
      updatedAt: now(),
      startedAt: null,
      status: 'waiting',
      mapIndex: randomMapIndex(),
      matchRecorded: false,
      players: { a: this.createPlayer(socket, 'a'), b: null }
    };
  }

  createPlayer(socket, playerId) {
    return {
      playerId,
      userId: socket.user.id,
      username: socket.user.username,
      displayName: socket.user.displayName,
      stats: socket.user.stats,
      ready: false,
      connected: true,
      socket,
      lastSnapshot: null,
      result: null
    };
  }

  joinRoom(socket, message) {
    if (socket.roomId) return sendJson(socket, { type: 'error', message: '已经在房间中' });
    const roomId = normalizeRoomId(message.roomId);
    if (!roomId || !this.rooms.has(roomId)) return sendJson(socket, { type: 'error', message: '房间不存在' });
    const room = this.rooms.get(roomId);
    if (room.players.b) return sendJson(socket, { type: 'error', message: '房间已满' });
    if (room.status !== 'waiting') return sendJson(socket, { type: 'error', message: '对局已开始' });
    room.players.b = this.attachPlayerToRoom(socket, room, 'b');
    sendJson(socket, {
      type: 'room_joined',
      roomId: room.id,
      playerId: 'b',
      mapIndex: room.mapIndex,
      room: this.publicRoom(room)
    });
    sendJson(room.players.a.socket, { type: 'room_update', roomId: room.id, room: this.publicRoom(room) });
  }

  attachPlayerToRoom(socket, room, playerId) {
    socket.roomId = room.id;
    socket.playerId = playerId;
    room.updatedAt = now();
    return this.createPlayer(socket, playerId);
  }

  setReady(socket, message) {
    const room = this.getSocketRoom(socket);
    if (!room || room.status !== 'waiting') return;
    const player = room.players[socket.playerId];
    if (!player) return;
    player.ready = message.ready !== false;
    room.updatedAt = now();
    this.broadcastRoomUpdate(room, 'room_update');
    if (this.isRoomReady(room)) this.startMatch(room);
  }

  isRoomReady(room) {
    return room.players.a && room.players.b && room.players.a.ready && room.players.b.ready;
  }

  startMatch(room) {
    if (room.status !== 'waiting') return;
    room.status = 'playing';
    room.startedAt = now();
    room.updatedAt = now();
    const startsAt = now() + 800;
    for (const player of Object.values(room.players)) this.sendMatchStart(room, player, startsAt);
  }

  sendMatchStart(room, player, startsAt) {
    if (!player) return;
    sendJson(player.socket, {
      type: 'match_start',
      roomId: room.id,
      playerId: player.playerId,
      mapIndex: room.mapIndex,
      startsAt,
      room: this.publicRoom(room)
    });
  }
  handleSnapshot(socket, message) {
    const room = this.getSocketRoom(socket);
    if (!room || room.status !== 'playing') return;
    const player = room.players[socket.playerId];
    if (!player) return;
    const snapshot = sanitizeSnapshot(message.payload);
    player.lastSnapshot = snapshot;
    room.updatedAt = now();
    this.sendToPeer(socket, { type: 'snapshot', payload: snapshot, sentAt: message.sentAt });
  }

  handleGameOver(socket, message) {
    const room = this.getSocketRoom(socket);
    if (!room || room.status !== 'playing') return;
    const player = room.players[socket.playerId];
    if (!player || player.result) return;
    player.result = sanitizeFinish(message.payload);
    room.updatedAt = now();
    this.sendToPeer(socket, { type: 'game_over', payload: player.result, sentAt: message.sentAt });
    this.tryFinalizeMatch(room);
  }

  tryFinalizeMatch(room) {
    if (room.matchRecorded) return;
    const winnerPlayerId = this.resolveWinnerPlayerId(room);
    if (!winnerPlayerId) return;
    room.matchRecorded = true;
    room.status = 'finished';
    const match = this.store.recordMatch(this.createMatchInput(room, winnerPlayerId));
    this.broadcastMatchRecorded(room, match);
  }

  resolveWinnerPlayerId(room) {
    const playerA = room.players.a;
    const playerB = room.players.b;
    if (!playerA || !playerB) return null;
    if (playerA.result && playerA.result.hearts <= 0) return 'b';
    if (playerB.result && playerB.result.hearts <= 0) return 'a';
    if (!playerA.result || !playerB.result) return null;
    return this.scoreResult(playerA.result) >= this.scoreResult(playerB.result) ? 'a' : 'b';
  }

  scoreResult(result) {
    return result.hearts * 1000 + result.wave * 10 - result.time / 1000;
  }

  createMatchInput(room, winnerPlayerId) {
    const winner = room.players[winnerPlayerId];
    return {
      roomId: room.id,
      winnerUserId: winner.userId,
      durationMs: room.startedAt ? now() - room.startedAt : 0,
      players: ['a', 'b'].map((playerId) => this.createMatchPlayer(room.players[playerId]))
    };
  }

  createMatchPlayer(player) {
    const fallback = player.lastSnapshot || {};
    return {
      userId: player.userId,
      username: player.username,
      displayName: player.displayName,
      playerId: player.playerId,
      result: player.result || {
        hearts: Number.isFinite(fallback.hearts) ? fallback.hearts : 1,
        wave: Number.isFinite(fallback.wave) ? fallback.wave : 0,
        time: Number.isFinite(fallback.time) ? fallback.time : 0,
        reason: 'opponent_finished'
      }
    };
  }

  broadcastMatchRecorded(room, match) {
    for (const player of Object.values(room.players)) {
      if (!player) continue;
      const user = this.store.publicUser(player.userId);
      if (player.socket) player.socket.user = user;
      sendJson(player.socket, { type: 'match_recorded', match, user });
    }
  }

  leaveRoom(socket, reason) {
    const room = this.getSocketRoom(socket);
    if (!room) return;
    this.detachSocketFromRoom(socket, room, reason);
  }

  handleDisconnect(socket) {
    const room = this.getSocketRoom(socket);
    if (!room) return;
    this.detachSocketFromRoom(socket, room, 'disconnect');
  }

  detachSocketFromRoom(socket, room, reason) {
    const player = room.players[socket.playerId];
    if (!player || player.socket !== socket) return;
    player.connected = false;
    socket.roomId = null;
    socket.playerId = null;
    if (room.status === 'playing' && !room.matchRecorded) this.finishByDisconnect(room, player.playerId, reason);
    else this.handleLobbyDeparture(room, player.playerId, reason);
  }

  finishByDisconnect(room, leftPlayerId, reason) {
    const winnerPlayerId = leftPlayerId === 'a' ? 'b' : 'a';
    const leftPlayer = room.players[leftPlayerId];
    const winner = room.players[winnerPlayerId];
    const finishReason = reason === 'user_leave' ? 'surrender' : (reason || 'disconnect');
    const fallback = leftPlayer && leftPlayer.lastSnapshot ? leftPlayer.lastSnapshot : {};
    if (leftPlayer && !leftPlayer.result) {
      leftPlayer.result = {
        hearts: 0,
        wave: Number.isFinite(fallback.wave) ? fallback.wave : 0,
        time: Number.isFinite(fallback.time) ? fallback.time : 0,
        reason: finishReason
      };
    }
    if (winner) sendJson(winner.socket, { type: 'peer_left', roomId: room.id, reason: finishReason });
    this.tryFinalizeMatch(room);
  }

  handleLobbyDeparture(room, playerId, reason) {
    room.players[playerId] = null;
    const peer = room.players[playerId === 'a' ? 'b' : 'a'];
    if (peer) {
      peer.ready = false;
      sendJson(peer.socket, { type: 'peer_left', roomId: room.id, reason });
      this.broadcastRoomUpdate(room, 'room_update');
      room.updatedAt = now();
      return;
    }
    this.rooms.delete(room.id);
  }

  getSocketRoom(socket) {
    if (!socket.roomId || !socket.playerId) return null;
    return this.rooms.get(socket.roomId) || null;
  }

  sendToPeer(socket, payload) {
    const room = this.getSocketRoom(socket);
    if (!room) return;
    const peerId = socket.playerId === 'a' ? 'b' : 'a';
    const peer = room.players[peerId];
    if (!peer || !peer.connected) return;
    sendJson(peer.socket, { ...payload, from: socket.playerId, roomId: room.id });
  }

  broadcastRoomUpdate(room, type) {
    const payload = { type, roomId: room.id, room: this.publicRoom(room) };
    for (const player of Object.values(room.players)) {
      if (player && player.connected) sendJson(player.socket, payload);
    }
  }

  publicRoom(room) {
    return {
      id: room.id,
      status: room.status,
      mapIndex: room.mapIndex,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      startedAt: room.startedAt,
      players: Object.values(room.players).filter(Boolean).map((player) => this.publicPlayer(player))
    };
  }

  publicPlayer(player) {
    return {
      playerId: player.playerId,
      userId: player.userId,
      username: player.username,
      displayName: player.displayName,
      stats: player.stats,
      ready: player.ready,
      connected: player.connected,
      result: player.result ? { ...player.result } : null
    };
  }

  syncUserInRoom(socket) {
    const room = this.getSocketRoom(socket);
    if (!room) return;
    const player = room.players[socket.playerId];
    if (!player) return;
    player.displayName = socket.user.displayName;
    player.stats = socket.user.stats;
    this.broadcastRoomUpdate(room, 'room_update');
  }

  cleanupRooms() {
    const expiresBefore = now() - ROOM_TTL_MS;
    for (const [roomId, room] of this.rooms.entries()) {
      const hasOpenPlayer = Object.values(room.players).some(
        (player) => player && player.socket.readyState === WebSocket.OPEN
      );
      if (!hasOpenPlayer || room.updatedAt < expiresBefore) this.rooms.delete(roomId);
    }
  }
}

function createOnlineServer(options) {
  return new OnlineRoomServer(options);
}

if (require.main === module) {
  const port = Number.parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
  const host = process.env.HOST || DEFAULT_HOST;
  const onlineServer = createOnlineServer();
  onlineServer.listen(port, host, () => {
    console.log('十二生肖公网对战服务已启动: http://' + host + ':' + port);
    console.log('账号与战绩数据文件: ' + onlineServer.store.dataFile);
  });
}

module.exports = {
  OnlineDataStore,
  OnlineRoomServer,
  createOnlineServer
};
