// 战斗：双方阵地单位自动攻击本侧敌人；弹道、武将技、特效
(function () {
  var root = (typeof GameGlobal !== 'undefined') ? GameGlobal
    : (typeof globalThis !== 'undefined') ? globalThis
    : (typeof window !== 'undefined') ? window
    : (typeof self !== 'undefined') ? self : {};
  var ZY = root.ZY = root.ZY || {};
  var C = ZY.C, R = ZY.R;

  var BT = {};

  BT.reset = function () {
    var G = ZY.G;
    G.bullets = [];
    G.effects = [];
  };

  function auraMul(S) {
    for (var k in S.units) {
      if (S.units[k].kind === 'g' && S.units[k].name === '辰龙') return 1.2;
    }
    return 1;
  }

  function enemiesOf(side) {
    var G = ZY.G, out = [];
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (!e.dead && e.side === side) out.push(e);
    }
    return out;
  }

  function nearest(list, x, y, range) {
    var best = null, bd = Infinity;
    for (var i = 0; i < list.length; i++) {
      var d = Math.hypot(list[i].x - x, list[i].y - y);
      if (d <= range && d < bd) { bd = d; best = list[i]; }
    }
    return best;
  }

  function mostAdvanced(list, x, y, range) {
    var best = null, bs = -1;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      var d = Math.hypot(e.x - x, e.y - y);
      if (d > range) continue;
      var prog = e.seg + e.segT;
      if (prog > bs) { bs = prog; best = e; }
    }
    return best;
  }

  // 同步攻击动画到武将另一半（两字都显示攻击特效，但伤害只在 half=0 结算）
  function syncAttackT(S, u, t) {
    u.attackT = t;
    if (u.kind === 'g' && u.pairedKey && S.units[u.pairedKey]) {
      S.units[u.pairedKey].attackT = t;
    }
  }

  function updateSide(S, side, dt) {
    var L = ZY.L, G = ZY.G;
    var list = enemiesOf(side);
    var aura = auraMul(S);

    ZY.Board.eachUnit(S, function (u, c, r) {
      var st = ZY.unitStats(u);
      if (st.inert) return;
      // 武将半身：只让 half=0 发起攻击，避免双倍伤害；但 half=1 仍衰减攻击动画
      if (u.kind === 'g' && u.half != null && u.half !== 0) {
        if (u.attackT > 0) u.attackT -= dt;
        return;
      }
      if (u.attackT > 0) u.attackT -= dt; // 攻击变形动画计时
      u.cd -= dt;
      if (u.cd > 0) return;
      if (!list.length) { u.cd = 0.08; return; }
      var p = ZY.Map.cellCenter(c, r);
      var range = st.range * L.cell;
      var dmg = Math.round(st.dmg * aura);

      if (st.skill === 'stun') {
        var hitAny = false;
        for (var i = 0; i < list.length; i++) {
          var e = list[i];
          if (Math.hypot(e.x - p.x, e.y - p.y) <= range) {
            ZY.Enemies.damage(e, dmg, { stun: 1.0 });
            hitAny = true;
          }
        }
        if (hitAny) {
          u.cd = st.itv;
          syncAttackT(S, u, 0.35); // 触发文字变形（两字同步）
          BT.fx('oxcharge', p.x, p.y, range);
          if (side === 'p') ZY.sfx('shoot');
        } else u.cd = 0.08;
        return;
      }

      if (st.skill === 'pierce') {
        var t0 = mostAdvanced(list, p.x, p.y, range);
        if (!t0) { u.cd = 0.08; return; }
        u.cd = st.itv;
        syncAttackT(S, u, 0.35); // 触发文字变形（两字同步）
        // 贯穿：目标连线上的敌人全部命中
        var ang = Math.atan2(t0.y - p.y, t0.x - p.x);
        BT.fx('ratwave', p.x, p.y, ang, range);
        if (side === 'p') ZY.sfx('shoot');
        for (var j = 0; j < list.length; j++) {
          var e2 = list[j];
          var d2 = Math.hypot(e2.x - p.x, e2.y - p.y);
          if (d2 > range) continue;
          var a2 = Math.atan2(e2.y - p.y, e2.x - p.x);
          var diff = Math.abs(((a2 - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (diff < 0.22) { ZY.Enemies.damage(e2, dmg); BT.fx('ratbite', e2.x, e2.y); }
        }
        return;
      }

      var target = mostAdvanced(list, p.x, p.y, range);
      if (!target) { u.cd = 0.08; return; }
      u.cd = st.itv;
      syncAttackT(S, u, 0.35); // 触发文字变形（两字同步）
      var exec = st.skill === 'execute' && !target.boss && target.hp / target.maxHp < 0.35;
      G.bullets.push({
        x: p.x, y: p.y - L.cell * 0.2,
        target: target,
        spd: (st.skill === 'snipe' ? 16 : 11) * L.cell,
        dmg: exec ? target.hp + 1 : dmg,
        exec: exec,
        poison: st.skill === 'venom',
        arrow: u.kind === 's' && u.ch === '翼' || st.skill === 'snipe',
        gold: u.kind === 'g',
        hero: u.kind === 'g' ? u.name : null,
        shape: u.kind === 's' ? u.ch : (st.skill === 'snipe' ? '翼' : null),
        weaponShape: st.weaponShape || null,
        weaponColor: st.weapon ? C.WEAPON_QUALITY[st.weapon.quality].color : null
      });
      if (st.skill === 'snipe') BT.fx('moonflash', p.x, p.y, Math.atan2(target.y - p.y, target.x - p.x));
      if (side === 'p') ZY.sfx('shoot');
    });
  }

  BT.update = function (dt) {
    var G = ZY.G;
    updateSide(G.p, 'p', dt);
    if (!ZY.Online || !ZY.Online.shouldSkipOpponentSimulation || !ZY.Online.shouldSkipOpponentSimulation()) {
      updateSide(G.e, 'e', dt);
    }

    for (var b = G.bullets.length - 1; b >= 0; b--) {
      var bl = G.bullets[b];
      if (bl.target.dead) { G.bullets.splice(b, 1); continue; }
      var dx = bl.target.x - bl.x, dy = bl.target.y - bl.y;
      var d = Math.hypot(dx, dy);
      var step = bl.spd * dt;
      if (d <= step) {
        ZY.Enemies.damage(bl.target, bl.dmg, bl.poison ? { slow: 1.5 } : null);
        if (bl.poison) BT.fx('poison', bl.target.x, bl.target.y);
        else if (bl.exec) {
          BT.fx('tigerclaw', bl.target.x, bl.target.y);
          BT.fx('text', bl.target.x, bl.target.y - 40, '斩!', '#8a2a1e');
        } else BT.fx('hit', bl.target.x, bl.target.y);
        G.bullets.splice(b, 1);
      } else {
        bl.ang = Math.atan2(dy, dx);
        bl.x += dx / d * step;
        bl.y += dy / d * step;
      }
    }

    for (var f = G.effects.length - 1; f >= 0; f--) {
      G.effects[f].t += dt;
      if (G.effects[f].t >= G.effects[f].dur) G.effects.splice(f, 1);
    }
  };

  BT.fx = function (type, x, y, a, b) {
    var dur = {
      ink: 0.45, hit: 0.22, text: 1.0, slash: 0.28, lance: 0.25, roar: 0.4, summon: 0.9,
      // 生肖专属特效
      ratwave: 0.5, ratbite: 0.26, oxcharge: 0.55, tigerclaw: 0.42, poison: 0.75, moonflash: 0.35
    }[type] || 0.5;
    ZY.G.effects.push({ type: type, x: x, y: y, a: a, b: b, t: 0, dur: dur });
  };

  BT.draw = function (ctx) {
    var G = ZY.G;

    // 弹道（按兵种绘制不同武器造型）
    for (var i = 0; i < G.bullets.length; i++) {
      var bl = G.bullets[i];
      ctx.save();
      ctx.translate(bl.x, bl.y);
      ctx.rotate(bl.ang || 0);
      // 武将：生肖专属弹道（装备神器时叠加该神器的生肖造型）
      if (bl.hero) {
        if (bl.weaponShape && R.drawWeaponBullet) R.drawWeaponBullet(ctx, bl.weaponShape, bl.weaponColor, true, bl.hero);
        else if (R.heroBaseBullet) R.heroBaseBullet(ctx, bl.hero, G.time);
      } else if (bl.weaponShape && R.drawWeaponBullet) {
        // 士兵装备武器：用武器专属弹道造型
        R.drawWeaponBullet(ctx, bl.weaponShape, bl.weaponColor, bl.gold);
      } else {
        var sh = bl.shape, isGold = bl.gold;
        var metal = isGold ? '#b8860b' : '#3a3126';
        var blade = isGold ? '#e8c53a' : '#c8c8d0';
        if (sh === '爪') {
          // 爪：三道利爪
          ctx.strokeStyle = blade; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
          for (var cl = -1; cl <= 1; cl++) {
            ctx.beginPath();
            ctx.moveTo(-6, cl * 4);
            ctx.quadraticCurveTo(4, cl * 5, 11, cl * 7);
            ctx.stroke();
          }
        } else if (sh === '角') {
          // 角：粗壮弯角
          ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 5; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-10, 4); ctx.quadraticCurveTo(2, 0, 11, -5); ctx.stroke();
          ctx.strokeStyle = metal; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(-10, 4); ctx.quadraticCurveTo(2, 0, 11, -5); ctx.stroke();
        } else if (sh === '牙') {
          // 牙：獠牙
          ctx.fillStyle = metal; ctx.fillRect(-12, -2, 4, 4);
          ctx.fillStyle = blade;
          ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(13, 0); ctx.lineTo(-8, 4); ctx.closePath(); ctx.fill();
        } else if (sh === '翼') {
          // 翼：羽箭
          ctx.strokeStyle = metal; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(7, 0); ctx.stroke();
          ctx.fillStyle = blade;
          ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(5, -4); ctx.lineTo(5, 4); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#8a6a10'; ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-10, 0); ctx.lineTo(-13, -3);
          ctx.moveTo(-10, 0); ctx.lineTo(-13, 3);
          ctx.stroke();
        } else {
          ctx.fillStyle = isGold ? '#b8860b' : '#3a3126';
          ctx.beginPath(); ctx.arc(0, 0, isGold ? 6 : 4.5, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
    }

    // 辰龙「龙腾祥瑞」：为同侧友军提供攻击加成，绘制盘龙金色光环
    ['p', 'e'].forEach(function (side) {
      var S = side === 'p' ? G.p : G.e;
      if (!S || !S.units || !ZY.Board || !ZY.Board.eachUnit) return;
      ZY.Board.eachUnit(S, function (u, c, r) {
        if (u.kind !== 'g' || u.name !== '辰龙') return;
        if (u.half != null && u.half !== 0) return; // 半身只画一次
        var st = ZY.unitStats(u);
        if (!st || !st.range) return;
        var p = ZY.Map.cellCenter(c, r);
        var t = G.time;
        var rad = st.range * ZY.L.cell;
        ctx.save();
        // 旋转虚线光环
        ctx.globalAlpha = 0.5 + Math.sin(t * 3) * 0.15;
        ctx.strokeStyle = '#f0c850';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.lineDashOffset = -t * 30;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        // 上升的龙气金珠
        ctx.globalAlpha = 0.65;
        for (var s2 = 0; s2 < 5; s2++) {
          var ang = t * 1.2 + s2 / 5 * Math.PI * 2;
          var rx = p.x + Math.cos(ang) * rad * 0.7;
          var ry = p.y + Math.sin(ang) * rad * 0.5 - ((t * 40 + s2 * 20) % 60);
          ctx.fillStyle = '#fce58a';
          ctx.beginPath();
          ctx.arc(rx, ry, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
    });

    // 特效
    for (var f = 0; f < G.effects.length; f++) {
      var fx = G.effects[f];
      var k = fx.t / fx.dur;
      ctx.save();
      if (fx.type === 'ink') {
        ctx.globalAlpha = 0.5 * (1 - k);
        ctx.fillStyle = '#2b241a';
        for (var d = 0; d < 5; d++) {
          var ang = d * 1.256 + fx.x * 0.1;
          ctx.beginPath();
          ctx.arc(fx.x + Math.cos(ang) * 26 * k, fx.y + Math.sin(ang) * 26 * k, 7 * (1 - k) + 2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (fx.type === 'hit') {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#b04a2e';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, 8 + 18 * k, 0, Math.PI * 2);
        ctx.stroke();
      } else if (fx.type === 'text') {
        ctx.globalAlpha = 1 - k * k;
        ctx.fillStyle = fx.b || '#2b241a';
        R.font(ctx, 26, true);
        ctx.textAlign = 'center';
        ctx.fillText(fx.a, fx.x, fx.y - 36 * k);
      } else if (fx.type === 'slash') {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#8a2a1e';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(fx.x - 18 + 36 * k, fx.y - 18);
        ctx.lineTo(fx.x + 18 - 36 * k + 14, fx.y + 18);
        ctx.stroke();
      } else if (fx.type === 'lance') {
        ctx.globalAlpha = 0.7 * (1 - k);
        ctx.translate(fx.x, fx.y);
        ctx.rotate(fx.a);
        var grd = ctx.createLinearGradient(0, 0, fx.b, 0);
        grd.addColorStop(0, 'rgba(138,42,30,0.9)');
        grd.addColorStop(1, 'rgba(138,42,30,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, -5 * (1 - k) - 2, fx.b, 10 * (1 - k) + 4);
      } else if (fx.type === 'roar') {
        ctx.globalAlpha = 0.55 * (1 - k);
        ctx.strokeStyle = '#3a3126';
        ctx.lineWidth = 5 * (1 - k) + 1;
        for (var rr = 0; rr < 3; rr++) {
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, (40 + rr * 36) * k + 14, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (fx.type === 'ratwave') {
        // 子鼠·鼠群突袭：金色突袭光带 + 成群鼠影沿路径奔袭
        ctx.translate(fx.x, fx.y);
        ctx.rotate(fx.a || 0);
        var rg = ctx.createLinearGradient(0, 0, fx.b, 0);
        rg.addColorStop(0, 'rgba(216,180,90,0.85)');
        rg.addColorStop(1, 'rgba(216,180,90,0)');
        ctx.globalAlpha = 0.7 * (1 - k);
        ctx.fillStyle = rg;
        ctx.fillRect(0, -10, fx.b, 20);
        ctx.globalAlpha = 1 - k;
        var reach = fx.b * Math.min(1, k * 1.4);
        for (var ri = 0; ri < 5; ri++) {
          var rx2 = reach - ri * 34;
          if (rx2 < 4) continue;
          var ry2 = (ri % 2 ? -6 : 6);
          ctx.fillStyle = '#a8862a';
          ctx.beginPath(); ctx.ellipse(rx2, ry2, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(rx2 - 5, ry2 - 3, 2.6, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#a8862a'; ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(rx2 - 7, ry2);
          ctx.quadraticCurveTo(rx2 - 12, ry2 - 4, rx2 - 15, ry2 + 2);
          ctx.stroke();
        }
      } else if (fx.type === 'ratbite') {
        // 子鼠·鼠噬：三道金色爪痕
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#d8b45a';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        for (var bi = -1; bi <= 1; bi++) {
          ctx.beginPath();
          ctx.moveTo(fx.x - 9, fx.y + bi * 5);
          ctx.quadraticCurveTo(fx.x, fx.y + bi * 6, fx.x + 9, fx.y + bi * 8);
          ctx.stroke();
        }
      } else if (fx.type === 'oxcharge') {
        // 丑牛·蛮牛冲撞：沉重的褐色冲击波 + 扬尘
        var maxR = Math.max(30, fx.a || 120);
        ctx.globalAlpha = 0.7 * (1 - k);
        ctx.strokeStyle = '#a8703a';
        ctx.lineWidth = 6 * (1 - k) + 2;
        for (var orr = 0; orr < 2; orr++) {
          var orad = maxR * k - orr * 22;
          if (orad <= 1) continue;
          ctx.beginPath(); ctx.arc(fx.x, fx.y, orad, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.globalAlpha = 0.6 * (1 - k);
        ctx.fillStyle = '#8a6a4a';
        for (var oc = 0; oc < 6; oc++) {
          var oa = oc / 6 * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(fx.x + Math.cos(oa) * maxR * k, fx.y + Math.sin(oa) * maxR * k, 4 * (1 - k) + 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (fx.type === 'tigerclaw') {
        // 寅虎·猛虎扑杀：三道橙红虎爪裂痕
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#e8902a';
        ctx.lineWidth = 5 * (1 - k) + 2;
        ctx.lineCap = 'round';
        for (var tc = -1; tc <= 1; tc++) {
          ctx.beginPath();
          ctx.moveTo(fx.x - 22 + tc * 6, fx.y - 22 + tc * 2);
          ctx.quadraticCurveTo(fx.x + tc * 4, fx.y + tc * 4, fx.x + 20 + tc * 6, fx.y + 20 + tc * 2);
          ctx.stroke();
        }
        ctx.strokeStyle = '#8a3a1a';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(fx.x, fx.y, 10 + 20 * k, 0, Math.PI * 2); ctx.stroke();
      } else if (fx.type === 'poison') {
        // 巳蛇·毒蛇缠绕：毒雾 + 冒泡 + 毒液下坠
        ctx.globalAlpha = 0.7 * (1 - k);
        ctx.fillStyle = 'rgba(120,200,90,0.45)';
        ctx.beginPath(); ctx.arc(fx.x, fx.y, 10 + 30 * k, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.9 * (1 - k);
        for (var pb = 0; pb < 5; pb++) {
          var pa = pb / 5 * Math.PI * 2 + k * 2;
          var pd = 8 + 22 * k;
          ctx.fillStyle = pb % 2 ? '#8fd45a' : '#5aa83a';
          ctx.beginPath();
          ctx.arc(fx.x + Math.cos(pa) * pd, fx.y + Math.sin(pa) * pd - 14 * k, 3.2 * (1 - k) + 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = '#5aa83a';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(fx.x, fx.y + 18 * k); ctx.stroke();
      } else if (fx.type === 'moonflash') {
        // 卯兔·月兔疾跃：出膛月牙闪光
        ctx.translate(fx.x, fx.y);
        ctx.rotate(fx.a || 0);
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#dceaf8';
        ctx.lineWidth = 5 * (1 - k) + 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 12 + 26 * k, -Math.PI * 0.45, Math.PI * 0.45);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(6, 0); ctx.lineTo(26 + 20 * k, 0);
        ctx.stroke();
      } else if (fx.type === 'summon') {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#c9922e';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, 16 + 66 * k, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = (1 - k) * 0.3;
        ctx.fillStyle = '#e8c53a';
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, 16 + 66 * k, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  };

  ZY.Battle = BT;
})();
