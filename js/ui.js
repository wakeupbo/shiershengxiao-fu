// UI：开始界面（星级/开始游戏）、对局 HUD（仙桃/波次/征兵/备战席）、胜负结算（乌云/卷轴）
(function () {
  var root = (typeof GameGlobal !== 'undefined') ? GameGlobal
    : (typeof globalThis !== 'undefined') ? globalThis
    : (typeof window !== 'undefined') ? window
    : (typeof self !== 'undefined') ? self : {};
  var ZY = root.ZY = root.ZY || {};
  var C = ZY.C, R = ZY.R, A = ZY.adapter;

  var UI = {};
  var toasts = [];
  UI.buttons = {};
  // 头像选择弹窗状态
  UI.avatarPickerOpen = false;
  UI.avatarButtons = []; // 弹窗中各头像按钮区域

  // 读取当前头像（持久化，校验合法性）
  UI.currentAvatar = function () {
    var v = A.storageGet('zy_avatar');
    if (v && C.AVATARS.indexOf(v) >= 0) return v;
    return C.AVATAR_DEFAULT;
  };
  UI.setAvatar = function (ch) {
    if (C.AVATARS.indexOf(ch) < 0) return; // 仅接受合法头像
    A.storageSet('zy_avatar', ch);
  };

  UI.toast = function (text) {
    toasts.push({ text: text, t: 0, dur: 1.8 });
    if (toasts.length > 3) toasts.shift();
  };

  UI.update = function (dt) {
    for (var i = toasts.length - 1; i >= 0; i--) {
      toasts[i].t += dt;
      if (toasts[i].t >= toasts[i].dur) toasts.splice(i, 1);
    }
  };

  function drawToasts(ctx) {
    var DW = A.DW;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < toasts.length; i++) {
      var t = toasts[i];
      var alpha = t.t < 0.2 ? t.t / 0.2 : t.t > t.dur - 0.4 ? (t.dur - t.t) / 0.4 : 1;
      ctx.globalAlpha = alpha * 0.95;
      R.font(ctx, 30, true);
      var w = ctx.measureText(t.text).width + 50;
      var lobbyOpen = ZY.Online && ZY.Online.state && ZY.Online.state().lobbyOpen;
      var y = (lobbyOpen ? A.DH - 156 : A.DH * 0.35) + i * 56;
      ctx.fillStyle = 'rgba(160,60,40,0.92)';
      R.roundRect(ctx, DW / 2 - w / 2, y - 26, w, 52, 10);
      ctx.fill();
      ctx.fillStyle = '#f7f0dc';
      ctx.fillText(t.text, DW / 2, y + 1);
    }
    ctx.restore();
  }

  function compactText(ctx, text, maxWidth) {
    var value = String(text || '');
    if (ctx.measureText(value).width <= maxWidth) return value;
    while (value.length > 1 && ctx.measureText(value + '…').width > maxWidth) value = value.slice(0, -1);
    return value + '…';
  }

  function playerSlotText(player, emptyText) {
    if (!player) return { title: emptyText, status: '等待加入', ready: false, connected: false };
    return {
      title: player.displayName || player.username || '玩家',
      status: player.connected ? (player.ready ? '已准备' : '未准备') : '已离线',
      ready: !!player.ready,
      connected: !!player.connected
    };
  }

  function drawLobbyButton(ctx, key, x, y, w, h, label, primary) {
    UI.buttons[key] = { x: x, y: y, w: w, h: h, label: label, fs: h >= 58 ? 25 : 21 };
    if (primary) R.redButton(ctx, UI.buttons[key]);
    else R.darkButton(ctx, UI.buttons[key]);
  }

  function drawPlayerSlot(ctx, x, y, w, h, label, playerInfo) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.36)';
    R.roundRect(ctx, x, y, w, h, 8); ctx.fill();
    ctx.strokeStyle = playerInfo.connected ? '#5f8f50' : 'rgba(80,70,60,0.35)';
    ctx.lineWidth = 2;
    R.roundRect(ctx, x, y, w, h, 8); ctx.stroke();
    R.font(ctx, 18, true);
    ctx.fillStyle = '#8a3a28';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 16, y + 22);
    R.font(ctx, 28, true);
    ctx.fillStyle = '#2c241a';
    ctx.fillText(compactText(ctx, playerInfo.title, w - 32), x + 16, y + 58);
    ctx.fillStyle = playerInfo.ready ? '#2f7d42' : (playerInfo.connected ? '#8a6a20' : '#8a3a28');
    R.font(ctx, 20, true);
    ctx.fillText(playerInfo.status, x + 16, y + 90);
    ctx.restore();
  }

  UI.drawOnlineLobby = function (ctx) {
    var DW = A.DW, DH = A.DH;
    var online = ZY.Online ? ZY.Online.state() : null;
    if (!online) return;
    UI.buttons.onlineLogin = null;
    UI.buttons.onlineRegister = null;
    UI.buttons.onlineLogout = null;
    UI.buttons.onlineRename = null;
    UI.buttons.onlineCreate = null;
    UI.buttons.onlineJoin = null;
    UI.buttons.onlineJoinInvite = null;
    UI.buttons.onlineCopy = null;
    UI.buttons.onlineReady = null;
    UI.buttons.onlineLeave = null;
    UI.buttons.onlineClose = null;

    ctx.save();
    ctx.fillStyle = 'rgba(30,26,20,0.66)';
    ctx.fillRect(0, 0, DW, DH);

    var pw = Math.min(660, DW - 48);
    var ph = online.roomId ? 650 : 560;
    var px = (DW - pw) / 2;
    var py = Math.max(72, (DH - ph) / 2);
    ctx.fillStyle = '#f4f0e4';
    R.roundRect(ctx, px, py, pw, ph, 12); ctx.fill();
    ctx.strokeStyle = '#3a3126'; ctx.lineWidth = 4;
    R.roundRect(ctx, px, py, pw, ph, 12); ctx.stroke();

    R.font(ctx, 42, true);
    ctx.fillStyle = '#8a3a28';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('公网对战大厅', DW / 2, py + 48);
    if (!online.roomId) drawLobbyButton(ctx, 'onlineClose', px + pw - 112, py + 24, 82, 48, '收起', false);

    ctx.textAlign = 'left';
    R.font(ctx, 22, false);
    ctx.fillStyle = '#6a5c42';
    ctx.fillText(compactText(ctx, online.status || (online.connected ? '已连接' : '未连接'), pw - 72), px + 36, py + 92);

    if (!online.user) {
      R.font(ctx, 28, true);
      ctx.fillStyle = '#2c241a';
      ctx.fillText('登录账号后创建房间、保存战绩和恢复历史数据。', px + 36, py + 150);
      drawLobbyButton(ctx, 'onlineLogin', px + 44, py + 220, pw - 88, 68, '登录账号', true);
      drawLobbyButton(ctx, 'onlineRegister', px + 44, py + 312, pw - 88, 68, '注册新账号', false);
      if (online.pendingRoomId) {
        R.font(ctx, 22, true);
        ctx.fillStyle = '#8a3a28';
        ctx.fillText('检测到邀请房间：' + online.pendingRoomId + '，登录后可加入。', px + 44, py + 424);
      }
      ctx.restore();
      return;
    }

    var stats = online.user.stats || { matches: 0, wins: 0, losses: 0, bestWave: 0 };
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    R.roundRect(ctx, px + 34, py + 118, pw - 68, 104, 8); ctx.fill();
    R.font(ctx, 26, true);
    ctx.fillStyle = '#2c241a';
    ctx.fillText(compactText(ctx, online.user.displayName || online.user.username, 250), px + 56, py + 150);
    R.font(ctx, 18, false);
    ctx.fillStyle = '#6a5c42';
    ctx.fillText(compactText(ctx, '账号：' + online.user.username, 260), px + 56, py + 178);
    ctx.fillText('对局 ' + stats.matches + '   胜 ' + stats.wins + '   负 ' + stats.losses + '   最佳第 ' + stats.bestWave + ' 波', px + 56, py + 204);
    drawLobbyButton(ctx, 'onlineRename', px + pw - 238, py + 144, 88, 44, '改名', false);
    drawLobbyButton(ctx, 'onlineLogout', px + pw - 138, py + 144, 88, 44, '退出', false);

    if (!online.roomId) {
      drawLobbyButton(ctx, 'onlineCreate', px + 44, py + 258, pw - 88, 70, '创建房间', true);
      drawLobbyButton(ctx, 'onlineJoin', px + 44, py + 350, pw - 88, 70, '输入房间码加入', false);
      if (online.pendingRoomId) {
        drawLobbyButton(ctx, 'onlineJoinInvite', px + 44, py + 442, pw - 88, 62, '加入邀请：' + online.pendingRoomId, true);
      }
      ctx.restore();
      return;
    }

    R.font(ctx, 21, false);
    ctx.fillStyle = '#6a5c42';
    ctx.fillText('房间码', px + 44, py + 258);
    R.font(ctx, 46, true);
    ctx.fillStyle = '#8a3a28';
    ctx.fillText(online.roomId, px + 44, py + 304);
    drawLobbyButton(ctx, 'onlineCopy', px + pw - 244, py + 256, 198, 60, '复制邀请', true);
    R.font(ctx, 18, false);
    ctx.fillStyle = '#6a5c42';
    ctx.fillText(compactText(ctx, ZY.Online.inviteLink(online.roomId), pw - 88), px + 44, py + 342);

    var players = online.room && Array.isArray(online.room.players) ? online.room.players : [];
    var host = null, guest = null;
    for (var i = 0; i < players.length; i++) {
      if (players[i].playerId === 'a') host = players[i];
      if (players[i].playerId === 'b') guest = players[i];
    }
    var slotW = (pw - 100) / 2;
    drawPlayerSlot(ctx, px + 44, py + 374, slotW, 118, '房主', playerSlotText(host, '等待房主'));
    drawPlayerSlot(ctx, px + 56 + slotW, py + 374, slotW, 118, '挑战者', playerSlotText(guest, '等待对手'));

    var readyLabel = online.ready ? '取消准备' : '我已准备';
    drawLobbyButton(ctx, 'onlineReady', px + 44, py + 532, (pw - 108) / 2, 68, readyLabel, !online.ready);
    drawLobbyButton(ctx, 'onlineLeave', px + 64 + (pw - 108) / 2, py + 532, (pw - 108) / 2, 68, '离开房间', false);
    R.font(ctx, 20, true);
    ctx.fillStyle = online.peerConnected ? '#2f7d42' : '#8a3a28';
    ctx.fillText(online.peerConnected ? '对手在线：' + (online.peerName || '玩家') : '等待对手通过链接或房间码加入', px + 44, py + 628);
    ctx.restore();
  };
  // ---- 开始界面 ----
  UI.drawStart = function (ctx) {
    var DW = A.DW, DH = A.DH;
    var t = ZY.frameTime ? ZY.frameTime() : 0;
    var centerX = DW / 2;
    var emblemY = DH * 0.505;
    var emblemR = Math.min(DW * 0.335, DH * 0.17);

    // 深色夜幕、柔和光晕与画布内装饰，避免依赖 DOM 或外部图片资源。
    ctx.save();
    var bg = ctx.createLinearGradient(0, 0, DW, DH);
    bg.addColorStop(0, '#07151c');
    bg.addColorStop(0.48, '#102b35');
    bg.addColorStop(1, '#07151e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, DW, DH);
    var glow = ctx.createRadialGradient(centerX, emblemY, 8, centerX, emblemY, DW * 0.72);
    glow.addColorStop(0, 'rgba(41,111,116,0.32)');
    glow.addColorStop(0.62, 'rgba(16,43,53,0.14)');
    glow.addColorStop(1, 'rgba(3,10,16,0.55)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, DW, DH);

    for (var dust = 0; dust < 72; dust++) {
      var dx = (dust * 193 + 47) % DW;
      var dy = (dust * 317 + 91) % Math.ceil(DH);
      var pulse = 0.28 + (Math.sin(t * 1.5 + dust) + 1) * 0.2;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = dust % 4 === 0 ? '#f4d77d' : '#d3d8c6';
      ctx.beginPath();
      ctx.arc(dx, dy, dust % 5 === 0 ? 2 : 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 古铜鎏金的双层边框与四角回纹。
    ctx.strokeStyle = 'rgba(191,155,82,0.82)';
    ctx.lineWidth = 3;
    R.roundRect(ctx, 12, 12, DW - 24, DH - 24, 34);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(221,190,119,0.34)';
    ctx.lineWidth = 1;
    R.roundRect(ctx, 22, 22, DW - 44, DH - 44, 28);
    ctx.stroke();
    for (var corner = 0; corner < 4; corner++) {
      ctx.save();
      ctx.translate(corner % 2 ? DW - 36 : 36, corner > 1 ? DH - 36 : 36);
      ctx.rotate((corner > 1 ? Math.PI : 0) + (corner % 2 ? Math.PI / 2 : 0));
      ctx.strokeStyle = 'rgba(213,177,99,0.72)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 25);
      ctx.lineTo(0, 5);
      ctx.quadraticCurveTo(0, 0, 5, 0);
      ctx.lineTo(25, 0);
      ctx.moveTo(5, 0); ctx.lineTo(5, 12); ctx.lineTo(17, 12);
      ctx.stroke();
      ctx.restore();
    }

    // 云纹用低对比度线条点缀两侧，不干扰按钮与游戏文字。
    for (var cloudSide = 0; cloudSide < 2; cloudSide++) {
      var cloudX = cloudSide ? DW - 74 : 74;
      var cloudY = DH * 0.37;
      ctx.strokeStyle = 'rgba(154,184,178,0.18)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cloudX, cloudY, 28, Math.PI * 1.05, Math.PI * 1.95);
      ctx.arc(cloudX + (cloudSide ? -27 : 27), cloudY - 12, 20, Math.PI * 1.1, Math.PI * 1.9);
      ctx.arc(cloudX + (cloudSide ? -55 : 55), cloudY, 28, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cloudX - 54, cloudY + 1);
      ctx.quadraticCurveTo(cloudX, cloudY + 24, cloudX + 54, cloudY + 1);
      ctx.stroke();
    }
    ctx.restore();

    // 顶栏：可交互头像、仙桃余额和当前段位进度。
    ctx.save();
    R.avatar(ctx, 78, 72, 42, UI.currentAvatar(), false);
    UI.buttons.avatar = { x: 34, y: 28, w: 88, h: 88 };
    ctx.fillStyle = 'rgba(9,17,22,0.88)';
    R.roundRect(ctx, 140, 43, 250, 58, 29);
    ctx.fill();
    ctx.strokeStyle = 'rgba(207,175,105,0.72)';
    ctx.lineWidth = 2;
    R.roundRect(ctx, 140, 43, 250, 58, 29);
    ctx.stroke();

    // 仙桃图标。
    ctx.save();
    ctx.translate(174, 70);
    ctx.fillStyle = '#d94835';
    ctx.beginPath();
    ctx.ellipse(-4, 2, 13, 15, -0.4, 0, Math.PI * 2);
    ctx.ellipse(6, 2, 12, 15, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f48155';
    ctx.beginPath();
    ctx.ellipse(-7, -2, 4, 6, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7d9d50';
    ctx.beginPath();
    ctx.ellipse(4, -14, 8, 4, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#f4e8c5';
    R.font(ctx, 30, true);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(A.storageGet('zy_coin') || 0), 215, 72);

    var prog = ZY.Rank.load();
    var progressY = 145;
    var progressX = 102;
    var progressW = DW - 204;
    ctx.strokeStyle = 'rgba(193,159,91,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(68, progressY);
    ctx.lineTo(progressX, progressY);
    ctx.moveTo(progressX + progressW, progressY);
    ctx.lineTo(DW - 68, progressY);
    ctx.stroke();
    ctx.fillStyle = 'rgba(7,15,19,0.8)';
    R.roundRect(ctx, progressX, progressY - 7, progressW, 14, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(202,171,102,0.78)';
    ctx.lineWidth = 2;
    R.roundRect(ctx, progressX, progressY - 7, progressW, 14, 7);
    ctx.stroke();
    var progressRatio = Math.max(0, Math.min(1, (prog.stars || 0) / C.STARS_PER_RANK));
    var fillGrad = ctx.createLinearGradient(progressX, 0, progressX + progressW, 0);
    fillGrad.addColorStop(0, '#a77b31');
    fillGrad.addColorStop(1, '#f0d486');
    ctx.fillStyle = fillGrad;
    if (progressRatio > 0) {
      R.roundRect(ctx, progressX + 3, progressY - 4, (progressW - 6) * progressRatio, 8, 4);
      ctx.fill();
    }
    ctx.fillStyle = '#dfc17a';
    ctx.beginPath();
    ctx.arc(DW / 2, progressY, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#14252a';
    ctx.beginPath();
    ctx.arc(DW / 2, progressY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f0d486';
    R.font(ctx, 17, true);
    ctx.textAlign = 'center';
    ctx.fillText(prog.rankName, DW / 2, progressY + 29);
    ctx.restore();

    // 主标题和副标题：鎏金字配暗色描边，突出参考图的中式题签感。
    ctx.save();
    R.font(ctx, 88, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(49,31,15,0.9)';
    ctx.strokeText('十二生肖', centerX, DH * 0.225);
    var titleGrad = ctx.createLinearGradient(centerX, DH * 0.18, centerX, DH * 0.27);
    titleGrad.addColorStop(0, '#fff0b2');
    titleGrad.addColorStop(0.46, '#e3bb68');
    titleGrad.addColorStop(1, '#a87531');
    ctx.fillStyle = titleGrad;
    ctx.fillText('十二生肖', centerX, DH * 0.225);
    ctx.fillStyle = '#e9d8a5';
    ctx.strokeStyle = 'rgba(194,157,85,0.7)';
    ctx.lineWidth = 1;
    R.font(ctx, 25, true);
    ctx.fillText('— 文字合成塔防 —', centerX, DH * 0.285);
    ctx.restore();

    // 中央生肖阵盘：复用游戏内守将与令牌绘制，保持风格和资产一致。
    ctx.save();
    var ringGlow = ctx.createRadialGradient(centerX, emblemY, 18, centerX, emblemY, emblemR * 1.22);
    ringGlow.addColorStop(0, 'rgba(22,72,77,0.12)');
    ringGlow.addColorStop(0.72, 'rgba(24,72,81,0.42)');
    ringGlow.addColorStop(1, 'rgba(13,33,42,0)');
    ctx.fillStyle = ringGlow;
    ctx.beginPath();
    ctx.arc(centerX, emblemY, emblemR * 1.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(212,174,97,0.72)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, emblemY, emblemR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(200,170,105,0.42)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, emblemY, emblemR * 0.84, 0, Math.PI * 2);
    ctx.stroke();
    for (var tick = 0; tick < 48; tick++) {
      var tickAngle = tick / 48 * Math.PI * 2;
      var tickInner = emblemR * (tick % 4 === 0 ? 0.91 : 0.95);
      ctx.strokeStyle = tick % 4 === 0 ? 'rgba(234,202,126,0.86)' : 'rgba(190,161,100,0.52)';
      ctx.lineWidth = tick % 4 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(centerX + Math.cos(tickAngle) * tickInner, emblemY + Math.sin(tickAngle) * tickInner);
      ctx.lineTo(centerX + Math.cos(tickAngle) * emblemR, emblemY + Math.sin(tickAngle) * emblemR);
      ctx.stroke();
    }

    var ornamentPhase = R.ornament(ctx, centerX, emblemY, emblemR * 0.58, t);
    R.monk(ctx, centerX, emblemY, Math.min(148, emblemR * 0.72), 0, 3, false, t, ornamentPhase);

    var zodiac = [
      ['子鼠', 0.02], ['丑牛', 0.98], ['寅虎', 2.02],
      ['卯兔', 2.98], ['辰龙', 4.02], ['巳蛇', 4.98]
    ];
    for (var zi = 0; zi < zodiac.length; zi++) {
      var zAngle = zodiac[zi][1] - Math.PI / 2;
      var tokenX = centerX + Math.cos(zAngle) * emblemR * 0.78;
      var tokenY = emblemY + Math.sin(zAngle) * emblemR * 0.78;
      var tokenR = 29;
      ctx.fillStyle = zi % 2 === 0 ? '#173d48' : '#76572a';
      ctx.beginPath();
      ctx.arc(tokenX, tokenY, tokenR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = zi % 2 === 0 ? '#d5bd7c' : '#f0d080';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(tokenX, tokenY, tokenR - 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fff0ca';
      R.font(ctx, 17, true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(zodiac[zi][0], tokenX, tokenY);
    }
    ctx.restore();

    // 主入口与副入口按参考图做玉石绿、深色金边按钮。
    function jadeButton(button, primary) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      R.roundRect(ctx, button.x, button.y + 7, button.w, button.h, 18);
      ctx.fill();
      var buttonGrad = ctx.createLinearGradient(0, button.y, 0, button.y + button.h);
      if (primary) {
        buttonGrad.addColorStop(0, '#c7d9ae');
        buttonGrad.addColorStop(0.45, '#76977d');
        buttonGrad.addColorStop(1, '#385c56');
      } else {
        buttonGrad.addColorStop(0, '#31434a');
        buttonGrad.addColorStop(1, '#17282f');
      }
      ctx.fillStyle = buttonGrad;
      R.roundRect(ctx, button.x, button.y, button.w, button.h, 18);
      ctx.fill();
      ctx.strokeStyle = primary ? '#dfca8c' : '#a88c55';
      ctx.lineWidth = 3;
      R.roundRect(ctx, button.x + 2, button.y + 2, button.w - 4, button.h - 4, 16);
      ctx.stroke();
      ctx.strokeStyle = primary ? 'rgba(238,239,211,0.52)' : 'rgba(213,188,132,0.32)';
      ctx.lineWidth = 1;
      R.roundRect(ctx, button.x + 8, button.y + 8, button.w - 16, button.h - 16, 12);
      ctx.stroke();
      R.font(ctx, button.fs, true);
      ctx.fillStyle = primary ? '#fff2cf' : '#e6d6b5';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(button.label, button.x + button.w / 2, button.y + button.h / 2 - 1);
      ctx.restore();
    }

    var mainButtonW = Math.min(390, DW - 96);
    UI.buttons.start = {
      x: (DW - mainButtonW) / 2, y: DH * 0.755,
      w: mainButtonW, h: 82, label: '单人闯关', fs: 38
    };
    jadeButton(UI.buttons.start, true);
    UI.buttons.online = {
      x: (DW - mainButtonW) / 2, y: DH * 0.835,
      w: mainButtonW, h: 72, label: '公网大厅', fs: 32
    };
    jadeButton(UI.buttons.online, false);

    var bestWave = parseInt(A.storageGet('zy_best') || '0', 10);
    var status = '';
    if (ZY.Online) {
      var online = ZY.Online.state();
      if (!online.lobbyOpen && (online.status || online.roomId)) {
        status = online.roomId ? ('房间 ' + online.roomId + ' · ' + online.status) : online.status;
      }
    }
    if (bestWave > 0 || status) {
      ctx.save();
      R.font(ctx, 20, false);
      ctx.fillStyle = 'rgba(232,218,183,0.8)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var footer = bestWave > 0 ? '最佳战绩：第 ' + bestWave + ' 波' : '';
      if (status) footer += (footer ? '　·　' : '') + status;
      ctx.fillText(compactText(ctx, footer, DW - 100), centerX, DH * 0.918);
      ctx.restore();
    }

    // 兵器库入口保持原有兑换和点击逻辑。
    var weaponUnlocked = ZY.Weapon && ZY.Weapon.isLibraryUnlocked && ZY.Weapon.isLibraryUnlocked();
    UI.buttons.weaponLib = {
      x: DW - 238, y: DH - 90, w: 202, h: 58,
      label: weaponUnlocked ? '兵器库' : '兑换兵器', fs: 24
    };
    jadeButton(UI.buttons.weaponLib, true);

    if (ZY.Online && ZY.Online.state && ZY.Online.state().lobbyOpen) UI.drawOnlineLobby(ctx);
    drawToasts(ctx);
    // 头像选择弹窗（覆盖在最上层）
    if (UI.avatarPickerOpen) UI.drawAvatarPicker(ctx);
  };

  // 头像选择弹窗：5个人物头像横排，点击切换头像
  UI.drawAvatarPicker = function (ctx) {
    var DW = A.DW, DH = A.DH;
    ctx.save();
    // 半透明遮罩
    ctx.fillStyle = 'rgba(30,26,20,0.7)';
    ctx.fillRect(0, 0, DW, DH);
    // 弹窗面板
    var n = C.AVATARS.length, ar = 60, gap = 28;
    var gridW = n * (ar * 2) + (n - 1) * gap;
    var pw = gridW + 80, ph = 320;
    var px = (DW - pw) / 2, py = (DH - ph) / 2;
    ctx.fillStyle = '#f4f0e4';
    R.roundRect(ctx, px, py, pw, ph, 16);
    ctx.fill();
    ctx.strokeStyle = '#3a3126';
    ctx.lineWidth = 5;
    R.roundRect(ctx, px, py, pw, ph, 16);
    ctx.stroke();
    // 标题
    R.font(ctx, 36, true);
    ctx.fillStyle = '#5a4a34';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('选择头像', DW / 2, py + 48);
    // 5 个人物头像横排
    var startX = (DW - gridW) / 2 + ar;
    var cy = py + 160;
    var cur = UI.currentAvatar();
    UI.avatarButtons = [];
    for (var i = 0; i < n; i++) {
      var cx = startX + i * (ar * 2 + gap);
      var sel = (C.AVATARS[i] === cur);
      R.avatar(ctx, cx, cy, ar, C.AVATARS[i], sel);
      // 名称标签
      R.font(ctx, 24, true);
      ctx.fillStyle = sel ? '#b8860b' : '#6a5c42';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(C.AVATAR_LABELS[C.AVATARS[i]], cx, cy + ar + 24);
      UI.avatarButtons.push({ x: cx - ar, y: cy - ar, w: ar * 2, h: ar * 2, ch: C.AVATARS[i] });
    }
    ctx.restore();
  };

  // ---- 对局 HUD ----
  UI.drawHUD = function (ctx) {
    var G = ZY.G, L = ZY.L, DW = A.DW;
    var online = ZY.Online && ZY.Online.isActive && ZY.Online.isActive() ? ZY.Online.state() : null;

    // 暂停墨团
    ctx.save();
    ctx.fillStyle = 'rgba(40,34,26,0.9)';
    ctx.beginPath();
    ctx.ellipse(66, 48, 34, 26, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2ead2';
    ctx.fillRect(56, 36, 7, 24);
    ctx.fillRect(70, 36, 7, 24);
    ctx.restore();
    UI.buttons.pause = { x: 30, y: 20, w: 74, h: 58 };

    // 仙桃计数
    ctx.save();
    ctx.strokeStyle = 'rgba(40,34,26,0.9)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(44, 100);
    ctx.quadraticCurveTo(110, 92, 190, 100);
    ctx.stroke();
    R.bun(ctx, 70, 96, 22);
    R.font(ctx, 34, true);
    ctx.fillStyle = '#28221a';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(G.p.mantou), 104, 98);
    ctx.restore();

    if (online) {
      ctx.save();
      ctx.fillStyle = 'rgba(50,40,28,0.72)';
      var roomBadgeX = DW - 294;
      R.roundRect(ctx, roomBadgeX, 78, 216, 36, 8);
      ctx.fill();
      R.font(ctx, 18, true);
      ctx.fillStyle = '#f2ead2';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var myName = online.user ? (online.user.displayName || online.user.username) : '玩家';
      ctx.fillText(compactText(ctx, '房间 ' + online.roomId + ' · ' + myName, 194), roomBadgeX + 108, 96);
      ctx.restore();
    }

    // 关卡名 + 波次
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    R.font(ctx, 44, true);
    ctx.fillStyle = '#8a3a28';
    ctx.fillText(C.LEVEL_NAME, DW / 2, 44);
    ctx.fillStyle = 'rgba(40,34,26,0.88)';
    R.roundRect(ctx, DW / 2 - 66, 66, 132, 40, 8);
    ctx.fill();
    ctx.fillStyle = '#f2ead2';
    R.font(ctx, 26, true);
    ctx.fillText('第' + Math.max(1, G.wave) + '波', DW / 2, 87);
    ctx.restore();

    if (online) {
      ctx.save();
      R.font(ctx, 20, true);
      ctx.fillStyle = online.peerConnected ? '#2f7d42' : '#8a3a28';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var peer = G.onlinePeer || {};
      var peerName = online.peerName || peer.name || '对手';
      var hearts = Number.isFinite(peer.hearts) ? peer.hearts : '-';
      var wave = Math.max(1, peer.wave || 1);
      var peerText = peerName + ' · 第' + wave + '波 · ' + hearts + '心 · ' + (online.peerConnected ? '在线' : '离线');
      ctx.fillText(compactText(ctx, peerText, 420), DW / 2, 116);
      ctx.restore();
    }

    // 音效开关
    ctx.save();
    R.font(ctx, 30, true);
    ctx.fillStyle = 'rgba(40,34,26,0.8)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ZY.sfxEnabled() ? '♪' : '×', DW - 46, 46);
    ctx.restore();
    UI.buttons.sound = { x: DW - 76, y: 20, w: 60, h: 52 };

    // 波次间隔提示
    if (G.waveState === 'idle' || G.waveState === 'cleared') {
      ctx.save();
      R.font(ctx, 28, true);
      ctx.fillStyle = 'rgba(90,50,36,0.8)';
      ctx.textAlign = 'center';
      ctx.fillText('敌军将至 ' + Math.max(0, G.restTimer).toFixed(1) + 's', DW / 2, L.mapY + L.cell * 5);
      ctx.restore();
    }

    // 备战席
    ctx.save();
    R.hut(ctx, L.benchX - 62, L.benchY + 6, 74);
    for (var i = 0; i < C.ECON.benchSize; i++) {
      var p = ZY.Board.benchSlotCenter(i);
      ctx.fillStyle = '#f4f0e4';
      R.roundRect(ctx, p.x - L.benchSlot / 2, p.y - L.benchSlot / 2, L.benchSlot, L.benchSlot, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(130,118,96,0.8)';
      ctx.lineWidth = 2;
      R.roundRect(ctx, p.x - L.benchSlot / 2, p.y - L.benchSlot / 2, L.benchSlot, L.benchSlot, 8);
      ctx.stroke();
      var u = G.p.bench[i];
      var dg = ZY.Board.dragging();
      if (u && !(dg && dg.moved && dg.from.type === 'bench' && dg.from.idx === i)) {
        ZY.Board.drawUnit(ctx, u, p.x, p.y, L.benchSlot - 10, 1);
      }
    }
    ctx.restore();

    // 征兵按钮
    var rb = UI.buttons.recruit = {
      x: DW / 2 - 140, y: L.btnY, w: 280, h: 96,
      label: '征兵', fs: 40, bun: ZY.Board.recruitCost(G.p)
    };
    rb.disabled = G.p.mantou < rb.bun;
    R.redButton(ctx, rb);

    drawToasts(ctx);

    // 拖拽幽灵（画在 y-40，放置判定也用 y-40，保持一致）
    var d = ZY.Board.dragging();
    if (d && d.moved) {
      ZY.Board.drawUnit(ctx, d.unit, d.x, d.y - 40, L.cell + 10, 0.92);
      // 拖铲子时高亮所有可铲 block 格（玩家侧所有绿格）
      if (d.unit.kind === 'shovel') {
        for (var uc = 0; uc < ZY.Map.COLS; uc++) {
          for (var ur = 0; ur < ZY.Map.ROWS; ur++) {
            if (ZY.Map.isUnlockable(uc, ur, 'p')) {
              var upc = ZY.Map.cellCenter(uc, ur);
              ctx.save();
              ctx.strokeStyle = '#c9922e';
              ctx.lineWidth = 3;
              ctx.setLineDash([6, 4]);
              R.roundRect(ctx, upc.x - L.cell / 2 + 2, upc.y - L.cell / 2 + 2, L.cell - 4, L.cell - 4, 8);
              ctx.stroke();
              ctx.setLineDash([]);
              ctx.restore();
            }
          }
        }
      } else {
        // 普通单位：高亮可放置格（用 buildCellAt 与放置判定一致）
        var cell = ZY.Map.buildCellAt(d.x, d.y - 40, 'p');
        if (cell) {
          var k = cell.c + '_' + cell.r;
          var t = G.p.units[k];
          var ok = !t || ZY.Board.tryMerge(d.unit, t) ||
            (t.kind !== 'g' || t.half == null);
          var pc = ZY.Map.cellCenter(cell.c, cell.r);
          ctx.save();
          ctx.strokeStyle = ok ? '#c9922e' : 'rgba(160,60,40,0.8)';
          ctx.lineWidth = 4;
          R.roundRect(ctx, pc.x - L.cell / 2 + 2, pc.y - L.cell / 2 + 2, L.cell - 4, L.cell - 4, 8);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  };

  // ---- 结算 ----
  UI.drawOver = function (ctx, win) {
    var G = ZY.G, DW = A.DW, DH = A.DH;
    ctx.save();
    ctx.fillStyle = win ? 'rgba(214,205,182,0.96)' : 'rgba(176,186,196,0.96)';
    ctx.fillRect(0, 0, DW, DH);

    // 乌云/彩云横幅
    R.cloud(ctx, DW / 2, DH * 0.16, 340, 90, win ? '#b08a3e' : '#5a6068');
    R.font(ctx, 60, true);
    ctx.fillStyle = '#f5f0e2';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(G.online ? (win ? '对战胜利' : '对战失败') : (win ? '胜利' : '失败'), DW / 2, DH * 0.16);

    // 卷轴 + 段位星级
    R.scroll(ctx, DW / 2, DH * 0.32, 400, 110);
    var prog = ZY.Rank.load();
    R.font(ctx, 30, true);
    ctx.fillStyle = '#e8dfc8';
    var maxed = ZY.Rank.isMaxed(prog);
    ctx.fillText(prog.rankName + (maxed ? '' : ' · ' + prog.stars + '/' + C.STARS_PER_RANK), DW / 2, DH * 0.32 - 26);
    var starShow = prog.stars;
    for (var i = 0; i < C.STARS_PER_RANK; i++) {
      R.star(ctx, DW / 2 - 128 + i * 64, DH * 0.32 + 18, 24, i < starShow);
    }
    // 晋升提示
    if (win && G.rankPromote && G.rankPromote.promoted) {
      ctx.fillStyle = '#e8c53a';
      R.font(ctx, 28, true);
      ctx.fillText('晋升！' + G.rankPromote.newRankName, DW / 2, DH * 0.32 + 56);
    }

    // 守将与妖群
    var ay = DH * 0.5;
    ctx.fillStyle = 'rgba(200,200,205,0.6)';
    ctx.beginPath();
    ctx.ellipse(DW / 2, ay + 20, 220, 70, 0, 0, Math.PI * 2);
    ctx.fill();
    R.adou(ctx, DW / 2, ay, 84, Math.max(0, G.p.hearts), C.ECON.hearts, !win);
    if (!win) {
      var zs = [[-150, -20], [-90, 40], [90, 40], [150, -16], [0, 66]];
      for (var z = 0; z < zs.length; z++) {
        R.mahjong(ctx, DW / 2 + zs[z][0], ay + zs[z][1], 52, '狸', { enemy: true });
      }
    }

    // 战利品
    R.bun(ctx, DW / 2 - 40, DH * 0.63, 24);
    ctx.fillStyle = '#3a3126';
    R.font(ctx, 40, true);
    ctx.textAlign = 'left';
    ctx.fillText('X' + G.coinReward, DW / 2 - 4, DH * 0.63 + 2);
    if (G.online) {
      R.font(ctx, 24, true);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#6a5c42';
      ctx.fillText('公网对战 · 第 ' + Math.max(1, G.wave || 1) + ' 波', DW / 2, DH * 0.66);
    }
    ctx.restore();

    UI.buttons.again = { x: DW / 2 - 180, y: DH * 0.70, w: 360, h: 92, label: '再 战', fs: 38 };
    R.redButton(ctx, UI.buttons.again);
    UI.buttons.claim = { x: DW / 2 - 150, y: DH * 0.70 + 116, w: 300, h: 80, label: '领 取', fs: 32 };
    R.darkButton(ctx, UI.buttons.claim);
    ctx.restore();
  };

  // ---- 暂停 ----
  UI.drawPause = function (ctx) {
    var DW = A.DW, DH = A.DH;
    ctx.save();
    ctx.fillStyle = 'rgba(30,26,20,0.6)';
    ctx.fillRect(0, 0, DW, DH);
    R.font(ctx, 56, true);
    ctx.fillStyle = '#f2ead2';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('暂停中', DW / 2, DH * 0.4);
    ctx.restore();
    UI.buttons.resume = { x: DW / 2 - 160, y: DH * 0.5, w: 320, h: 96, label: '继续', fs: 40 };
    R.redButton(ctx, UI.buttons.resume);
    var inOnline = !!(ZY.G && ZY.G.online);
    UI.buttons.home = { x: DW / 2 - 160, y: DH * 0.5 + 120, w: 320, h: 96, label: inOnline ? '投 降' : '返回首页', fs: 40 };
    R.darkButton(ctx, UI.buttons.home);
  };

  UI.drawOnlineWait = function (ctx) {
    var DW = A.DW, DH = A.DH;
    ctx.save();
    ctx.fillStyle = 'rgba(30,26,20,0.58)';
    ctx.fillRect(0, 0, DW, DH);
    ctx.fillStyle = '#f2ead2';
    R.font(ctx, 44, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('等待对手结算', DW / 2, DH * 0.44);
    R.font(ctx, 24, false);
    ctx.fillText('对手完成后自动判定胜负', DW / 2, DH * 0.44 + 52);
    ctx.restore();
  };

  // ============ 武器库 ============
  // 武器库界面：顶部生肖武将装备槽 + 中间4品质武器列表 + 拖拽穿戴
  UI.weaponSlots = [];      // 角色装备槽区域 [{x,y,w,h,name}]
  UI.weaponItems = [];      // 武器列表项区域 [{x,y,w,h,wid,kind:'owned'|'frag'}]
  UI.weaponCraftBtns = [];  // 可合成武器的合成按钮 [{x,y,w,h,wid}]
  UI.weaponDrag = null;     // 拖拽中的武器 {wid,x,y}
  UI.weaponScroll = 0;      // 列表滚动偏移（暂未实现滚动，预留）

  UI.drawWeaponLib = function (ctx) {
    var DW = A.DW, DH = A.DH;
    var W = ZY.Weapon, C2 = C;
    R.paper(ctx, DW, DH);

    // 顶部标题 + 返回
    ctx.save();
    R.font(ctx, 48, true);
    ctx.fillStyle = '#8a3a28';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('兵器库', DW / 2, 60);
    ctx.restore();
    UI.buttons.wlibBack = { x: 20, y: 28, w: 110, h: 56, label: '返回', fs: 28 };
    R.darkButton(ctx, UI.buttons.wlibBack);
    UI.buttons.wlibRedeem = { x: DW - 164, y: 28, w: 132, h: 56, label: '兑换码', fs: 26 };
    R.redButton(ctx, UI.buttons.wlibRedeem);

    // ===== 顶部生肖武将装备槽 =====
    UI.weaponSlots = [];
    var slotCount = C2.GENERAL_NAMES.length;
    var slotW = slotCount > 5 ? 100 : 108, slotH = 130, slotGap = 12;
    var slotsW = slotCount * slotW + (slotCount - 1) * slotGap;
    var slotStartX = (DW - slotsW) / 2;
    var slotY = 110;
    ctx.save();
    R.font(ctx, 24, true);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var i = 0; i < C2.GENERAL_NAMES.length; i++) {
      var name = C2.GENERAL_NAMES[i];
      var sx = slotStartX + i * (slotW + slotGap);
      // 槽位底框
      ctx.fillStyle = 'rgba(60,50,40,0.12)';
      R.roundRect(ctx, sx, slotY, slotW, slotH, 10); ctx.fill();
      ctx.strokeStyle = '#8a6a40'; ctx.lineWidth = 2;
      R.roundRect(ctx, sx, slotY, slotW, slotH, 10); ctx.stroke();
      // 角色名
      ctx.fillStyle = '#5a4a30';
      R.font(ctx, 26, true);
      ctx.fillText(name, sx + slotW / 2, slotY + 22);
      // 当前装备的武器
      var eq = W.equipped(name);
      if (eq) {
        var qCfg = C2.WEAPON_QUALITY[eq.quality];
        // 武器图标方块
        ctx.fillStyle = qCfg.color;
        R.roundRect(ctx, sx + 14, slotY + 42, slotW - 28, 40, 6); ctx.fill();
        ctx.fillStyle = '#fff';
        R.font(ctx, 20, true);
        ctx.fillText(eq.name, sx + slotW / 2, slotY + 62);
        // 加成
        ctx.fillStyle = '#6a5c42';
        R.font(ctx, 18, false);
        ctx.fillText('+' + eq.dmg + ' 攻击', sx + slotW / 2, slotY + 100);
        // 卸下提示
        ctx.fillStyle = '#a04848';
        R.font(ctx, 16, false);
        ctx.fillText('点击卸下', sx + slotW / 2, slotY + 118);
      } else {
        ctx.fillStyle = '#9a8a70';
        R.font(ctx, 18, false);
        ctx.fillText('未装备', sx + slotW / 2, slotY + 70);
        ctx.fillText('拖武器到此', sx + slotW / 2, slotY + 100);
      }
      UI.weaponSlots.push({ x: sx, y: slotY, w: slotW, h: slotH, name: name });
    }
    ctx.restore();

    // ===== 中间武器列表（按品质分组） =====
    UI.weaponItems = [];
    UI.weaponCraftBtns = [];
    var listY = slotY + slotH + 24;
    var itemW = 160, itemH = 90, itemGap = 10;
    var perRow = Math.floor((DW - 32) / (itemW + itemGap));
    var rowY = listY;

    ctx.save();
    C2.WEAPON_QUALITY_ORDER.forEach(function (qkey) {
      var qCfg = C2.WEAPON_QUALITY[qkey];
      // 品质标题
      ctx.fillStyle = qCfg.color;
      R.font(ctx, 28, true);
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('● ' + qCfg.name + '（' + (qCfg.fragNeed > 0 ? qCfg.fragNeed + '碎片合成' : '成品掉落') + ' · 掉率' + (qCfg.drop * 100) + '%）', 24, rowY + 14);
      rowY += 34;
      // 该品质所有武器
      var pool = C2.WEAPONS.filter(function (w) { return w.quality === qkey; });
      var col = 0;
      for (var wi = 0; wi < pool.length; wi++) {
        var wp = pool[wi];
        var owns = W.owns(wp.id);
        var fragN = W.fragCount(wp.id);
        var need = qCfg.fragNeed;
        var x = 24 + col * (itemW + itemGap);
        var y = rowY;
        // 卡片底
        if (owns) {
          ctx.fillStyle = qCfg.color;
        } else if (need > 0 && fragN > 0) {
          ctx.fillStyle = 'rgba(120,110,90,0.25)';
        } else {
          ctx.fillStyle = 'rgba(120,110,90,0.12)';
        }
        R.roundRect(ctx, x, y, itemW, itemH, 8); ctx.fill();
        ctx.strokeStyle = owns ? qCfg.color : 'rgba(80,70,60,0.4)';
        ctx.lineWidth = owns ? 2 : 1;
        R.roundRect(ctx, x, y, itemW, itemH, 8); ctx.stroke();
        // 名称
        ctx.fillStyle = owns ? '#fff' : (fragN > 0 ? '#5a4a30' : '#9a8a70');
        R.font(ctx, 22, true);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(wp.name, x + itemW / 2, y + 24);
        // owner 限定标识
        if (wp.owner) {
          ctx.fillStyle = owns ? '#fff' : '#9a8a70';
          R.font(ctx, 16, false);
          ctx.fillText('【' + wp.owner + '专属】', x + itemW / 2, y + 46);
        }
        // 状态/碎片进度
        if (owns) {
          ctx.fillStyle = '#fff';
          R.font(ctx, 18, true);
          ctx.fillText('+' + wp.dmg + ' 攻', x + itemW / 2, y + 70);
          UI.weaponItems.push({ x: x, y: y, w: itemW, h: itemH, wid: wp.id, kind: 'owned' });
        } else if (need > 0) {
          ctx.fillStyle = fragN > 0 ? '#5a4a30' : '#9a8a70';
          R.font(ctx, 18, false);
          ctx.fillText(fragN + '/' + need + ' 碎片', x + itemW / 2, y + 70);
          // 可合成：合成按钮
          if (fragN >= need) {
            var cbX = x + itemW / 2 - 40, cbY = y + itemH - 8;
            UI.weaponCraftBtns.push({ x: cbX, y: cbY - 26, w: 80, h: 24, wid: wp.id });
          }
        } else {
          ctx.fillStyle = '#9a8a70';
          R.font(ctx, 16, false);
          ctx.fillText('未拥有', x + itemW / 2, y + 70);
        }
        col++;
        if (col >= perRow) { col = 0; rowY += itemH + 12; }
      }
      if (col > 0) rowY += itemH + 12;
      rowY += 8;
    });
    ctx.restore();

    // 合成按钮（画在最后，确保在最上层）
    ctx.save();
    UI.weaponCraftBtns.forEach(function (cb) {
      ctx.fillStyle = '#e8a23a';
      R.roundRect(ctx, cb.x, cb.y, cb.w, cb.h, 6); ctx.fill();
      ctx.fillStyle = '#fff';
      R.font(ctx, 18, true);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('合成', cb.x + cb.w / 2, cb.y + cb.h / 2);
    });
    ctx.restore();

    // 拖拽中的武器幽灵
    if (UI.weaponDrag) {
      var wd = C2.WEAPON_MAP[UI.weaponDrag.wid];
      var qC = C2.WEAPON_QUALITY[wd.quality];
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = qC.color;
      R.roundRect(ctx, UI.weaponDrag.x - 50, UI.weaponDrag.y - 22, 100, 44, 8); ctx.fill();
      ctx.fillStyle = '#fff';
      R.font(ctx, 20, true);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(wd.name, UI.weaponDrag.x, UI.weaponDrag.y);
      ctx.restore();
    }

    drawToasts(ctx);
  };

  ZY.UI = UI;
})();
