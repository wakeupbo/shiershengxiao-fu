// 主循环、布局、地图绘制、场景状态机
(function () {
  var root = (typeof GameGlobal !== 'undefined') ? GameGlobal
    : (typeof globalThis !== 'undefined') ? globalThis
    : (typeof window !== 'undefined') ? window
    : (typeof self !== 'undefined') ? self : {};
  var ZY = root.ZY = root.ZY || {};
  var A = ZY.adapter, C = ZY.C, R = ZY.R;

  var Main = {};
  ZY.Main = Main;
  ZY.weaponLibOpen = false; // 显式初始化

  // ---- 布局（按屏幕高度自适应格子大小，避免底部按钮被裁切）----
  function layout() {
    var DW = A.DW, DH = A.DH;
    ZY.Map.ensureMarked(); // 确保 cellType 已标记（含可解锁格）
    var onlineHud = ZY.Online && ZY.Online.isActive && ZY.Online.isActive();
    var topBar = onlineHud ? 150 : 128;
    var benchSlot = 92, benchGap = 10;
    var btnH = 96;
    var bottomH = benchSlot + btnH + 50;
    var availH = DH - topBar - bottomH;
    var cellByH = Math.floor(availH / ZY.Map.ROWS);
    var cellByW = Math.floor((DW - 24) / ZY.Map.COLS);
    var cell = Math.min(78, cellByH, cellByW);
    if (cell < 52) cell = 52;

    var mapW = cell * ZY.Map.COLS;
    var mapH = cell * ZY.Map.ROWS;
    var mapY = topBar;
    var benchW = benchSlot * C.ECON.benchSize + benchGap * (C.ECON.benchSize - 1);
    ZY.L = {
      cell: cell,
      mapX: (DW - mapW) / 2, mapY: mapY, mapW: mapW, mapH: mapH,
      benchSlot: benchSlot, benchGap: benchGap,
      benchX: (DW - benchW) / 2 + 34,
      benchY: mapY + mapH + 66,
      btnY: mapY + mapH + 130,
      topBar: topBar
    };
  }
  ZY.onResize = layout;

  // ---- 对局 ----
  function cleanupGame() {
    ZY.Board.reset();
    if (ZY.G) {
      ZY.Enemies.reset();
      ZY.Battle.reset();
    }
    ZY.weaponLibOpen = false;
    ZY.UI.avatarPickerOpen = false;
  }

  function startGame(opt) {
    opt = opt || {};
    layout();
    ZY.Map.resetUnlockable(opt.mapIndex); // 重置铲子可解锁格（每局重新标记）
    // 每局从 6 个生肖武将中随机抽取本局可觉醒武将（默认 4 个）
    if (C.selectHeroes) C.selectHeroes(C.HEROES_PER_GAME);
    ZY.G = {
      scene: 'play',
      mode: opt.online ? 'online' : 'solo',
      online: !!opt.online,
      time: 0,
      kills: 0,
      coinReward: 0,
      p: ZY.Board.newSide(),
      e: ZY.Board.newSide(),
      win: false
    };
    ZY.Board.reset();
    ZY.Enemies.reset();
    ZY.Battle.reset();
    ZY.AI.reset();
    // 开局备战席直接填满5个随机卡牌（玩家+对手各5个）
    // 对手 AI 抽卡运气随玩家段位提升
    var aiLuck = ZY.AI.curLuck();
    for (var i = 0; i < C.ECON.benchSize; i++) {
      ZY.G.p.bench[i] = ZY.Board.rollCard(ZY.G.p);
      ZY.G.e.bench[i] = opt.online ? null : ZY.Board.rollCard(ZY.G.e, aiLuck);
    }
    ZY.UI.toast(opt.online ? '公网对战开始！' : '把字牌拖上白色空地布阵！');
  }

  function newGame() {
    if (ZY.Online && ZY.Online.isConnected && ZY.Online.isConnected()) ZY.Online.leave();
    // 调试：浏览器端可用 ?map=0..4 指定本局地图（与 ?bot=1 配套）
    var mapIndex;
    if (typeof location !== 'undefined') {
      var m = /[?&]map=(\d+)/.exec(location.search);
      if (m) mapIndex = parseInt(m[1], 10);
    }
    startGame({ online: false, mapIndex: mapIndex });
  }
  Main.newGame = newGame;

  Main.newOnlineGame = function (mapIndex) {
    startGame({ online: true, mapIndex: mapIndex });
  };

  function readInt(key, fallback) {
    var value = parseInt(A.storageGet(key) || String(fallback), 10);
    return Number.isFinite(value) ? value : fallback;
  }

  Main.finishMatch = function (win, meta) {
    var G = ZY.G;
    if (!G || G.scene === 'over') return;
    G.scene = 'over';
    G.win = !!win;
    G.onlineReason = meta && meta.onlineReason;
    G.coinReward = (win ? 10 : 3) + Math.max(0, G.wave || 0);
    G.rankPromote = null;
    if (win) {
      var p = ZY.Rank.promoteOnWin();
      G.rankPromote = p;
      var best = readInt('zy_best', 0);
      if (G.wave > best) A.storageSet('zy_best', String(G.wave));
    }
    var coin = readInt('zy_coin', 0);
    A.storageSet('zy_coin', String(coin + G.coinReward));
    ZY.sfx(win ? 'win' : 'lose');
  };

  Main.matchEnd = function () {
    var G = ZY.G;
    if (!G || G.scene === 'over') return;
    if (G.online && ZY.Online && ZY.Online.onLocalMatchEnd) {
      ZY.Online.onLocalMatchEnd(G.p.hearts <= 0 ? 'hearts' : 'finish');
      return;
    }
    var win;
    if (G.e.hearts <= 0 && G.p.hearts > 0) win = true;
    else if (G.p.hearts <= 0 && G.e.hearts > 0) win = false;
    else win = G.p.hearts >= G.e.hearts; // 同归于尽或撑满波数时比红心，平局判玩家险胜
    Main.finishMatch(win);
  };

  // ---- 地图绘制 ----
  function drawMap(ctx) {
    var L = ZY.L, Map = ZY.Map;
    // 外框（按地图主题色）
    var th = R.theme();
    ctx.save();
    ctx.fillStyle = th.frame || '#4a392b';
    R.roundRect(ctx, L.mapX - 12, L.mapY - 12, L.mapW + 24, L.mapH + 24, 14);
    ctx.fill();
    ctx.restore();

    for (var r = 0; r < Map.ROWS; r++) {
      for (var c = 0; c < Map.COLS; c++) {
        var x = L.mapX + c * L.cell, y = L.mapY + r * L.cell;
        var t = Map.cellType[c + '_' + r];
        var seed = c * 31 + r * 17 + 5;
        if (t === 'path') {
          R.tilePath(ctx, x, y, L.cell, seed);
        } else {
          R.tileGreen(ctx, x, y, L.cell, seed);
          if (t === 'build_p' || t === 'build_e') R.tileWhite(ctx, x, y, L.cell);
        }
      }
    }

    // 中线山脊
    var midY = L.mapY + L.cell * 5;
    R.pathStones(ctx, L.mapX, midY, L.mapX + L.mapW, midY);

    // 路缘石（路与非路的横向交界）
    ctx.save();
    ctx.globalAlpha = 0.55;
    for (var r2 = 0; r2 < Map.ROWS; r2++) {
      for (var c2 = 0; c2 < Map.COLS; c2++) {
        var t2 = Map.cellType[c2 + '_' + r2];
        if (t2 !== 'path') continue;
        var up = r2 > 0 ? Map.cellType[c2 + '_' + (r2 - 1)] : 'path';
        var x2 = L.mapX + c2 * L.cell, y2 = L.mapY + r2 * L.cell;
        if (up !== 'path') R.pathStones(ctx, x2, y2, x2 + L.cell, y2);
      }
    }
    ctx.restore();

    // 刷怪丛与守将
    var G = ZY.G;
    ['p', 'e'].forEach(function (side) {
      var sp = Map.spawnOf(side), ad = Map.adouOf(side);
      var spc = Map.cellCenter(sp[0], sp[1]);
      R.bush(ctx, spc.x, spc.y, L.cell * 0.9);
      var adc = Map.cellCenter(ad[0], ad[1]);
      var S = side === 'p' ? G.p : G.e;
      if (S.shakeT > 0) S.shakeT -= 1 / 60;
      R.adou(ctx, adc.x, adc.y, L.cell * 0.82, S.hearts, C.ECON.hearts, S.shakeT > 0);
    });
  }

  function drawUnits(ctx) {
    var G = ZY.G, L = ZY.L;
    var d = ZY.Board.dragging();
    ['p', 'e'].forEach(function (side) {
      var S = side === 'p' ? G.p : G.e;
      ZY.Board.eachUnit(S, function (u, c, r, k) {
        var p = ZY.Map.cellCenter(c, r);
        var isDragSrc = d && d.moved && side === 'p' && d.from.type === 'cell' && d.from.key === k;
        ZY.Board.drawUnit(ctx, u, p.x, p.y, L.cell - 12, isDragSrc ? 0.3 : 1);
      });
    });
  }

  // 绘制选中单位的攻击范围圈（参考原版半透明圆形样式）
  function drawSelectedRange(ctx) {
    var sel = ZY.Board.selected();
    if (!sel) return;
    var G = ZY.G, L = ZY.L;
    var u = null, px, py;
    if (sel.key.indexOf('bench_') === 0) {
      var bi = parseInt(sel.key.slice(6), 10);
      u = G.p.bench[bi];
      var bc = ZY.Board.benchSlotCenter(bi);
      px = bc.x; py = bc.y;
    } else {
      u = G.p.units[sel.key];
      var cr = sel.key.split('_');
      var cc = ZY.Map.cellCenter(+cr[0], +cr[1]);
      px = cc.x; py = cc.y;
    }
    if (!u) { ZY.Board.clearSelected(); return; }
    var st = ZY.unitStats(u);
    if (st.inert) return; // 碎片/铲子无攻击范围
    var radius = st.range * L.cell;
    R.rangeCircle(ctx, px, py, radius, 'p');
  }

  function drawPlay(ctx) {
    R.paper(ctx, A.DW, A.DH);
    drawMap(ctx);
    drawSelectedRange(ctx);
    drawUnits(ctx);
    ZY.Enemies.draw(ctx);
    ZY.Battle.draw(ctx);
    ZY.UI.drawHUD(ctx);
  }
  Main.drawPlay = drawPlay; // 供截图/预览工具复用同一套绘制流程

  // ---- 输入 ----

  function redeemWeaponCode() {
    if (!ZY.Weapon || !ZY.Weapon.redeemCode) return ZY.UI.toast('当前版本不支持兑换码');
    if (typeof prompt === 'undefined') return ZY.UI.toast('请在浏览器中输入兑换码');
    var value = prompt('输入兵器库兑换码');
    if (value === null) return;
    var result = ZY.Weapon.redeemCode(value);
    ZY.UI.toast(result.message || (result.ok ? '兑换成功' : '兑换失败'));
    if (result.ok) {
      ZY.weaponLibOpen = true;
      ZY.sfx('summon');
    }
  }
  function handleOnlineLobbyDown(x, y) {
    var ub = ZY.UI.buttons;
    var online = ZY.Online;
    if (!online || !online.state || !online.state().lobbyOpen) return false;
    if (R.inside(ub.onlineClose, x, y)) { ZY.sfx('click'); online.closeLobby(); return true; }
    if (R.inside(ub.onlineLogin, x, y)) { ZY.sfx('click'); online.loginFromPrompt(); return true; }
    if (R.inside(ub.onlineRegister, x, y)) { ZY.sfx('click'); online.registerFromPrompt(); return true; }
    if (R.inside(ub.onlineLogout, x, y)) { ZY.sfx('click'); online.logout(); return true; }
    if (R.inside(ub.onlineRename, x, y)) { ZY.sfx('click'); online.renameFromPrompt(); return true; }
    if (R.inside(ub.onlineCreate, x, y)) { ZY.sfx('click'); online.createRoom(); return true; }
    if (R.inside(ub.onlineJoin, x, y)) { ZY.sfx('click'); online.joinFromPrompt(); return true; }
    if (R.inside(ub.onlineJoinInvite, x, y)) { ZY.sfx('click'); online.joinRoom(online.state().pendingRoomId); return true; }
    if (R.inside(ub.onlineCopy, x, y)) { ZY.sfx('click'); online.copyInvite(); return true; }
    if (R.inside(ub.onlineReady, x, y)) { ZY.sfx('click'); online.toggleReady(); return true; }
    if (R.inside(ub.onlineLeave, x, y)) { ZY.sfx('click'); online.leaveRoom(); return true; }
    return true;
  }
  function onDown(x, y) {
    var G = ZY.G, ub = ZY.UI.buttons;
    // 头像选择弹窗打开时：优先处理弹窗点击
    if (ZY.UI.avatarPickerOpen) {
      for (var i = 0; i < ZY.UI.avatarButtons.length; i++) {
        var ab = ZY.UI.avatarButtons[i];
        if (R.inside(ab, x, y)) {
          ZY.UI.setAvatar(ab.ch);
          ZY.sfx('click');
          ZY.UI.avatarPickerOpen = false;
          return;
        }
      }
      // 点击弹窗外关闭
      ZY.UI.avatarPickerOpen = false;
      return;
    }
    // 武器库界面：独立交互
    if (ZY.weaponLibOpen) { onWeaponLibDown(x, y); return; }
    if (!G || G.scene === 'start') {
      if (handleOnlineLobbyDown(x, y)) return;
      if (ub.avatar && R.inside(ub.avatar, x, y)) { ZY.sfx('click'); ZY.UI.avatarPickerOpen = true; return; }
      if (ub.weaponLib && R.inside(ub.weaponLib, x, y)) {
        ZY.sfx('click');
        if (ZY.Weapon && ZY.Weapon.isLibraryUnlocked && !ZY.Weapon.isLibraryUnlocked()) { redeemWeaponCode(); return; }
        ZY.weaponLibOpen = true;
        return;
      }
      if (ub.online && R.inside(ub.online, x, y)) {
        ZY.sfx('click');
        if (ZY.Online && ZY.Online.openLobby) ZY.Online.openLobby();
        else ZY.UI.toast('当前环境不支持公网对战');
        return;
      }
      if (R.inside(ub.start, x, y)) { ZY.sfx('click'); newGame(); }
      return;
    }
    if (G.scene === 'over') {
      if (R.inside(ub.again, x, y)) { ZY.sfx('click'); if (G.online && ZY.Online) ZY.Online.leave(); newGame(); }
      else if (R.inside(ub.claim, x, y)) { ZY.sfx('click'); if (G.online && ZY.Online) ZY.Online.leave(); cleanupGame(); ZY.G = null; }
      return;
    }
    if (G.scene === 'online_wait') return;
    if (G.scene === 'pause') {
      if (R.inside(ub.resume, x, y)) { ZY.sfx('click'); G.scene = 'play'; }
      else if (R.inside(ub.home, x, y)) {
        ZY.sfx('click');
        if (G.online && ZY.Online) {
          if (ZY.Online.surrender && ZY.Online.surrender()) return;
          ZY.Online.leave();
        }
        cleanupGame();
        ZY.G = null;
      }
      return;
    }
    if (R.inside(ub.pause, x, y)) { ZY.sfx('click'); G.scene = 'pause'; return; }
    if (R.inside(ub.sound, x, y)) { ZY.sfxToggle(); return; }
    if (ub.recruit && R.inside(ub.recruit, x, y)) {
      ZY.sfx('click');
      if (ZY.Board.recruit(G.p, true) && ZY.Online) ZY.Online.markDirty();
      return;
    }
    ZY.Board.onDown(x, y);
  }

  // 武器库交互：down
  function onWeaponLibDown(x, y) {
    var ub = ZY.UI.buttons, W = ZY.Weapon;
    // 返回
    if (R.inside(ub.wlibBack, x, y)) { ZY.sfx('click'); ZY.weaponLibOpen = false; return; }
    if (R.inside(ub.wlibRedeem, x, y)) { ZY.sfx('click'); redeemWeaponCode(); return; }
    // 合成按钮
    for (var i = 0; i < ZY.UI.weaponCraftBtns.length; i++) {
      var cb = ZY.UI.weaponCraftBtns[i];
      if (R.inside(cb, x, y)) {
        if (W.craft(cb.wid)) { ZY.sfx('summon'); ZY.UI.toast('合成成功！'); }
        return;
      }
    }
    // 点击已装备槽：卸下
    for (var s = 0; s < ZY.UI.weaponSlots.length; s++) {
      var slot = ZY.UI.weaponSlots[s];
      if (R.inside(slot, x, y)) {
        if (W.equipped(slot.name)) { W.unequip(slot.name); ZY.sfx('click'); }
        return;
      }
    }
    // 点击已拥有武器：开始拖拽
    for (var k = 0; k < ZY.UI.weaponItems.length; k++) {
      var it = ZY.UI.weaponItems[k];
      if (R.inside(it, x, y)) {
        ZY.UI.weaponDrag = { wid: it.wid, x: x, y: y, downX: x, downY: y, moved: false };
        ZY.sfx('click');
        return;
      }
    }
  }

  function onWeaponLibMove(x, y) {
    var d = ZY.UI.weaponDrag;
    if (!d) return;
    if (!d.moved) {
      var dx0 = x - d.downX, dy0 = y - d.downY;
      if (dx0 * dx0 + dy0 * dy0 < 64) return;
      d.moved = true;
    }
    d.x = x; d.y = y;
  }

  function onWeaponLibUp(x, y) {
    var d = ZY.UI.weaponDrag;
    ZY.UI.weaponDrag = null;
    if (!d || !d.moved) return;
    var W = ZY.Weapon;
    // 落在角色槽：尝试装备
    for (var s = 0; s < ZY.UI.weaponSlots.length; s++) {
      var slot = ZY.UI.weaponSlots[s];
      if (R.inside(slot, x, y)) {
        if (W.canEquip(slot.name, d.wid)) {
          W.equip(slot.name, d.wid);
          ZY.sfx('merge');
          ZY.UI.toast(C.WEAPON_MAP[d.wid].name + ' → ' + slot.name);
        } else {
          var wp = C.WEAPON_MAP[d.wid];
          if (wp.owner && wp.owner !== slot.name) {
            ZY.UI.toast(wp.name + ' 仅 ' + wp.owner + ' 可装备');
          }
        }
        return;
      }
    }
  }

  function onMove(x, y) {
    var G = ZY.G;
    if (ZY.weaponLibOpen) { onWeaponLibMove(x, y); return; }
    if (G && G.scene === 'play') ZY.Board.onMove(x, y);
  }

  function onUp(x, y) {
    var G = ZY.G;
    if (ZY.weaponLibOpen) { onWeaponLibUp(x, y); return; }
    if (G && G.scene === 'play') {
      if (ZY.Board.onUp(x, y) && ZY.Online) ZY.Online.markDirty();
      // 放置后扫描相邻碎片自动合成武将（覆盖所有放置路径）
      if (G.p) ZY.Board.autoSynthesize(G.p, 'p', true);
    }
  }

  A.on('down', onDown);
  A.on('move', onMove);
  A.on('up', onUp);

  // ---- 挂机调试（?bot=1）----
  var botOn = (typeof location !== 'undefined' && /bot=1/.test(location.search));
  // 调试：?lib=1 直接打开兵器库（用于预览武器/装备槽）
  if (typeof location !== 'undefined' && /lib=1/.test(location.search)) ZY.weaponLibOpen = true;
  var botT = 0;
  function botTick(dt) {
    var G = ZY.G;
    var ub = ZY.UI.buttons;
    if (!G) { if (ub.start) onDown(ub.start.x + 5, ub.start.y + 5); return; }
    if (G.scene === 'over') { if (ub.again) onDown(ub.again.x + 5, ub.again.y + 5); return; }
    if (G.scene !== 'play') return;
    botT += dt;
    if (botT < 0.5) return;
    botT = 0;
    ZY.AI.step(G.p, 'p', 0); // 挂机模式：玩家侧征兵运气为 0（不使用 AI 难度 luck）
  }

  // ---- 主循环 ----
  var lastT = 0;
  var frameTime = 0; // 全局动画时间（秒），供 UI 呼吸/水墨等动画使用
  ZY.frameTime = function () { return frameTime; };
  function frame(now) {
    if (!lastT) lastT = now;
    var dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;
    frameTime += dt;
    var G = ZY.G;
    var ctx = A.ctx;
    if (ctx) {
      if (botOn) botTick(dt);
      if (G && G.scene === 'play') {
        G.time += dt;
        ZY.Enemies.update(dt);
        if (ZY.G && ZY.G.scene === 'play') {
          ZY.Battle.update(dt);
          if (!G.online) ZY.AI.update(dt);
        }
        if (ZY.Online) ZY.Online.update(dt);
        ZY.UI.update(dt);
        drawPlay(ctx);
      } else if (G && G.scene === 'online_wait') {
        ZY.UI.update(dt);
        drawPlay(ctx);
        if (ZY.UI.drawOnlineWait) ZY.UI.drawOnlineWait(ctx);
      } else if (G && G.scene === 'pause') {
        drawPlay(ctx);
        ZY.UI.drawPause(ctx);
      } else if (G && G.scene === 'over') {
        ZY.UI.update(dt);
        ZY.UI.drawOver(ctx, G.win);
      } else {
        ZY.UI.update(dt);
        if (ZY.weaponLibOpen) ZY.UI.drawWeaponLib(ctx);
        else ZY.UI.drawStart(ctx);
      }
    }
    A.raf(frame);
  }

  layout();
  ZY.G = null;
  if (A.hasScreen) A.raf(frame);
})();
