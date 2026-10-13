// 渲染：青绿+鎏金生肖年画风、玉佩令牌字块、红色菱形「福」守将、仙桃经济
(function () {
  var root = (typeof GameGlobal !== 'undefined') ? GameGlobal
    : (typeof globalThis !== 'undefined') ? globalThis
    : (typeof window !== 'undefined') ? window
    : (typeof self !== 'undefined') ? self : {};
  var ZY = root.ZY = root.ZY || {};
  var A = null;
  function getA() { return A || (A = ZY.adapter); }

  var R = {};
  var FONT = '"Kaiti SC", "STKaiti", "KaiTi", "SimKai", serif';
  R.FONT = FONT;
  R.font = function (ctx, size, bold) {
    ctx.font = (bold ? 'bold ' : '') + size + 'px ' + FONT;
  };

  R.roundRect = function (ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // 伪随机（稳定装饰）
  function srand(seed) {
    return function () {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  // ---- 页面背景：暖米色 + 水墨远山 + 飞鸟小鹿（按地图主题调色）----
  var bgCache = null;
  R.paper = function (ctx, w, h) {
    var th = R.theme();
    var bgCol = th.bg || '#dcebdc';
    if (!bgCache || bgCache.width !== Math.ceil(w) || bgCache._h !== Math.ceil(h) || bgCache._theme !== bgCol) {
      var c = getA().createOffCanvas(Math.ceil(w), Math.ceil(h));
      if (!c) return;
      c._h = Math.ceil(h);
      c._theme = bgCol;
      var g = c.getContext('2d');
      var rnd = srand(7);
      g.fillStyle = bgCol;
      g.fillRect(0, 0, w, h);
      // 年画洒金纸纹
      g.globalAlpha = 0.06;
      for (var i = 0; i < 700; i++) {
        g.fillStyle = rnd() > 0.5 ? '#7fae8a' : '#f6f0d8';
        g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 4, 1 + rnd() * 2);
      }
      g.globalAlpha = 1;
      // 远山（顶部两层，青绿淡墨）
      mountains(g, w, 96, 60, 'rgba(96,140,112,0.30)', 3);
      mountains(g, w, 118, 42, 'rgba(140,170,140,0.24)', 5);
      // 底部山影
      g.save();
      g.translate(w, h);
      g.rotate(Math.PI);
      mountains(g, w, 60, 40, 'rgba(110,148,122,0.22)', 4);
      g.restore();
      // 祥云纹（年画底纹）
      var cloudPos = [
        [w * 0.16, 42], [w * 0.5, 30], [w * 0.84, 50],
        [w * 0.28, h - 46], [w * 0.7, h - 60]
      ];
      for (var cpc = 0; cpc < cloudPos.length; cpc++) {
        cloud(g, cloudPos[cpc][0], cloudPos[cpc][1], 30 + (cpc % 3) * 10, 'rgba(180,150,70,0.20)');
      }
      // 生肖剪纸环（淡金圆形剪纸点缀）
      g.save();
      g.globalAlpha = 0.10;
      g.strokeStyle = '#b8860b';
      g.lineWidth = 3;
      var ringX = w / 2, ringY = h / 2, ringR = Math.min(w, h) * 0.44;
      for (var zr = 0; zr < 12; zr++) {
        var za = zr / 12 * Math.PI * 2;
        var zx = ringX + Math.cos(za) * ringR, zy = ringY + Math.sin(za) * ringR;
        g.beginPath();
        g.arc(zx, zy, 16, 0, Math.PI * 2);
        g.stroke();
        g.beginPath();
        g.arc(zx, zy, 8, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
      // 金点洒痕
      g.fillStyle = 'rgba(180,150,70,0.14)';
      for (var d = 0; d < 26; d++) {
        g.beginPath();
        g.arc(rnd() * w, rnd() * h, 2 + rnd() * 4, 0, Math.PI * 2);
        g.fill();
      }
      bgCache = c;
    }
    ctx.drawImage(bgCache, 0, 0, w, h);

    function mountains(g, w, baseY, amp, color, humps) {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, baseY);
      for (var x = 0; x <= w; x += 8) {
        g.lineTo(x, baseY - Math.abs(Math.sin(x / w * Math.PI * humps)) * amp - Math.sin(x * 0.05) * 6);
      }
      g.lineTo(w, 0); g.lineTo(0, 0);
      g.closePath(); g.fill();
    }
    // 祥云：如意云头的简化画法（螺旋卷 + 弧底）
    function cloud(g, x, y, s, color) {
      g.strokeStyle = color;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(x, y, s * 0.42, Math.PI * 0.9, Math.PI * 2.1);
      g.stroke();
      g.beginPath();
      g.arc(x - s * 0.5, y + s * 0.1, s * 0.26, Math.PI * 1.1, Math.PI * 2.3);
      g.stroke();
      g.beginPath();
      g.arc(x + s * 0.5, y + s * 0.1, s * 0.26, Math.PI * 0.7, Math.PI * 1.9);
      g.stroke();
      g.beginPath();
      g.moveTo(x - s * 1.05, y + s * 0.1);
      g.quadraticCurveTo(x, y + s * 0.95, x + s * 1.05, y + s * 0.1);
      g.stroke();
    }
  };

  // 默认主题（兜底，当 Map.theme 未定义时使用）
  var DEFAULT_THEME = { bg: '#dcebdc', grass: '#8fb894', grassDark: '#4f7a58', path: '#b6a28e', pathDark: '#78624e', frame: '#2f4a34', edge: 'pen' };
  R.theme = function () { return (ZY.Map && ZY.Map.theme) || DEFAULT_THEME; };

  // ---- 地砖 ----
  R.tileGreen = function (ctx, x, y, s, seed) {
    ctx.save();
    var rnd = srand(seed);
    var th = R.theme();
    ctx.fillStyle = th.grass;
    ctx.fillRect(x, y, s, s);
    // 立体下边（深色）
    ctx.fillStyle = th.grassDark;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x, y + s - 4, s, 4);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x, y, s, 2);
    // 装饰纹理（按主题 edge 类型）
    ctx.fillStyle = th.grassDark;
    ctx.globalAlpha = 0.35;
    var edge = th.edge;
    for (var i = 0; i < 3; i++) {
      var px = x + rnd() * s, py = y + rnd() * s;
      if (edge === 'hole') {
        // 鼠洞：泥地碎土与爪痕
        ctx.strokeStyle = th.pathDark;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(px - 4, py);
        ctx.lineTo(px + 4, py + (rnd() - 0.5) * 6);
        ctx.stroke();
      } else if (edge === 'pen') {
        // 牛栏：青草短簇
        ctx.strokeStyle = '#4f7a3a';
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.2;
        for (var pen = 0; pen < 3; pen++) {
          ctx.beginPath();
          ctx.moveTo(px + pen * 2 - 2, py);
          ctx.lineTo(px + pen * 2 - 2 + (rnd() - 0.5) * 3, py - 3 - rnd() * 3);
          ctx.stroke();
        }
      } else if (edge === 'den') {
        // 虎穴：岩斑碎石
        ctx.beginPath();
        ctx.arc(px, py, 1 + rnd() * 2.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (edge === 'burrow') {
        // 兔窝：月白绒毛小点
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(px, py, 2 + rnd() * 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (edge === 'palace') {
        // 龙宫：水波涟漪与气泡
        ctx.strokeStyle = 'rgba(200,230,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(px, py, 2 + rnd() * 4, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // 默认：苔斑
        ctx.beginPath();
        ctx.arc(px, py, 2 + rnd() * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = th.grassDark;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
    ctx.restore();
  };

  R.tilePath = function (ctx, x, y, s, seed) {
    ctx.save();
    var rnd = srand(seed);
    var th = R.theme();
    ctx.fillStyle = th.path;
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = th.pathDark;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x, y + s - 3, s, 3);
    ctx.globalAlpha = 1;
    // 路面装饰（按主题）
    var edge = th.edge;
    if (edge === 'hole') {
      // 鼠洞：路面碎土与小爪印
      ctx.fillStyle = th.pathDark;
      for (var i = 0; i < 4; i++) {
        ctx.globalAlpha = 0.4 + rnd() * 0.3;
        ctx.beginPath();
        ctx.arc(x + rnd() * s, y + rnd() * s, 1 + rnd() * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (edge === 'pen') {
      // 牛栏：干草与蹄印
      ctx.strokeStyle = '#8a7a3a';
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1.5;
      for (var pj = 0; pj < 3; pj++) {
        ctx.beginPath();
        ctx.moveTo(x + rnd() * s, y + rnd() * s);
        ctx.lineTo(x + rnd() * s, y + rnd() * s);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (edge === 'palace') {
      // 龙宫：水面反光
      ctx.strokeStyle = 'rgba(200,230,255,0.45)';
      ctx.lineWidth = 1;
      for (var j = 0; j < 3; j++) {
        ctx.beginPath();
        ctx.moveTo(x + rnd() * s, y + rnd() * s);
        ctx.lineTo(x + rnd() * s, y + rnd() * s);
        ctx.stroke();
      }
    } else if (edge === 'burrow') {
      // 兔窝：路面月白足迹
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (var k = 0; k < 3; k++) {
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(x + rnd() * s, y + rnd() * s, 1.5 + rnd() * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      // 默认 + 虎穴：碎石点
      ctx.fillStyle = th.pathDark;
      ctx.globalAlpha = 0.4;
      for (var m = 0; m < 4; m++) {
        ctx.beginPath();
        ctx.arc(x + rnd() * s, y + rnd() * s, 1.5 + rnd() * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  };

  R.tileWhite = function (ctx, x, y, s) {
    ctx.fillStyle = '#f2eee2';
    ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
    ctx.fillStyle = 'rgba(180,170,148,0.6)';
    ctx.fillRect(x + 2, y + s - 6, s - 4, 4);
    ctx.strokeStyle = 'rgba(150,140,120,0.7)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 2.5, y + 2.5, s - 5, s - 5);
  };

  // 路缘装饰：按主题切换尖石/火苗/沙丘/水沫/花瓣
  R.pathStones = function (ctx, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var len = Math.hypot(dx, dy);
    var n = Math.floor(len / 12);
    var th = R.theme();
    var edge = th.edge;
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var px = x1 + dx * t, py = y1 + dy * t;
      var h = 4 + ((i * 7) % 5);
      if (edge === 'hole') {
        // 鼠洞：圆润土堆
        ctx.fillStyle = 'rgba(80,62,38,0.85)';
        ctx.beginPath();
        ctx.arc(px, py - h * 0.2, h * 0.5 + 1, Math.PI, Math.PI * 2);
        ctx.fill();
      } else if (edge === 'pen') {
        // 牛栏：木栅栏短桩
        ctx.fillStyle = '#7a5a32';
        ctx.fillRect(px - 2, py - h, 4, h);
      } else if (edge === 'den') {
        // 虎穴：尖岩
        ctx.fillStyle = 'rgba(60,44,40,0.9)';
        ctx.beginPath();
        ctx.moveTo(px - 5, py);
        ctx.lineTo(px - 1, py - h);
        ctx.lineTo(px + 4, py);
        ctx.closePath();
        ctx.fill();
      } else if (edge === 'burrow') {
        // 兔窝：绒草球
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(px, py - h * 0.3, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (edge === 'palace') {
        // 龙宫：金珠水沫
        ctx.fillStyle = 'rgba(232,197,58,0.8)';
        ctx.beginPath();
        ctx.arc(px, py - h * 0.4, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 默认：尖石
        ctx.fillStyle = 'rgba(74,60,48,0.85)';
        ctx.beginPath();
        ctx.moveTo(px - 5, py);
        ctx.lineTo(px, py - h);
        ctx.lineTo(px + 5, py);
        ctx.closePath();
        ctx.fill();
      }
    }
  };

  // 刷怪丛：黑色荆棘丛 + 白花
  R.bush = function (ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#3c3a38';
    for (var i = 0; i < 7; i++) {
      var ang = i / 7 * Math.PI * 2;
      var r = s * (0.28 + (i % 3) * 0.09);
      ctx.beginPath();
      ctx.ellipse(Math.cos(ang) * s * 0.18, Math.sin(ang) * s * 0.12, r, r * 0.7, ang, 0, Math.PI * 2);
      ctx.fill();
    }
    // 尖刺
    ctx.strokeStyle = '#2c2a28';
    ctx.lineWidth = 2;
    for (var k = 0; k < 8; k++) {
      var a2 = k / 8 * Math.PI * 2 + 0.3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a2) * s * 0.3, Math.sin(a2) * s * 0.22);
      ctx.lineTo(Math.cos(a2) * s * 0.52, Math.sin(a2) * s * 0.4);
      ctx.stroke();
    }
    // 白花
    ctx.fillStyle = '#efe9da';
    for (var f = 0; f < 5; f++) {
      var fa = f / 5 * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(fa) * 4, -s * 0.25 + Math.sin(fa) * 4, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#c9a94e';
    ctx.beginPath(); ctx.arc(0, -s * 0.25, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  // ---- 生肖令牌字块 ----
  // 青绿玉牌（兵种/守将）+ 红底金字（金色武将碎片/武将）+ 暗红令牌（敌人）
  // opt: {lv, gold, enemy, small, alpha, flash, hl}
  R.mahjong = function (ctx, x, y, s, ch, opt) {
    opt = opt || {};
    var alpha = opt.alpha != null ? opt.alpha : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    var half = s / 2;
    var r = s * 0.16;
    var base, face, ink, rim;
    if (opt.enemy) {
      base = '#6e2118'; face = '#963627'; ink = '#f6ead2'; rim = 'rgba(232,197,58,0.55)';
    } else if (opt.gold) {
      base = '#8a1010'; face = '#c2201c'; ink = '#ffd873'; rim = '#e8c53a';
    } else {
      base = '#2c6a50'; face = '#3f8f6a'; ink = '#f3f7ee'; rim = 'rgba(232,197,58,0.85)';
    }
    // 厚度底座（立体感）
    ctx.fillStyle = base;
    R.roundRect(ctx, -half, -half + s * 0.07, s, s, r);
    ctx.fill();
    // 令牌面
    ctx.fillStyle = opt.flash ? '#ffe6b0' : face;
    R.roundRect(ctx, -half, -half, s, s * 0.94, r);
    ctx.fill();
    // 鎏金外框
    ctx.strokeStyle = rim;
    ctx.lineWidth = opt.hl ? 3.4 : 2;
    R.roundRect(ctx, -half, -half, s, s * 0.94, r);
    ctx.stroke();
    // 内层细线（玉牌质感）
    ctx.globalAlpha = alpha * 0.5;
    ctx.lineWidth = 1;
    R.roundRect(ctx, -half + s * 0.1, -half + s * 0.1, s * 0.8, s * 0.74, r * 0.7);
    ctx.stroke();
    ctx.globalAlpha = alpha;
    // 字
    ctx.fillStyle = ink;
    R.font(ctx, s * 0.58, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, 0, -s * 0.02);
    // 等级角标
    if (opt.lv && opt.lv > 0) {
      ctx.fillStyle = opt.gold ? '#ffe6a0' : '#f3f7ee';
      R.font(ctx, s * 0.24, true);
      ctx.textAlign = 'right';
      ctx.fillText(String(opt.lv), half - s * 0.08, -half + s * 0.18);
    }
    ctx.restore();
  };

  // 敌人小牌 + 血条
  R.enemyTile = function (ctx, x, y, s, ch, hpRatio, boss) {
    R.mahjong(ctx, x, y, s, ch, { enemy: true });
    if (boss) {
      ctx.save();
      ctx.strokeStyle = '#e8c53a';
      ctx.lineWidth = 3;
      R.roundRect(ctx, x - s / 2, y - s / 2, s, s * 0.94, s * 0.14);
      ctx.stroke();
      ctx.restore();
    }
    // 顶部红血条
    ctx.save();
    var bw = s * 0.94;
    ctx.fillStyle = 'rgba(40,30,24,0.75)';
    ctx.fillRect(x - bw / 2, y - s / 2 - 9, bw, 5);
    ctx.fillStyle = '#c23a2a';
    ctx.fillRect(x - bw / 2, y - s / 2 - 9, bw * Math.max(0, Math.min(1, hpRatio)), 5);
    ctx.restore();
  };

  // 红心
  R.heart = function (ctx, x, y, s, filled) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, s * 0.32);
    ctx.bezierCurveTo(-s * 0.6, -s * 0.15, -s * 0.28, -s * 0.55, 0, -s * 0.2);
    ctx.bezierCurveTo(s * 0.28, -s * 0.55, s * 0.6, -s * 0.15, 0, s * 0.32);
    ctx.closePath();
    ctx.fillStyle = filled ? '#c9302a' : 'rgba(90,80,70,0.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,30,24,0.6)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  };

  // 金冠
  R.crown = function (ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#d4a017';
    ctx.beginPath();
    ctx.moveTo(-s / 2, s * 0.28);
    ctx.lineTo(-s / 2, -s * 0.1);
    ctx.lineTo(-s * 0.24, s * 0.06);
    ctx.lineTo(0, -s * 0.32);
    ctx.lineTo(s * 0.24, s * 0.06);
    ctx.lineTo(s / 2, -s * 0.1);
    ctx.lineTo(s / 2, s * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8a6a10';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#c9302a';
    ctx.beginPath(); ctx.arc(0, s * 0.05, s * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  // 守将：红色菱形「福」字 + 金冠 + 红心排
  R.adou = function (ctx, x, y, s, hearts, maxHearts, shake) {
    ctx.save();
    if (shake) ctx.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 4);
    for (var i = 0; i < maxHearts; i++) {
      R.heart(ctx, x - (maxHearts - 1) * s * 0.19 + i * s * 0.38, y - s * 0.82, s * 0.3, i < hearts);
    }
    var d = s * 0.62;
    // 菱形底
    ctx.beginPath();
    ctx.moveTo(x, y - d);
    ctx.lineTo(x + d, y);
    ctx.lineTo(x, y + d);
    ctx.lineTo(x - d, y);
    ctx.closePath();
    ctx.fillStyle = '#c2201c';
    ctx.fill();
    ctx.strokeStyle = '#e8c53a';
    ctx.lineWidth = Math.max(2, s * 0.08);
    ctx.stroke();
    // 内层金线
    ctx.strokeStyle = 'rgba(255,224,140,0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y - d * 0.78);
    ctx.lineTo(x + d * 0.78, y);
    ctx.lineTo(x, y + d * 0.78);
    ctx.lineTo(x - d * 0.78, y);
    ctx.closePath();
    ctx.stroke();
    // 「福」字
    ctx.fillStyle = '#ffd873';
    R.font(ctx, s * 0.66, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('福', x, y - s * 0.02);
    R.crown(ctx, x, y - s * 0.74, s * 0.46);
    ctx.restore();
  };

  // 水墨光晕（武将令牌背后的光晕，呼吸缩放）
  R.inkHalo = function (ctx, x, y, s, t, color) {
    ctx.save();
    ctx.translate(x, y);
    var pulse = 1 + Math.sin(t * 2.2) * 0.06; // 呼吸缩放
    var alpha = 0.22 + Math.sin(t * 2.2) * 0.06;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color || '#3a3126';
    ctx.scale(pulse, pulse);
    ctx.beginPath();
    // 不规则墨晕轮廓
    var pts = 14;
    for (var i = 0; i <= pts; i++) {
      var a = i / pts * Math.PI * 2;
      var noise = 1 + Math.sin(a * 3 + t * 0.8) * 0.18 + Math.cos(a * 5 - t * 0.6) * 0.1;
      var rx = Math.cos(a) * s * 0.95 * noise;
      var ry = Math.sin(a) * s * 0.95 * noise;
      if (i === 0) ctx.moveTo(rx, ry); else ctx.lineTo(rx, ry);
    }
    ctx.closePath();
    // ctx.filter 在小游戏端不支持且性能开销大，改用多层半透明描边模拟模糊
    if (typeof ctx.filter !== 'undefined' && ctx.filter !== '') {
      ctx.filter = 'blur(4px)';
      ctx.fill();
      ctx.filter = 'none';
    } else {
      // 降级：多次半透明描边模拟模糊
      ctx.lineWidth = 3;
      ctx.globalAlpha = alpha * 0.5;
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.globalAlpha = alpha * 0.25;
      ctx.stroke();
    }
    ctx.restore();
  };

  // 会跳动的方块字（顶部停留短、底部挤压）
  // 特征：纯文字方块 + 浅色底 + 持续小幅度垂直弹跳（顶部停留短、底部挤压）
  // ch：单字或两字；kind：'general'(红底金字) | 'monk'(青底白字) | 'enemy'(敌人)
  R.livingTile = function (ctx, x, y, s, ch, kind, t) {
    ctx.save();
    // 弹跳周期 ~0.9 秒，使用 |sin| 模拟弹跳（顶部停留短，底部有挤压）
    var period = 0.9;
    var phase = (t % period) / period; // 0~1
    // 用 |sin| 让弹跳有"触地反弹"感：底部=0，顶部=1
    var bounce = Math.abs(Math.sin(phase * Math.PI));
    // 垂直位移：向上跳起 s*0.06
    var dy = -bounce * s * 0.06;
    // 触底挤压：接近底部时 y 方向轻微压扁
    var squash = 1 - (1 - bounce) * 0.08; // 底部压扁 8%
    var stretch = 1 + (1 - bounce) * 0.04; // 底部横向略拉伸（体积守恒）

    ctx.translate(x, y + dy);
    ctx.scale(stretch, squash);

    var half = s / 2;
    var r = s * 0.12;
    // 立体厚度（底部阴影）
    ctx.fillStyle = kind === 'general' ? '#8a1010' : (kind === 'monk' ? '#2c6a50' : 'rgba(60,50,40,0.25)');
    R.roundRect(ctx, -half + 2, -half + s * 0.08 + 3, s, s, r);
    ctx.fill();
    // 牌面底色
    if (kind === 'general') {
      ctx.fillStyle = '#c2201c'; // 红底金字（武将/碎片）
    } else if (kind === 'monk') {
      ctx.fillStyle = '#3f8f6a'; // 青底白字（兵种）
    } else {
      ctx.fillStyle = '#f7f3e8'; // 默认米白
    }
    R.roundRect(ctx, -half, -half, s, s * 0.96, r);
    ctx.fill();
    // 细边
    ctx.strokeStyle = kind === 'general' ? '#e8c53a' : (kind === 'monk' ? 'rgba(232,197,58,0.9)' : 'rgba(120,108,88,0.6)');
    ctx.lineWidth = kind === 'default' ? 1.5 : 2.4;
    R.roundRect(ctx, -half, -half, s, s * 0.96, r);
    ctx.stroke();
    // 文字
    ctx.fillStyle = kind === 'general' ? '#ffd873' : (kind === 'monk' ? '#f3f7ee' : '#28221a');
    if (ch.length === 1) {
      R.font(ctx, s * 0.58, true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch, 0, -s * 0.02);
    } else {
      // 两字竖排
      R.font(ctx, s * 0.36, true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch[0], 0, -s * 0.22);
      ctx.fillText(ch[1], 0, s * 0.22);
    }
    ctx.restore();
  };

  // 攻击瞬间文字变形化作兵器（原版核心视觉特色）
  // attackT: 攻击动画剩余时间（秒），从 0.35 衰减到 0
  // ch: 兵种字（刀/枪/弓/骑）或武将名
  // kind: 's' 兵种 | 'g' 武将
  R.morphTile = function (ctx, x, y, s, ch, kind, attackT, hero) {
    if (!attackT || attackT <= 0) return false; // 无变形，调用方走默认渲染
    ctx.save();
    // 进度 0~1：0=刚触发，1=恢复
    var maxT = 0.35;
    var p = 1 - attackT / maxT; // 0→1
    // 变形曲线：前 30% 快速变形到武器形，70% 恢复
    var morph;
    if (p < 0.3) {
      morph = p / 0.3; // 0→1 快速变形
    } else {
      morph = 1 - (p - 0.3) / 0.7; // 1→0 缓慢恢复
    }
    morph = Math.max(0, Math.min(1, morph));
    // 旋转角度：变形时旋转 90°（文字立起变兵器）
    var rot = morph * Math.PI / 2 * 0.5; // 最多 45°
    // 缩放：变形时略微拉长（兵器形态）
    var scaleY = 1 + morph * 0.25;
    var scaleX = 1 - morph * 0.1;
    // 闪光透明度
    var flash = morph * 0.4;

    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(scaleX, scaleY);
    ctx.globalAlpha = 1;

    // 金光描边（变形时的能量光）
    if (flash > 0.05) {
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 12 * morph;
    }

    // 兵器形态：根据兵种画不同武器
    if (kind === 's') {
      var weaponColor = '#5a3a1a';
      var metalColor = '#c0c0c0';
      ctx.fillStyle = weaponColor;
      ctx.strokeStyle = '#2a1a0a';
      ctx.lineWidth = 1.5;
      if (ch === '爪') {
        // 爪：三道弯钩利爪
        ctx.strokeStyle = metalColor;
        ctx.lineWidth = 4.5;
        ctx.lineCap = 'round';
        for (var ci = -1; ci <= 1; ci++) {
          ctx.beginPath();
          ctx.moveTo(ci * s * 0.22, s * 0.34);
          ctx.quadraticCurveTo(ci * s * 0.3, -s * 0.05, ci * s * 0.16, -s * 0.34);
          ctx.stroke();
        }
      } else if (ch === '角') {
        // 角：粗壮弯角
        ctx.strokeStyle = '#e8dcc0';
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-s * 0.28, s * 0.36);
        ctx.quadraticCurveTo(s * 0.05, s * 0.1, s * 0.3, -s * 0.36);
        ctx.stroke();
        ctx.strokeStyle = '#a8863a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-s * 0.28, s * 0.36);
        ctx.quadraticCurveTo(s * 0.05, s * 0.1, s * 0.3, -s * 0.36);
        ctx.stroke();
      } else if (ch === '牙') {
        // 牙：獠牙
        ctx.fillStyle = metalColor;
        ctx.beginPath();
        ctx.moveTo(-s * 0.16, -s * 0.42);
        ctx.quadraticCurveTo(s * 0.02, s * 0.05, s * 0.16, s * 0.42);
        ctx.quadraticCurveTo(-s * 0.02, s * 0.1, -s * 0.3, -s * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#8a8a90';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else if (ch === '翼') {
        // 翼：羽翼
        ctx.strokeStyle = weaponColor;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        for (var wi = 0; wi < 3; wi++) {
          ctx.beginPath();
          ctx.moveTo(-s * 0.3, s * 0.28 - wi * s * 0.24);
          ctx.quadraticCurveTo(s * 0.05, s * 0.05 - wi * s * 0.22, s * 0.34, -s * 0.34);
          ctx.stroke();
        }
        ctx.strokeStyle = metalColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-s * 0.34, s * 0.3);
        ctx.lineTo(-s * 0.34, -s * 0.2);
        ctx.stroke();
      }
    } else if (kind === 'g') {
      // 武将攻击：金色光芒爆发
      ctx.fillStyle = '#ffd700';
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 2;
      if (hero === '辰龙') {
        // 辰龙出击时显现三道鎏金龙爪痕
        ctx.strokeStyle = '#f0c850';
        ctx.lineWidth = Math.max(2, s * 0.075);
        ctx.lineCap = 'round';
        for (var gc = -1; gc <= 1; gc++) {
          ctx.beginPath();
          ctx.moveTo(-s * 0.32 + gc * s * 0.08, -s * 0.32 + gc * s * 0.08);
          ctx.quadraticCurveTo(gc * s * 0.05, gc * s * 0.04, s * 0.32 + gc * s * 0.08, s * 0.32 + gc * s * 0.08);
          ctx.stroke();
        }
      } else {
        // 四芒星
        ctx.beginPath();
        for (var i = 0; i < 8; i++) {
          var a = i / 8 * Math.PI * 2;
          var r = i % 2 === 0 ? s * 0.4 : s * 0.18;
          var px = Math.cos(a) * r;
          var py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.shadowBlur = 0;

    // 变形期间叠加原文字（半透明，做"文字→兵器"过渡）
    if (morph > 0.3) {
      ctx.globalAlpha = (morph - 0.3) / 0.7 * 0.5;
      ctx.rotate(-rot);
      ctx.scale(1 / scaleX, 1 / scaleY);
      ctx.fillStyle = kind === 'g' ? '#7a2a1a' : '#28221a';
      if (ch.length === 1) {
        R.font(ctx, s * 0.5, true);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ch, 0, 0);
      } else {
        R.font(ctx, s * 0.3, true);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ch[0], 0, -s * 0.2);
        ctx.fillText(ch[1], 0, s * 0.2);
      }
    }

    ctx.restore();
    return true; // 已渲染变形
  };

  // 守将（开始界面）：红色菱形「福」字 + 摆动躲避动画 + 金环
  // pokeT: 摆动相位（0~1），接近 0/1 时摆动最大
  R.monk = function (ctx, x, y, s, hearts, maxHearts, shake, t, pokeT) {
    ctx.save();
    if (shake) ctx.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 4);
    // 红心排
    for (var i = 0; i < maxHearts; i++) {
      R.heart(ctx, x - (maxHearts - 1) * s * 0.19 + i * s * 0.38, y - s * 0.82, s * 0.3, i < hearts);
    }
    var pokePhase = pokeT != null ? pokeT : 0;
    var pokeNear = Math.cos(pokePhase * Math.PI * 2);
    var pokeForce = Math.max(0, pokeNear);
    var swingDir = Math.sin(t * 3) > 0 ? 1 : -1;
    var swing = pokeForce * 0.18 * swingDir + Math.sin(t * 4) * 0.04;
    var bob = -Math.abs(Math.sin(t * 3.5)) * s * 0.03;

    ctx.translate(x, y + bob);
    ctx.rotate(swing);
    // 菱形底
    var d = s * 0.6;
    ctx.beginPath();
    ctx.moveTo(0, -d); ctx.lineTo(d, 0); ctx.lineTo(0, d); ctx.lineTo(-d, 0);
    ctx.closePath();
    ctx.fillStyle = '#c2201c';
    ctx.fill();
    ctx.strokeStyle = '#e8c53a';
    ctx.lineWidth = Math.max(2, s * 0.08);
    ctx.stroke();
    // 「福」字
    ctx.fillStyle = '#ffd873';
    R.font(ctx, s * 0.64, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('福', 0, -s * 0.02);
    ctx.restore();
    // 头顶金环
    R.goldRing(ctx, x, y - s * 0.56, s * 0.5, t);
  };

  // 鎏金环（守将头顶装饰，带光泽）
  R.goldRing = function (ctx, x, y, s, t) {
    ctx.save();
    ctx.translate(x, y);
    // 金箍主体（椭圆环）
    ctx.strokeStyle = '#d4a017';
    ctx.lineWidth = s * 0.12;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.55, s * 0.22, 0, 0, Math.PI * 2);
    ctx.stroke();
    // 高光
    ctx.strokeStyle = '#fce58a';
    ctx.lineWidth = s * 0.04;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.02, s * 0.5, s * 0.18, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    // 中央红宝石
    ctx.fillStyle = '#c9302a';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a6a10';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  };

  // 生肖金环（开始界面题字装饰）：旋转的鎏金环 + 十二生肖刻度 + 明珠
  // 返回摆动相位（0~1，供守将左右摇晃用）
  R.ornament = function (ctx, cx, cy, r, t) {
    ctx.save();
    ctx.translate(cx, cy);
    var spin = t * 0.6;
    // 外环
    ctx.strokeStyle = '#e8c53a';
    ctx.lineWidth = r * 0.12;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    // 内环
    ctx.strokeStyle = 'rgba(184,134,11,0.7)';
    ctx.lineWidth = r * 0.04;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2); ctx.stroke();
    // 十二道生肖刻度（随时间旋转）
    for (var i = 0; i < 12; i++) {
      var a = spin + i / 12 * Math.PI * 2;
      ctx.strokeStyle = i % 3 === 0 ? '#c2201c' : '#b8860b';
      ctx.lineWidth = i % 3 === 0 ? r * 0.07 : r * 0.035;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.stroke();
    }
    // 中央明珠
    ctx.fillStyle = '#fce58a';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d4a017';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.1, 0, Math.PI * 2); ctx.fill();
    // 高光
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = r * 0.03;
    ctx.beginPath(); ctx.arc(0, 0, r, spin, spin + Math.PI * 0.5); ctx.stroke();
    ctx.restore();
    return (Math.sin(t * Math.PI * 2 / 1.2) + 1) / 2;
  };

  // 仙桃图标（经济资源，替代原版馒头）
  R.bun = function (ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    // 墨迹托底
    ctx.fillStyle = 'rgba(40,34,26,0.8)';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.28, s * 0.82, s * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    // 桃身（粉红渐变）
    var grad = ctx.createRadialGradient(-s * 0.15, -s * 0.1, s * 0.08, 0, 0, s * 0.62);
    grad.addColorStop(0, '#ffe0cc');
    grad.addColorStop(0.55, '#ff9a86');
    grad.addColorStop(1, '#e8534a');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, s * 0.05, s * 0.52, s * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();
    // 桃尖
    ctx.fillStyle = '#f0706a';
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.52);
    ctx.quadraticCurveTo(s * 0.2, -s * 0.28, 0, -s * 0.16);
    ctx.quadraticCurveTo(-s * 0.2, -s * 0.28, 0, -s * 0.52);
    ctx.closePath();
    ctx.fill();
    // 描边
    ctx.strokeStyle = 'rgba(150,60,50,0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, s * 0.05, s * 0.52, s * 0.46, 0, 0, Math.PI * 2);
    ctx.stroke();
    // 绿叶
    ctx.fillStyle = '#4f9a52';
    ctx.beginPath();
    ctx.ellipse(s * 0.2, -s * 0.44, s * 0.22, s * 0.1, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2f6a32';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(s * 0.02, -s * 0.4);
    ctx.lineTo(s * 0.06, -s * 0.6);
    ctx.stroke();
    ctx.restore();
  };

  // 营帐图标（备战席）
  R.hut = function (ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#4a3428';
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, -s * 0.05);
    ctx.quadraticCurveTo(0, -s * 0.65, s * 0.55, -s * 0.05);
    ctx.lineTo(s * 0.42, s * 0.05);
    ctx.quadraticCurveTo(0, -s * 0.42, -s * 0.42, s * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6a5138';
    ctx.fillRect(-s * 0.38, s * 0.02, s * 0.76, s * 0.4);
    ctx.fillStyle = '#f2eee2';
    R.font(ctx, s * 0.34, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('营', 0, s * 0.22);
    ctx.restore();
  };

  // 砖红大按钮（原版“征兵/开始游戏”样式）
  R.redButton = function (ctx, b, pressed) {
    ctx.save();
    ctx.globalAlpha = b.disabled ? 0.55 : 1;
    // 深色底座
    ctx.fillStyle = '#4a3226';
    R.roundRect(ctx, b.x, b.y + 6, b.w, b.h, 14);
    ctx.fill();
    // 红面
    ctx.fillStyle = pressed ? '#9a4432' : '#b5543c';
    R.roundRect(ctx, b.x, b.y, b.w, b.h - 4, 14);
    ctx.fill();
    ctx.strokeStyle = '#7a3826';
    ctx.lineWidth = 2.5;
    R.roundRect(ctx, b.x, b.y, b.w, b.h - 4, 14);
    ctx.stroke();
    ctx.fillStyle = '#f7f0e0';
    R.font(ctx, b.fs || 34, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var cy = b.y + (b.h - 4) / 2;
    if (b.bun != null) {
      ctx.fillText(b.label, b.x + b.w / 2, cy - 12);
      R.bun(ctx, b.x + b.w / 2 - 22, cy + 17, 13);
      R.font(ctx, 24, true);
      ctx.textAlign = 'left';
      ctx.fillText(String(b.bun), b.x + b.w / 2 - 6, cy + 17);
    } else {
      ctx.fillText(b.label, b.x + b.w / 2, cy + 1);
    }
    ctx.restore();
  };

  // 深灰按钮
  R.darkButton = function (ctx, b) {
    ctx.save();
    ctx.fillStyle = '#3f4348';
    R.roundRect(ctx, b.x, b.y + 5, b.w, b.h, 12);
    ctx.fill();
    ctx.fillStyle = '#565c63';
    R.roundRect(ctx, b.x, b.y, b.w, b.h - 3, 12);
    ctx.fill();
    ctx.fillStyle = '#f0ede4';
    R.font(ctx, b.fs || 30, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + (b.h - 3) / 2 + 1);
    ctx.restore();
  };

  // 星星
  R.star = function (ctx, x, y, s, lit) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    for (var i = 0; i < 5; i++) {
      var a = -Math.PI / 2 + i * Math.PI * 2 / 5;
      var a2 = a + Math.PI / 5;
      ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
      ctx.lineTo(Math.cos(a2) * s * 0.45, Math.sin(a2) * s * 0.45);
    }
    ctx.closePath();
    ctx.fillStyle = lit ? '#e8c53a' : '#4a4a48';
    ctx.fill();
    ctx.strokeStyle = lit ? '#a8862a' : '#333330';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  };

  // 乌云横幅（结算）
  R.cloud = function (ctx, x, y, w, h, color) {
    ctx.save();
    ctx.fillStyle = color || '#5a6068';
    var n = 6;
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var cx = x - w / 2 + t * w;
      var r = h * (0.42 + 0.22 * Math.sin(t * Math.PI * 2.5 + 1));
      ctx.beginPath();
      ctx.arc(cx, y + (i % 2 ? -h * 0.08 : h * 0.08), r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(x, y + h * 0.1, w / 2, h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // 黑卷轴
  R.scroll = function (ctx, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = '#7a4a2a';
    R.roundRect(ctx, x - w / 2 - 18, y - h / 2 - 6, 22, h + 12, 8);
    ctx.fill();
    R.roundRect(ctx, x + w / 2 - 4, y - h / 2 - 6, 22, h + 12, 8);
    ctx.fill();
    ctx.fillStyle = '#23211e';
    R.roundRect(ctx, x - w / 2, y - h / 2, w, h, 6);
    ctx.fill();
    ctx.restore();
  };

  // 可解锁格已无特殊样式：所有绿色 block 格都可铲，渲染同普通绿格

  // 铲子道具牌（与字牌同尺寸，棕色土底 + 铲子图案 + "铲"字）
  R.shovelTile = function (ctx, x, y, s, opt) {
    opt = opt || {};
    ctx.save();
    ctx.globalAlpha = opt.alpha != null ? opt.alpha : 1;
    ctx.translate(x, y);
    var half = s / 2;
    var r = s * 0.14;
    // 厚度
    ctx.fillStyle = '#a08560';
    R.roundRect(ctx, -half, -half + s * 0.06, s, s, r);
    ctx.fill();
    // 牌面（土黄底）
    ctx.fillStyle = opt.flash ? '#ffd9cc' : '#d9b978';
    R.roundRect(ctx, -half, -half, s, s * 0.94, r);
    ctx.fill();
    ctx.strokeStyle = opt.hl ? '#c9922e' : '#7a5a2a';
    ctx.lineWidth = opt.hl ? 3 : 1.5;
    R.roundRect(ctx, -half, -half, s, s * 0.94, r);
    ctx.stroke();
    // 铲子图案（木柄 + 金属铲头）
    var sc = s * 0.5;
    ctx.save();
    ctx.translate(0, -s * 0.04);
    // 木柄
    ctx.strokeStyle = '#6a4220';
    ctx.lineWidth = s * 0.07;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-sc * 0.35, sc * 0.5);
    ctx.lineTo(sc * 0.35, -sc * 0.3);
    ctx.stroke();
    // 铲头（金属梯形）
    ctx.fillStyle = '#c0c0c0';
    ctx.strokeStyle = '#6a6a6a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sc * 0.18, -sc * 0.18);
    ctx.lineTo(sc * 0.52, -sc * 0.52);
    ctx.lineTo(sc * 0.68, -sc * 0.36);
    ctx.lineTo(sc * 0.34, -sc * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // "铲"字（右下角小字标识）
    ctx.fillStyle = '#3a2a1a';
    R.font(ctx, s * 0.24, true);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('铲', half - s * 0.08, half - s * 0.06);
    ctx.restore();
  };

  // 5 卡牌选择面板已移除：原版机制为征兵直接替换备战席，无需弹窗

  // 玩家头像：圆形彩色人物画像（程序化绘制，每个生肖独特配色与特征）
  // id 为生肖标识（zishu/chouniu/yinhu/maotu/chenlong）
  var avatarPalette = {
    zishu:    { bg: '#b7a06a', face: '#f2dcc0', accent: '#8a6a3a' },
    chouniu:  { bg: '#7f9a5a', face: '#e8d0a8', accent: '#5a4028' },
    yinhu:    { bg: '#c8863a', face: '#f2d9a8', accent: '#3a2a1a' },
    maotu:    { bg: '#c8d4e0', face: '#f6ead8', accent: '#e0a0b0' },
    chenlong: { bg: '#4a7a9a', face: '#eaf0f5', accent: '#e8c53a' }
  };
  R.avatar = function (ctx, x, y, r, id, selected) {
    ctx.save();
    var pal = avatarPalette[id] || avatarPalette.zishu;
    // 圆形彩色背景
    ctx.fillStyle = pal.bg;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // 圆形裁剪绘制人物特征
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r - 1, 0, Math.PI * 2);
    ctx.clip();
    // 脸部底色圆（占大头）
    ctx.fillStyle = pal.face;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.62, 0, Math.PI * 2);
    ctx.fill();
    // 统一眼睛（所有角色都有）
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath(); ctx.arc(x - r * 0.2, y - r * 0.05, r * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r * 0.2, y - r * 0.05, r * 0.09, 0, Math.PI * 2); ctx.fill();
    // 统一嘴巴
    ctx.strokeStyle = '#7a3a2a';
    ctx.lineWidth = r * 0.06;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y + r * 0.25, r * 0.12, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    // 各角色特征（在眼睛嘴巴之上叠加）
    if (id === 'zishu') {
      // 鼠：圆耳朵 + 胡须
      ctx.fillStyle = pal.face;
      ctx.beginPath(); ctx.arc(x - r * 0.5, y - r * 0.5, r * 0.26, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + r * 0.5, y - r * 0.5, r * 0.26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pal.accent;
      ctx.beginPath(); ctx.arc(x - r * 0.5, y - r * 0.5, r * 0.13, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + r * 0.5, y - r * 0.5, r * 0.13, 0, Math.PI * 2); ctx.fill();
      // 胡须
      ctx.strokeStyle = '#6a5a48';
      ctx.lineWidth = r * 0.03;
      for (var mw = -1; mw <= 1; mw++) {
        ctx.beginPath();
        ctx.moveTo(x - r * 0.2, y + r * 0.22 + mw * r * 0.06);
        ctx.lineTo(x - r * 0.62, y + r * 0.14 + mw * r * 0.12);
        ctx.moveTo(x + r * 0.2, y + r * 0.22 + mw * r * 0.06);
        ctx.lineTo(x + r * 0.62, y + r * 0.14 + mw * r * 0.12);
        ctx.stroke();
      }
    } else if (id === 'chouniu') {
      // 牛：犄角 + 鼻环
      ctx.fillStyle = '#f0e6cf';
      ctx.beginPath();
      ctx.moveTo(x - r * 0.42, y - r * 0.4);
      ctx.quadraticCurveTo(x - r * 0.78, y - r * 0.66, x - r * 0.6, y - r * 0.28);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + r * 0.42, y - r * 0.4);
      ctx.quadraticCurveTo(x + r * 0.78, y - r * 0.66, x + r * 0.6, y - r * 0.28);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = pal.accent;
      ctx.beginPath(); ctx.ellipse(x, y + r * 0.26, r * 0.24, r * 0.16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#c9a94e';
      ctx.lineWidth = r * 0.06;
      ctx.beginPath(); ctx.arc(x, y + r * 0.36, r * 0.13, 0, Math.PI); ctx.stroke();
    } else if (id === 'yinhu') {
      // 虎：尖耳 + 额纹「王」+ 脸颊斑
      ctx.fillStyle = pal.bg;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.6, y - r * 0.34); ctx.lineTo(x - r * 0.34, y - r * 0.74); ctx.lineTo(x - r * 0.16, y - r * 0.4);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + r * 0.6, y - r * 0.34); ctx.lineTo(x + r * 0.34, y - r * 0.74); ctx.lineTo(x + r * 0.16, y - r * 0.4);
      ctx.closePath(); ctx.fill();
      // 额纹
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = r * 0.05;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.16, y - r * 0.42); ctx.lineTo(x + r * 0.16, y - r * 0.42);
      ctx.moveTo(x - r * 0.1, y - r * 0.3); ctx.lineTo(x + r * 0.1, y - r * 0.3);
      ctx.moveTo(x, y - r * 0.42); ctx.lineTo(x, y - r * 0.24);
      ctx.stroke();
      // 颊须
      ctx.fillStyle = '#f0e6d0';
      ctx.beginPath(); ctx.ellipse(x - r * 0.42, y + r * 0.16, r * 0.16, r * 0.22, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + r * 0.42, y + r * 0.16, r * 0.16, r * 0.22, -0.4, 0, Math.PI * 2); ctx.fill();
    } else if (id === 'maotu') {
      // 兔：长耳 + 粉鼻
      ctx.fillStyle = pal.face;
      ctx.beginPath(); ctx.ellipse(x - r * 0.28, y - r * 0.66, r * 0.14, r * 0.36, -0.12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + r * 0.28, y - r * 0.66, r * 0.14, r * 0.36, 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pal.accent;
      ctx.beginPath(); ctx.ellipse(x - r * 0.28, y - r * 0.66, r * 0.06, r * 0.24, -0.12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + r * 0.28, y - r * 0.66, r * 0.06, r * 0.24, 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e88a9a';
      ctx.beginPath(); ctx.arc(x, y + r * 0.16, r * 0.08, 0, Math.PI * 2); ctx.fill();
    } else if (id === 'chenlong') {
      // 龙：鹿角 + 龙须 + 金鳞额饰
      ctx.strokeStyle = '#e8c53a';
      ctx.lineWidth = r * 0.07;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - r * 0.34, y - r * 0.34);
      ctx.lineTo(x - r * 0.52, y - r * 0.58);
      ctx.lineTo(x - r * 0.36, y - r * 0.74);
      ctx.moveTo(x + r * 0.34, y - r * 0.34);
      ctx.lineTo(x + r * 0.52, y - r * 0.58);
      ctx.lineTo(x + r * 0.36, y - r * 0.74);
      ctx.stroke();
      // 金色额鳞
      ctx.fillStyle = 'rgba(232,197,58,0.85)';
      ctx.beginPath(); ctx.arc(x, y - r * 0.28, r * 0.12, 0, Math.PI * 2); ctx.fill();
      // 龙须
      ctx.strokeStyle = '#dce8f0';
      ctx.lineWidth = r * 0.035;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.22, y + r * 0.2);
      ctx.quadraticCurveTo(x - r * 0.6, y + r * 0.36, x - r * 0.66, y + r * 0.12);
      ctx.moveTo(x + r * 0.22, y + r * 0.2);
      ctx.quadraticCurveTo(x + r * 0.6, y + r * 0.36, x + r * 0.66, y + r * 0.12);
      ctx.stroke();
    }
    ctx.restore();
    // 边框
    ctx.strokeStyle = selected ? '#e8a92e' : '#3a3126';
    ctx.lineWidth = selected ? 5 : 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  // 攻击范围圈：单位周围的半透明圆形射程指示（参考原版样式）
  // 金色淡填充 + 虚线边框，中心为单位像素位置，半径 = range * cell
  R.rangeCircle = function (ctx, x, y, radius, side) {
    if (radius <= 0) return;
    ctx.save();
    // 外层柔光填充
    var fill = (side === 'e') ? 'rgba(180,60,40,0.14)' : 'rgba(232,197,58,0.16)';
    var stroke = (side === 'e') ? 'rgba(180,60,40,0.7)' : 'rgba(212,160,40,0.8)';
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    // 虚线边框
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // 中心十字准星
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y);
    ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 8);
    ctx.stroke();
    ctx.restore();
  };

  // 武器弹道造型：按武器 shape 绘制专属弹道
  // 已 translate+rotate 到弹头位置，朝向 +x 方向
  // color: 品质色（绿/蓝/紫/橙），gold: 武将金色
  R.drawWeaponBullet = function (ctx, shape, color, gold, hero) {
    // hero：装备该武器的武将名（用于生肖化配色）；缺省时使用装备品质色
    var heroFx = (hero && ZY.C && ZY.C.HERO_FX) ? ZY.C.HERO_FX[hero] : null;
    var c = (heroFx && heroFx.color) ? heroFx.color : (color || '#b8860b');
    var metal = gold ? '#8a6a10' : '#3a3126';
    ctx.save();
    if (shape === 'staff') {
      // 金箍棒：黑铁棍身 + 两道金箍 + 端头金球
      ctx.fillStyle = '#3a3530';
      ctx.fillRect(-13, -2.5, 24, 5);
      ctx.fillStyle = c;
      ctx.fillRect(-10, -3, 4, 6);
      ctx.fillRect(4, -3, 4, 6);
      ctx.beginPath(); ctx.arc(13, 0, 3, 0, Math.PI * 2); ctx.fill();
    } else if (shape === 'rake') {
      // 九齿钉耙：耙柄 + 九齿扇形头
      ctx.strokeStyle = metal; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(2, 0); ctx.stroke();
      ctx.fillStyle = c;
      ctx.fillRect(2, -5, 4, 10);
      ctx.strokeStyle = c; ctx.lineWidth = 1.5;
      for (var i = 0; i < 5; i++) {
        var y0 = -4 + i * 2;
        ctx.beginPath(); ctx.moveTo(6, y0); ctx.lineTo(13, y0); ctx.stroke();
      }
    } else if (shape === 'monkspade') {
      // 月牙铲：长柄 + 月牙铲头
      ctx.strokeStyle = metal; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(4, 0); ctx.stroke();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(4, -6); ctx.quadraticCurveTo(14, 0, 4, 6);
      ctx.lineTo(4, -6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = metal; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(4, -6); ctx.lineTo(4, 6); ctx.stroke();
    } else if (shape === 'crosier') {
      // 九环锡杖：长杖 + 顶部环
      ctx.strokeStyle = metal; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(8, 0); ctx.stroke();
      ctx.strokeStyle = c; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(10, 0, 4, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(10, 0, 1.5, 0, Math.PI * 2); ctx.fill();
    } else if (shape === 'pearl') {
      // 明珠：发光圆球 + 拖尾
      ctx.fillStyle = c;
      ctx.shadowColor = c; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(8, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(6, -1.5, 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(2, 0); ctx.stroke();
    } else if (shape === 'fan') {
      // 芭蕉扇：扇骨扇面
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.arc(-12, 0, 14, -0.6, 0.6);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = metal; ctx.lineWidth = 1.5;
      for (var f1 = -1; f1 <= 1; f1++) {
        ctx.beginPath();
        ctx.moveTo(-12, 0); ctx.lineTo(-12 + Math.cos(f1 * 0.5) * 13, Math.sin(f1 * 0.5) * 13);
        ctx.stroke();
      }
    } else if (shape === 'gourd') {
      // 葫芦：双圆球
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(-4, 0, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(6, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = metal;
      ctx.fillRect(-1, -1.5, 3, 3);
    } else if (shape === 'vase') {
      // 净瓶：瓶身 + 瓶口
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(-8, -3); ctx.lineTo(-6, -5); ctx.lineTo(6, -5); ctx.lineTo(8, -3);
      ctx.lineTo(8, 5); ctx.lineTo(-8, 5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = metal;
      ctx.fillRect(-3, -8, 6, 3);
    } else if (shape === 'rope') {
      // 幌金绳：波浪绳索
      ctx.strokeStyle = c; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-13, 0);
      for (var rx = -13; rx <= 13; rx += 3) {
        ctx.quadraticCurveTo(rx + 1.5, (rx % 6 === 0 ? -3 : 3), rx + 3, 0);
      }
      ctx.stroke();
    } else if (shape === 'sword') {
      // 剑：剑柄 + 护手 + 直刃
      ctx.fillStyle = metal;
      ctx.fillRect(-12, -1.5, 5, 3);
      ctx.fillRect(-7, -4, 2, 8);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(-5, -2); ctx.lineTo(12, 0); ctx.lineTo(-5, 2); ctx.closePath(); ctx.fill();
    } else if (shape === 'knife') {
      // 刀：弧形刃
      ctx.fillStyle = metal; ctx.fillRect(-12, -1.5, 5, 3);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(-7, -2); ctx.lineTo(10, -3);
      ctx.quadraticCurveTo(13, 0, 10, 3);
      ctx.lineTo(-7, 2); ctx.closePath(); ctx.fill();
    } else if (shape === 'spear') {
      // 枪：长杆 + 三角头
      ctx.strokeStyle = metal; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(5, 0); ctx.stroke();
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(5, -3); ctx.lineTo(13, 0); ctx.lineTo(5, 3); ctx.closePath(); ctx.fill();
    } else if (shape === 'bow') {
      // 箭：杆 + 箭头 + 羽尾
      ctx.strokeStyle = metal; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(7, 0); ctx.stroke();
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(5, -4); ctx.lineTo(5, 4); ctx.closePath(); ctx.fill();
    } else if (shape === 'shield') {
      // 盾：椭圆盾牌
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(0, 0, 8, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = metal; ctx.lineWidth = 1.5; ctx.stroke();
    } else if (shape === 'whip') {
      // 鞭：节鞭
      ctx.strokeStyle = c; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-13, 0);
      ctx.quadraticCurveTo(0, -4, 13, 0);
      ctx.stroke();
      ctx.fillStyle = metal;
      for (var wi = -10; wi <= 10; wi += 5) {
        ctx.beginPath(); ctx.arc(wi, wi * 0.1, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    } else if (shape === 'axe') {
      // 斧：斧柄 + 斧头
      ctx.strokeStyle = metal; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(4, 0); ctx.stroke();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(4, -7); ctx.lineTo(13, -4); ctx.lineTo(13, 4); ctx.lineTo(4, 7);
      ctx.quadraticCurveTo(2, 0, 4, -7); ctx.closePath(); ctx.fill();
    } else if (shape === 'claw') {
      // 子鼠·鼠王金爪：三道鎏金利爪
      ctx.strokeStyle = c; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
      for (var cw = -1; cw <= 1; cw++) {
        ctx.beginPath();
        ctx.moveTo(-6, cw * 4);
        ctx.quadraticCurveTo(4, cw * 5, 12, cw * 7);
        ctx.stroke();
      }
      ctx.strokeStyle = metal; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(-11, -5); ctx.lineTo(-11, 5); ctx.stroke();
    } else if (shape === 'horn') {
      // 丑牛·伏牛铁角：粗壮铁角
      ctx.fillStyle = '#9aa0a8'; ctx.strokeStyle = metal; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-11, 6); ctx.quadraticCurveTo(2, 3, 13, -7);
      ctx.quadraticCurveTo(3, 8, -11, 6); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(-10, 4, 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8dcc0';
      ctx.beginPath(); ctx.moveTo(13, -7); ctx.lineTo(6, -1); ctx.lineTo(10, 1); ctx.closePath(); ctx.fill();
    } else if (shape === 'tigerfang') {
      // 寅虎·虎啸骨杖：一对獠牙
      ctx.fillStyle = '#f3e6c8'; ctx.strokeStyle = c; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-9, -6); ctx.quadraticCurveTo(4, -3, 13, 0);
      ctx.quadraticCurveTo(3, 1, -9, -1); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-9, 6); ctx.quadraticCurveTo(4, 3, 13, 0);
      ctx.quadraticCurveTo(3, -1, -9, 1); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = c; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(-5, 0); ctx.stroke();
    } else if (shape === 'moonarrow') {
      // 卯兔·玉兔玄弓：月牙 + 银箭
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(1, -9); ctx.quadraticCurveTo(15, 0, 1, 9);
      ctx.quadraticCurveTo(9, 0, 1, -9); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(4, 0); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(4, -4); ctx.lineTo(12, 0); ctx.lineTo(4, 4); ctx.closePath(); ctx.fill();
    } else if (shape === 'dragonpearl') {
      // 辰龙·龙宫明珠：夜明珠 + 水波龙气
      ctx.shadowColor = c; ctx.shadowBlur = 10;
      ctx.fillStyle = '#fce58a';
      ctx.beginPath(); ctx.arc(6, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#6fc0e8'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-15, 0); ctx.quadraticCurveTo(-8, -5, -2, 0);
      ctx.quadraticCurveTo(-8, 5, -15, 0); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(5, -2, 2, 0, Math.PI * 2); ctx.fill();
    } else if (shape === 'venomfang') {
      // 巳蛇·灵蛇毒刃：绿色毒刃 + 毒滴
      ctx.fillStyle = c; ctx.strokeStyle = '#3a6a2a'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-11, -5); ctx.quadraticCurveTo(3, -3, 13, 0);
      ctx.quadraticCurveTo(3, 3, -11, 5); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#b06ad0';
      ctx.beginPath(); ctx.arc(-4, 7, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(4, 8, 1.6, 0, Math.PI * 2); ctx.fill();
    } else {
      // 兜底：品质色圆点
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };

  // 辰龙飞行弹道：鎏金盘龙、鬃角与伸出的龙爪，局部坐标朝向 +x
  R.dragonClawBullet = function (ctx, t, scale) {
    var sway = Math.sin((t || 0) * 9) * 1.5;
    ctx.save();
    ctx.scale(scale || 1.25, scale || 1.25);
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#fce58a';
    ctx.lineWidth = 15;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-39, 3);
    ctx.quadraticCurveTo(-21, -15 + sway, -5, 3);
    ctx.quadraticCurveTo(10, 17 - sway, 25, -3);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 一条蜿蜒龙身，以深金描边和亮金鳞甲表现参考图中的鎏金质感
    ctx.strokeStyle = '#9c6810';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(-39, 3);
    ctx.quadraticCurveTo(-22, -16 + sway, -5, 3);
    ctx.quadraticCurveTo(10, 17 - sway, 25, -3);
    ctx.stroke();
    ctx.strokeStyle = '#efbd3e';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-39, 3);
    ctx.quadraticCurveTo(-22, -16 + sway, -5, 3);
    ctx.quadraticCurveTo(10, 17 - sway, 25, -3);
    ctx.stroke();
    ctx.strokeStyle = '#fff0a0';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-34, 1);
    ctx.quadraticCurveTo(-21, -11 + sway, -7, 3);
    ctx.quadraticCurveTo(9, 14 - sway, 22, -3);
    ctx.stroke();

    // 尾焰与脊鬃
    ctx.fillStyle = '#f7d66c';
    ctx.beginPath();
    ctx.moveTo(-37, 2);
    ctx.quadraticCurveTo(-48, -9, -43, -17);
    ctx.quadraticCurveTo(-35, -11, -34, -4);
    ctx.quadraticCurveTo(-28, -12, -25, -11);
    ctx.quadraticCurveTo(-27, -2, -34, 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3a8ad0';
    for (var sp = 0; sp < 6; sp++) {
      var sx = -22 + sp * 7;
      var sy = sp < 3 ? -8 + sp * 3 : 3 - (sp - 3) * 3;
      ctx.beginPath();
      ctx.moveTo(sx - 2, sy + 1);
      ctx.lineTo(sx + 1, sy - 6);
      ctx.lineTo(sx + 4, sy + 1);
      ctx.closePath();
      ctx.fill();
    }

    // Dragon head with swept horns, mane and a bright eye
    ctx.fillStyle = '#d99b22';
    ctx.strokeStyle = '#8a5b13';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(17, -8);
    ctx.quadraticCurveTo(24, -15, 31, -10);
    ctx.lineTo(39, -5);
    ctx.quadraticCurveTo(35, 0, 27, 1);
    ctx.quadraticCurveTo(20, 2, 16, -3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff0a0';
    ctx.beginPath();
    ctx.moveTo(21, -9);
    ctx.quadraticCurveTo(16, -19, 11, -17);
    ctx.quadraticCurveTo(15, -11, 18, -6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(27, -10);
    ctx.quadraticCurveTo(26, -19, 31, -20);
    ctx.quadraticCurveTo(30, -13, 31, -8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3a8ad0';
    ctx.beginPath();
    ctx.arc(29, -7, 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fce58a';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(31, -1);
    ctx.quadraticCurveTo(38, 1, 41, -2);
    ctx.moveTo(29, 0);
    ctx.quadraticCurveTo(34, 5, 39, 5);
    ctx.stroke();

    // Forward dragon paw with three curved claws
    ctx.strokeStyle = '#9c6810';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(17, -1);
    ctx.quadraticCurveTo(19, 7, 25, 10);
    ctx.stroke();
    ctx.fillStyle = '#f3ca58';
    ctx.beginPath();
    ctx.ellipse(26, 10, 5, 3.2, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff1b0';
    ctx.lineWidth = 1.8;
    for (var claw = -1; claw <= 1; claw++) {
      ctx.beginPath();
      ctx.moveTo(28, 10 + claw * 1.6);
      ctx.quadraticCurveTo(33, 12 + claw * 2, 35, 16 + claw * 2);
      ctx.stroke();
    }
    ctx.restore();
  };

  // 生肖武将基础弹道（未装备专属神器时的默认攻击特效，按生肖属性定制）
  // hero：武将名；已 translate+rotate 到弹头位置，朝向 +x 方向
  R.heroBaseBullet = function (ctx, hero, t) {
    var fx = (ZY.C && ZY.C.HERO_FX) ? ZY.C.HERO_FX[hero] : null;
    var c = fx ? fx.color : '#e8c53a';
    var a = fx ? fx.accent : '#8a6a10';
    var kind = fx ? fx.fx : 'dragon';
    ctx.save();
    if (kind === 'rat') {
      // 子鼠：机敏小鼠（椭圆身 + 圆耳 + 长尾）
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-6, -3.5, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = a;
      ctx.beginPath(); ctx.arc(4, -1, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = a; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.quadraticCurveTo(-14, -4, -18, 2); ctx.stroke();
    } else if (kind === 'ox') {
      // 丑牛：厚重牛角
      ctx.fillStyle = c; ctx.strokeStyle = a; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-10, 6); ctx.quadraticCurveTo(2, 3, 12, -7);
      ctx.quadraticCurveTo(3, 8, -10, 6); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f2e6cc';
      ctx.beginPath(); ctx.moveTo(12, -7); ctx.lineTo(6, -2); ctx.lineTo(9, 0); ctx.closePath(); ctx.fill();
    } else if (kind === 'tiger') {
      // 寅虎：猛虎利爪
      ctx.strokeStyle = c; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      for (var i2 = -1; i2 <= 1; i2++) {
        ctx.beginPath();
        ctx.moveTo(-7, i2 * 4);
        ctx.quadraticCurveTo(3, i2 * 5, 11, i2 * 7);
        ctx.stroke();
      }
      ctx.strokeStyle = a; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-1, -6); ctx.lineTo(-1, 6); ctx.stroke();
    } else if (kind === 'rabbit') {
      // 卯兔：月牙银箭
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(2, -8); ctx.quadraticCurveTo(15, 0, 2, 8);
      ctx.quadraticCurveTo(9, 0, 2, -8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = a; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(4, 0); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-12, 0); ctx.lineTo(-16, -3);
      ctx.moveTo(-12, 0); ctx.lineTo(-16, 3);
      ctx.stroke();
    } else if (kind === 'dragon') {
      R.dragonClawBullet(ctx, t);
    } else {
      // 巳蛇：蜿蜒灵蛇 + 吐信 + 毒滴
      ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-13, 0);
      for (var sx = -13; sx <= 8; sx += 4) {
        ctx.quadraticCurveTo(sx + 2, (sx % 8 === 0 ? -4 : 4), sx + 4, 0);
      }
      ctx.stroke();
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(11, 0, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = a; ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(14, 0); ctx.lineTo(18, -2);
      ctx.moveTo(14, 0); ctx.lineTo(18, 2);
      ctx.stroke();
      ctx.fillStyle = '#7fd06a';
      ctx.beginPath(); ctx.arc(3, 5, 1.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };

  R.inside = function (b, x, y) {
    return b && x >= b.x && x <= b.x + b.w && y <= b.y + b.h && y >= b.y;
  };


  ZY.R = R;
})();
