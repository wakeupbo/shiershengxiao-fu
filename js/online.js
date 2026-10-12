// 网页端公网对战：账号、房间大厅、ready 开局与对局同步
(function () {
  var root = (typeof GameGlobal !== 'undefined') ? GameGlobal
    : (typeof globalThis !== 'undefined') ? globalThis
    : (typeof window !== 'undefined') ? window
    : (typeof self !== 'undefined') ? self : {};
  var ZY = root.ZY = root.ZY || {};

  var Online = {};
  var socket = null;
  var openQueue = [];
  var authQueue = [];
  var lastSnapshotAt = 0;
  var dirty = false;
  var finishedLocal = null;
  var finishedPeer = null;

  var TOKEN_KEY = 'zy_online_token';
  var USER_KEY = 'zy_online_user';

  var state = {
    supported: typeof WebSocket !== 'undefined',
    connected: false,
    connecting: false,
    authenticating: false,
    socketAuthed: false,
    lobbyOpen: false,
    active: false,
    user: readStoredUser(),
    token: readStoredToken(),
    room: null,
    roomId: null,
    roomStatus: '',
    playerId: null,
    ready: false,
    mapIndex: null,
    status: '',
    peerName: '',
    peerReady: false,
    peerConnected: false,
    peerSnapshot: null,
    pendingRoomId: readRoomParam(),
    inviteText: '',
    lastMatch: null,
    wsUrl: ''
  };

  function adapter() {
    return ZY.adapter || null;
  }

  function storageGet(key) {
    var A = adapter();
    if (A && A.storageGet) return A.storageGet(key);
    try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null; } catch (e) { return null; }
  }

  function storageSet(key, value) {
    var A = adapter();
    try {
      if (A && A.storageSet) A.storageSet(key, value);
      else if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    } catch (e) {}
  }

  function readStoredToken() {
    var token = storageGet(TOKEN_KEY);
    return token && token.length >= 32 ? token : null;
  }

  function readStoredUser() {
    var raw = storageGet(USER_KEY);
    if (!raw) return null;
    try {
      var user = JSON.parse(raw);
      return user && typeof user === 'object' && user.id ? user : null;
    } catch (e) {
      return null;
    }
  }

  function toast(text) {
    if (ZY.UI && ZY.UI.toast) ZY.UI.toast(text);
  }

  function getParam(name) {
    if (typeof location === 'undefined') return null;
    var params = new URLSearchParams(location.search);
    return params.get(name);
  }

  function readRoomParam() {
    var roomId = getParam('room');
    if (!roomId) return null;
    roomId = roomId.trim().toUpperCase();
    return /^[A-Z0-9]{4,8}$/.test(roomId) ? roomId : null;
  }

  function resolveWsUrl() {
    var explicit = getParam('ws');
    if (explicit) return explicit;
    if (typeof location !== 'undefined' && /^https?:$/.test(location.protocol)) {
      var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      return proto + '//' + location.host + '/ws';
    }
    return 'ws://127.0.0.1:8787/ws';
  }

  function playerName() {
    if (state.user && state.user.displayName) return state.user.displayName;
    if (ZY.UI && ZY.C && ZY.UI.currentAvatar) {
      var avatar = ZY.UI.currentAvatar();
      return ZY.C.AVATAR_LABELS[avatar] || '玩家';
    }
    return '玩家';
  }

  function saveAuth(token, user) {
    state.token = token || state.token;
    state.user = user || state.user;
    state.socketAuthed = true;
    state.authenticating = false;
    if (state.token) storageSet(TOKEN_KEY, state.token);
    if (state.user) storageSet(USER_KEY, JSON.stringify(state.user));
  }

  function clearAuth() {
    state.user = null;
    state.token = null;
    state.socketAuthed = false;
    state.authenticating = false;
    storageSet(TOKEN_KEY, '');
    storageSet(USER_KEY, '');
  }

  function send(type, fields) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    var message = fields && typeof fields === 'object' ? fields : {};
    message.type = type;
    message.sentAt = Date.now();
    socket.send(JSON.stringify(message));
    return true;
  }

  function closeSocket() {
    if (!socket) return;
    socket.onopen = null;
    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;
    try { socket.close(); } catch (e) {}
    socket = null;
  }

  function resetMatchState() {
    lastSnapshotAt = 0;
    dirty = false;
    finishedLocal = null;
    finishedPeer = null;
    state.peerSnapshot = null;
  }

  function clearDisconnectedWaitingRoom() {
    if (!state.roomId || state.active) return false;
    resetMatchState();
    resetRoomState();
    state.lobbyOpen = true;
    state.status = '连接已断开，请重新创建房间';
    return true;
  }

  function resetRoomState() {
    state.active = false;
    state.room = null;
    state.roomId = null;
    state.roomStatus = '';
    state.playerId = null;
    state.ready = false;
    state.mapIndex = null;
    state.peerName = '';
    state.peerReady = false;
    state.peerConnected = false;
    state.peerSnapshot = null;
    state.inviteText = '';
  }
  function connect() {
    if (!state.supported) {
      toast('当前环境不支持公网对战');
      return;
    }
    if (socket && socket.readyState === WebSocket.OPEN) return;
    if (state.connecting) return;
    closeSocket();
    state.connected = false;
    state.connecting = true;
    state.socketAuthed = false;
    state.authenticating = false;
    state.status = '正在连接对战服务...';
    state.wsUrl = resolveWsUrl();

    socket = new WebSocket(state.wsUrl);
    socket.onopen = function () {
      state.connected = true;
      state.connecting = false;
      state.status = state.user ? '已连接对战服务' : '请登录账号';
      flushOpenQueue();
    };
    socket.onerror = function () {
      state.status = '对战服务连接失败';
      toast('连接失败，请确认对战服务已启动');
    };
    socket.onclose = function () {
      state.connected = false;
      state.connecting = false;
      state.socketAuthed = false;
      state.authenticating = false;
      if (state.active) {
        state.status = '连接已断开';
        state.peerConnected = false;
        return;
      }
      clearDisconnectedWaitingRoom();
    };
    socket.onmessage = function (event) {
      try {
        handleMessage(JSON.parse(event.data));
      } catch (e) {
        state.status = '收到无效服务消息';
      }
    };
  }

  function flushOpenQueue() {
    var queue = openQueue.slice();
    openQueue = [];
    for (var i = 0; i < queue.length; i++) queue[i]();
  }

  function flushAuthQueue() {
    var queue = authQueue.slice();
    authQueue = [];
    for (var i = 0; i < queue.length; i++) queue[i]();
  }

  function runWhenOpen(action) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      action();
      return;
    }
    openQueue.push(action);
    connect();
  }

  function authenticateSocket() {
    if (!state.token || state.authenticating || state.socketAuthed) return;
    state.authenticating = true;
    state.status = '正在恢复登录...';
    send('auth', { token: state.token });
  }

  function runWhenAuthenticated(action) {
    if (!state.user && !state.token) {
      state.lobbyOpen = true;
      state.status = '请先登录账号';
      toast('请先登录账号');
      return;
    }
    authQueue.push(action);
    runWhenOpen(function () {
      if (state.socketAuthed) flushAuthQueue();
      else authenticateSocket();
    });
  }

  function updateRoom(room) {
    if (!room) return;
    state.room = room;
    state.roomId = room.id;
    state.roomStatus = room.status;
    state.mapIndex = room.mapIndex;
    state.inviteText = buildInviteText(room.id);
    var players = Array.isArray(room.players) ? room.players : [];
    var me = findMe(players);
    var peer = findPeer(players, me);
    if (me) {
      state.playerId = me.playerId;
      state.ready = !!me.ready;
    }
    state.peerName = peer ? peer.displayName : '';
    state.peerReady = !!(peer && peer.ready);
    state.peerConnected = !!(peer && peer.connected);
  }

  function findMe(players) {
    for (var i = 0; i < players.length; i++) {
      if (state.playerId && players[i].playerId === state.playerId) return players[i];
    }
    for (var j = 0; j < players.length; j++) {
      if (state.user && players[j].userId === state.user.id) return players[j];
    }
    return null;
  }

  function findPeer(players, me) {
    for (var i = 0; i < players.length; i++) {
      if (!me || players[i].playerId !== me.playerId) return players[i];
    }
    return null;
  }

  function buildInviteText(roomId) {
    if (!roomId) return '';
    return '房间码 ' + roomId + '\n邀请链接：' + Online.inviteLink(roomId);
  }

  Online.openLobby = function () {
    state.lobbyOpen = true;
    if (state.token && !state.socketAuthed) {
      runWhenOpen(authenticateSocket);
    }
  };

  Online.closeLobby = function () {
    if (!state.roomId) state.lobbyOpen = false;
  };

  Online.restoreSession = function () {
    if (!state.token) return;
    state.status = '正在恢复登录...';
    if (state.pendingRoomId) state.lobbyOpen = true;
    runWhenOpen(authenticateSocket);
  };

  Online.register = function (username, password, displayName) {
    runWhenOpen(function () {
      send('register', { username: username, password: password, displayName: displayName || playerName() });
    });
  };

  Online.login = function (username, password) {
    runWhenOpen(function () {
      send('login', { username: username, password: password });
    });
  };

  Online.registerFromPrompt = function () {
    if (typeof prompt === 'undefined') return toast('请在浏览器中注册账号');
    var username = prompt('注册账号：3-20 位字母、数字或下划线');
    if (username === null) return;
    var displayName = prompt('显示昵称：对手会在房间里看到', playerName());
    if (displayName === null) return;
    var password = prompt('设置密码：至少 6 位');
    if (password === null) return;
    Online.register(username, password, displayName);
  };

  Online.loginFromPrompt = function () {
    if (typeof prompt === 'undefined') return toast('请在浏览器中登录账号');
    var username = prompt('账号');
    if (username === null) return;
    var password = prompt('密码');
    if (password === null) return;
    Online.login(username, password);
  };

  Online.renameFromPrompt = function () {
    if (!state.user) return toast('请先登录账号');
    if (typeof prompt === 'undefined') return;
    var displayName = prompt('新的显示昵称', state.user.displayName || playerName());
    if (displayName === null) return;
    runWhenAuthenticated(function () { send('update_profile', { displayName: displayName }); });
  };

  Online.logout = function () {
    if (state.roomId) send('leave', { reason: 'logout' });
    closeSocket();
    clearAuth();
    resetMatchState();
    resetRoomState();
    state.connected = false;
    state.connecting = false;
    state.status = '已退出账号';
  };

  Online.createRoom = function () {
    state.lobbyOpen = true;
    if (!state.connected) clearDisconnectedWaitingRoom();
    runWhenAuthenticated(function () { send('create', {}); });
  };

  Online.joinRoom = function (roomId) {
    var cleanRoomId = String(roomId || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4,8}$/.test(cleanRoomId)) return toast('房间码格式不正确');
    state.lobbyOpen = true;
    runWhenAuthenticated(function () { send('join', { roomId: cleanRoomId }); });
  };

  Online.joinFromPrompt = function () {
    if (typeof prompt === 'undefined') return toast('请在浏览器中加入房间');
    var value = prompt('输入房间码', state.pendingRoomId || '');
    if (value === null) return;
    Online.joinRoom(value);
  };

  Online.toggleReady = function () {
    if (!state.roomId) return toast('请先创建或加入房间');
    runWhenAuthenticated(function () { send('ready', { ready: !state.ready }); });
  };
  Online.copyInvite = function () {
    if (!state.roomId) return toast('请先创建房间');
    var text = buildInviteText(state.roomId);
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast('邀请信息已复制');
      }).catch(function () {
        fallbackCopy(text);
      });
      return;
    }
    fallbackCopy(text);
  };

  function fallbackCopy(text) {
    if (typeof prompt !== 'undefined') prompt('复制邀请信息', text);
    else toast('房间码：' + state.roomId);
  }

  Online.inviteLink = function (roomId) {
    if (typeof location === 'undefined') return roomId || '';
    var url = new URL(location.href);
    url.searchParams.set('room', roomId || state.roomId || '');
    url.searchParams.delete('bot');
    return url.toString();
  };

  Online.startFromPrompt = function () {
    Online.openLobby();
  };

  Online.create = Online.createRoom;
  Online.join = Online.joinRoom;

  function handleMessage(message) {
    if (message.type === 'hello') return;
    if (message.type === 'auth_ok') return handleAuthOk(message);
    if (message.type === 'profile') return handleProfile(message);
    if (message.type === 'room_created') return handleRoomCreated(message);
    if (message.type === 'room_joined') return handleRoomJoined(message);
    if (message.type === 'room_update') return handleRoomUpdate(message);
    if (message.type === 'match_start') return handleMatchStart(message);
    if (message.type === 'match_recorded') return handleMatchRecorded(message);
    if (message.type === 'snapshot') return handleSnapshot(message);
    if (message.type === 'game_over') return handlePeerGameOver(message);
    if (message.type === 'peer_left') return handlePeerLeft(message);
    if (message.type === 'error') return handleError(message);
  }

  function handleAuthOk(message) {
    saveAuth(message.token, message.user);
    state.status = '已登录：' + (state.user.displayName || state.user.username);
    toast('登录成功');
    flushAuthQueue();
  }

  function handleProfile(message) {
    if (!message.user) return;
    state.user = message.user;
    storageSet(USER_KEY, JSON.stringify(state.user));
  }

  function handleRoomCreated(message) {
    resetMatchState();
    updateRoom(message.room);
    state.roomId = message.roomId;
    state.playerId = message.playerId;
    state.mapIndex = message.mapIndex;
    state.lobbyOpen = true;
    state.status = '房间已创建，复制邀请给好友';
    toast('房间码：' + message.roomId);
  }

  function handleRoomJoined(message) {
    resetMatchState();
    updateRoom(message.room);
    state.roomId = message.roomId;
    state.playerId = message.playerId;
    state.mapIndex = message.mapIndex;
    state.pendingRoomId = null;
    state.lobbyOpen = true;
    state.status = '已加入房间，等待双方准备';
  }

  function handleRoomUpdate(message) {
    updateRoom(message.room);
    if (state.roomStatus === 'waiting') {
      if (state.peerConnected) state.status = state.peerReady ? '对手已准备' : '对手已加入，等待准备';
      else state.status = '等待对手加入';
    }
  }

  function handleMatchStart(message) {
    updateRoom(message.room);
    state.active = true;
    state.lobbyOpen = false;
    state.roomId = message.roomId;
    state.playerId = message.playerId;
    state.mapIndex = message.mapIndex;
    state.status = '公网对战中';
    state.peerConnected = true;
    if (ZY.Main && ZY.Main.newOnlineGame) ZY.Main.newOnlineGame(message.mapIndex);
    markDirty();
  }

  function handleMatchRecorded(message) {
    state.lastMatch = message.match || null;
    if (message.user) {
      state.user = message.user;
      storageSet(USER_KEY, JSON.stringify(state.user));
    }
  }

  function handleSnapshot(message) {
    state.peerSnapshot = normalizeSnapshot(message.payload);
    applyPeerSnapshot();
  }

  function handlePeerGameOver(message) {
    finishedPeer = normalizeFinish(message.payload);
    resolveOnlineResult();
  }

  function handlePeerLeft(message) {
    state.peerConnected = false;
    state.peerReady = false;
    state.status = '对手已离开';
    if (state.active && ZY.G && ZY.G.scene !== 'over' && ZY.Main && ZY.Main.finishMatch) {
      ZY.Main.finishMatch(true, { onlineReason: message.reason || 'peer_left' });
    }
  }

  function handleError(message) {
    state.authenticating = false;
    state.status = message.message || '对战服务错误';
    if (state.status === '登录已失效') clearAuth();
    toast(state.status);
  }

  function cloneUnit(unit, side) {
    if (!unit || typeof unit !== 'object') return null;
    var out = {};
    ['kind', 'ch', 'name', 'half', 'pairedKey', 'lv', 'cd', 'attackT'].forEach(function (key) {
      if (unit[key] !== undefined) out[key] = unit[key];
    });
    if (out.kind === 'g') out.side = side;
    return out;
  }

  function mirrorKey(key) {
    var parts = String(key).split('_');
    if (parts.length !== 2) return null;
    var c = parseInt(parts[0], 10);
    var r = parseInt(parts[1], 10);
    if (!Number.isFinite(c) || !Number.isFinite(r)) return null;
    return (ZY.Map.COLS - 1 - c) + '_' + (ZY.Map.ROWS - 1 - r);
  }

  function mirrorUnits(units) {
    var out = {};
    var keyMap = {};
    Object.keys(units || {}).forEach(function (key) {
      var mirrored = mirrorKey(key);
      if (mirrored) keyMap[key] = mirrored;
    });
    Object.keys(keyMap).forEach(function (key) {
      var unit = cloneUnit(units[key], 'e');
      if (!unit) return;
      if (unit.pairedKey && keyMap[unit.pairedKey]) unit.pairedKey = keyMap[unit.pairedKey];
      out[keyMap[key]] = unit;
    });
    return out;
  }
  function onlineWaveLimit() {
    return ZY.C && Number.isFinite(ZY.C.ONLINE_MAX_REPORTED_WAVE) ? ZY.C.ONLINE_MAX_REPORTED_WAVE : 9999;
  }

  function normalizeSnapshot(payload) {
    if (!payload || typeof payload !== 'object') return null;
    return {
      hearts: clampInt(payload.hearts, 0, ZY.C.ECON.hearts),
      mantou: clampInt(payload.mantou, 0, 9999),
      wave: clampInt(payload.wave, 0, onlineWaveLimit()),
      waveState: typeof payload.waveState === 'string' ? payload.waveState.slice(0, 16) : '',
      restTimer: Number.isFinite(payload.restTimer) ? Math.max(0, payload.restTimer) : 0,
      units: payload.units && typeof payload.units === 'object' ? payload.units : {},
      bench: Array.isArray(payload.bench) ? payload.bench.slice(0, ZY.C.ECON.benchSize) : [],
      time: Number.isFinite(payload.time) ? Math.max(0, payload.time) : 0
    };
  }

  function normalizeFinish(payload) {
    if (!payload || typeof payload !== 'object') return null;
    return {
      hearts: clampInt(payload.hearts, 0, ZY.C.ECON.hearts),
      wave: clampInt(payload.wave, 0, onlineWaveLimit()),
      time: Number.isFinite(payload.time) ? Math.max(0, payload.time) : 0,
      reason: typeof payload.reason === 'string' ? payload.reason : 'unknown'
    };
  }

  function clampInt(value, min, max) {
    var n = parseInt(value, 10);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function extractLocalSnapshot() {
    var G = ZY.G;
    if (!G || !G.p) return null;
    return {
      hearts: G.p.hearts,
      mantou: G.p.mantou,
      wave: G.wave || 0,
      waveState: G.waveState || '',
      restTimer: G.restTimer || 0,
      units: G.p.units || {},
      bench: G.p.bench || [],
      time: G.time || 0
    };
  }

  function applyPeerSnapshot() {
    var G = ZY.G;
    var snapshot = state.peerSnapshot;
    if (!G || !snapshot || !G.e) return;
    G.e.hearts = snapshot.hearts;
    G.e.mantou = snapshot.mantou;
    G.e.units = mirrorUnits(snapshot.units);
    G.e.bench = snapshot.bench.map(function (unit) { return cloneUnit(unit, 'e'); });
    G.onlinePeer = {
      name: state.peerName || '对手',
      hearts: snapshot.hearts,
      wave: snapshot.wave,
      waveState: snapshot.waveState,
      restTimer: snapshot.restTimer,
      time: snapshot.time
    };
  }

  function markDirty() {
    dirty = true;
  }
  Online.markDirty = markDirty;

  Online.update = function (dt) {
    if (!state.active || !state.connected || !ZY.G || ZY.G.scene !== 'play') return;
    lastSnapshotAt += dt;
    if (!dirty && lastSnapshotAt < 0.3) return;
    lastSnapshotAt = 0;
    dirty = false;
    send('snapshot', { payload: extractLocalSnapshot() });
  };

  Online.onLocalMatchEnd = function (reason) {
    if (!state.active || !ZY.G) return false;
    var G = ZY.G;
    var finishReason = reason || (G.p.hearts <= 0 ? 'hearts' : 'finish');
    finishedLocal = {
      hearts: finishReason === 'surrender' ? 0 : Math.max(0, G.p.hearts),
      wave: G.wave || 0,
      time: G.time || 0,
      reason: finishReason
    };
    send('game_over', { payload: finishedLocal });
    return resolveOnlineResult();
  };

  Online.surrender = function () {
    return Online.onLocalMatchEnd('surrender');
  };

  function resolveOnlineResult() {
    var G = ZY.G;
    if (!state.active || !G || !ZY.Main || !ZY.Main.finishMatch) return false;
    if (finishedLocal && finishedLocal.hearts <= 0) {
      ZY.Main.finishMatch(false, { onlineReason: finishedLocal.reason });
      return true;
    }
    if (finishedPeer && finishedPeer.hearts <= 0) {
      ZY.Main.finishMatch(true, { onlineReason: finishedPeer.reason });
      return true;
    }
    if (!finishedLocal || !finishedPeer) {
      if (finishedLocal && G.scene === 'play') G.scene = 'online_wait';
      return false;
    }
    var localScore = finishedLocal.hearts * 1000 + finishedLocal.wave * 10 - finishedLocal.time / 1000;
    var peerScore = finishedPeer.hearts * 1000 + finishedPeer.wave * 10 - finishedPeer.time / 1000;
    ZY.Main.finishMatch(localScore >= peerScore, { onlineReason: 'score' });
    return true;
  }

  Online.leaveRoom = function () {
    if (state.connected && state.roomId) send('leave', { reason: 'user_leave' });
    resetMatchState();
    resetRoomState();
    state.status = state.user ? '已离开房间' : '';
  };

  Online.leave = function () {
    if (state.connected && state.roomId) send('leave', { reason: 'user_leave' });
    closeSocket();
    resetMatchState();
    resetRoomState();
    state.connected = false;
    state.connecting = false;
    state.socketAuthed = false;
    state.authenticating = false;
    state.status = state.user ? '已离开房间' : '';
  };

  Online.isActive = function () { return state.active; };
  Online.isConnected = function () { return state.connected; };
  Online.shouldSkipOpponentSimulation = function () { return state.active; };
  Online.state = function () { return state; };

  if (state.token) {
    setTimeout(function () { Online.restoreSession(); }, 0);
  }

  ZY.Online = Online;
})();