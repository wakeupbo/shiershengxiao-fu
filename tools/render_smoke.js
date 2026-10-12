'use strict';
// 渲染层冒烟测试：用 no-op canvas ctx 调用所有绘制函数，
// 覆盖 5 张地图主题 / 4 种兵种 / 6 位武将 / 5 个头像 / 全部武器弹道，
// 捕获任何运行时异常（Node 环境无需真实 Canvas）。
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const JS_DIR = path.join(ROOT, 'js');

function makeCtx() {
  const grad = { addColorStop() {} };
  const handler = {
    get(target, prop) {
      if (prop === 'measureText') return () => ({ width: 0 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createPattern') return () => grad;
      if (prop === 'canvas') return {};
      if (typeof prop === 'symbol') return undefined;
      if (!(prop in target)) target[prop] = function () {};
      return target[prop];
    },
    set(target, prop, value) { target[prop] = value; return true; }
  };
  return new Proxy({}, handler);
}

const noopCtx = makeCtx();
const sandbox = { console };
sandbox.ZY = {
  adapter: {
    env: 'sim', DW: 750, DH: 1334, hasScreen: false,
    createOffCanvas(w, h) { return { width: w, height: h, getContext() { return makeCtx(); } }; },
    storageGet() { return null; }, storageSet() {},
    on() {}, raf() { return 0; }, vibrate() {}
  },
  sfx() {}, sfxToggle() {}, sfxEnabled() { return false; },
  UI: { toast() {} },
  Battle: { fx() {} }
};
vm.createContext(sandbox);
function load(name) {
  vm.runInContext(fs.readFileSync(path.join(JS_DIR, name), 'utf8'), sandbox, { filename: name });
}
['config.js', 'rank.js', 'map.js', 'render.js', 'board.js', 'weapon.js', 'battle.js', 'ui.js'].forEach(load);

const ZY = sandbox.ZY;
const C = ZY.C, R = ZY.R, Map = ZY.Map;
if (ZY.Map.__file) { /* noop */ }
const ctx = noopCtx;

let calls = 0;
function run(label, fn) {
  try { fn(); calls++; }
  catch (e) { throw new Error('[' + label + '] ' + e.stack); }
}

// 布局 mock（部分函数依赖 ZY.L）
ZY.L = { cell: 60, mapX: 20, mapY: 120, mapW: 480, mapH: 600, benchX: 60, benchY: 760, benchSlot: 92, benchGap: 10, btnY: 900, topBar: 128 };

// 遍历 5 张地图主题
for (let mi = 0; mi < 5; mi++) {
  run('resetUnlockable#' + mi, () => Map.resetUnlockable(mi));
  Map.ensureMarked();
  run('paper#' + mi, () => R.paper(ctx, 750, 1334));
  run('tiles#' + mi, () => {
    for (let r = 0; r < Map.ROWS; r++) {
      for (let c = 0; c < Map.COLS; c++) {
        const x = c * 60, y = r * 60, seed = c * 31 + r * 17 + 5;
        if (Map.cellType[c + '_' + r] === 'path') R.tilePath(ctx, x, y, 60, seed);
        else R.tileGreen(ctx, x, y, 60, seed);
      }
    }
    R.tileWhite(ctx, 0, 0, 60);
    R.pathStones(ctx, 0, 0, 400, 0);
    R.pathStones(ctx, 0, 0, 0, 400);
    R.bush(ctx, 100, 100, 50);
  });
}

// 令牌：四兵种 + 金色碎片 + 武将 + 敌人 + 铲子
run('tokens', () => {
  C.SOLDIER_CHARS.forEach((ch) => {
    R.mahjong(ctx, 0, 0, 50, ch, {});
    R.mahjong(ctx, 0, 0, 50, ch, { lv: 3, hl: true });
  });
  C.FRAG_CHARS.forEach((ch) => R.mahjong(ctx, 0, 0, 50, ch, { gold: true }));
  Object.keys(C.GENERALS).forEach((g) => R.livingTile(ctx, 0, 0, 50, g, 'general', 1.2));
  ['狸', '豺', '獠', '狐', '年'].forEach((ch) => {
    R.enemyTile(ctx, 0, 0, 50, ch, 0.5, ch === '年');
  });
  R.shovelTile(ctx, 0, 0, 50, {});
});

// 守将 / 心 / 冠 / 金环 / 光晕
run('guardian', () => { R.heart(ctx, 0, 0, 30, true); R.heart(ctx, 0, 0, 30, false); R.crown(ctx, 0, 0, 30); R.adou(ctx, 0, 0, 80, 2, 3, true); R.inkHalo(ctx, 0, 0, 60, 1.5); R.goldRing(ctx, 0, 0, 40, 1); R.ornament(ctx, 0, 0, 130, 1); });
run('monk', () => R.monk(ctx, 0, 0, 110, 3, 3, false, 1.4, 0.5));
run('hud-icons', () => { R.bun(ctx, 0, 0, 20); R.hut(ctx, 0, 0, 60); R.star(ctx, 0, 0, 24, true); R.cloud(ctx, 0, 0, 300, 80, '#b08a3e'); R.scroll(ctx, 0, 0, 400, 110); });

// 文字变形（兵器形态）
run('morph-soldiers', () => { C.SOLDIER_CHARS.forEach((ch) => R.morphTile(ctx, 0, 0, 50, ch, 's', 0.2)); });
run('morph-general', () => { Object.keys(C.GENERALS).forEach((g) => R.morphTile(ctx, 0, 0, 50, g, 'g', 0.2)); });

// 头像（5 生肖）
run('avatars', () => { C.AVATARS.forEach((id) => R.avatar(ctx, 0, 0, 42, id, true)); });

// 按钮 / 范围圈 / 武器弹道
run('buttons', () => { R.redButton(ctx, { x: 0, y: 0, w: 200, h: 90, label: '征兵', fs: 40, bun: 10 }); R.darkButton(ctx, { x: 0, y: 0, w: 200, h: 90, label: '返回', fs: 30 }); });
run('range-circle', () => { R.rangeCircle(ctx, 0, 0, 120, 'p'); R.rangeCircle(ctx, 0, 0, 120, 'e'); });
run('weapon-bullets', () => {
  const shapes = ['staff', 'rake', 'monkspade', 'crosier', 'pearl', 'fan', 'gourd', 'vase', 'rope', 'sword', 'knife', 'spear', 'bow', 'shield', 'whip', 'axe',
    'claw', 'horn', 'tigerfang', 'moonarrow', 'dragonpearl', 'venomfang'];
  shapes.forEach((s) => R.drawWeaponBullet(ctx, s, '#e8a23a', true));
  // 装备到各生肖武将（触发生肖化配色）
  C.GENERAL_NAMES.forEach((hero) => {
    const fx = C.HERO_FX[hero];
    R.drawWeaponBullet(ctx, fx.weapon, C.WEAPON_QUALITY.orange.color, true, hero);
  });
});

// 生肖武将基础弹道（未装备神器）
run('hero-base-bullets', () => {
  Object.keys(C.HERO_FX).forEach((hero) => R.heroBaseBullet(ctx, hero, 1.5));
});

// battle.js 绘制：所有生肖专属特效 + 武将弹道 + 辰龙光环
run('battle.draw', () => {
  const BT = ZY.Battle;
  const mkEnemy = (x, y) => ({ x, y, hp: 100, maxHp: 100, size: 40, seg: 0, segT: 0, dead: false, boss: false, ch: '狸' });
  const en = mkEnemy(100, 100);
  ZY.G = {
    time: 1.5,
    bullets: [
      { x: 40, y: 40, ang: 0.3, shape: '爪', gold: false, dmg: 10 },
      { x: 50, y: 50, ang: 0.3, shape: '翼', gold: false, dmg: 10 },
      { x: 60, y: 60, ang: 0.2, hero: '辰龙', gold: true, dmg: 10 },
      { x: 70, y: 70, ang: 0.2, hero: '巳蛇', gold: true, dmg: 10 },
      { x: 80, y: 80, ang: 0.2, hero: '辰龙', gold: true, weaponShape: 'dragonpearl', weaponColor: '#e8a23a', dmg: 10 },
      { x: 90, y: 90, ang: 0.2, hero: '子鼠', gold: true, weaponShape: 'claw', weaponColor: '#e8a23a', dmg: 10 }
    ],
    effects: [],
    enemies: [en],
    p: { units: {}, hearts: 3, mantou: 10 },
    e: { units: {}, hearts: 3, mantou: 10 }
  };
  // 各生肖技能特效
  ['ink', 'hit', 'text', 'slash', 'lance', 'roar', 'summon',
    'ratwave', 'ratbite', 'oxcharge', 'tigerclaw', 'poison'].forEach((t) => {
    BT.fx(t, 120, 120, 0.4, 180);
  });
  BT.draw(ctx);
  // 辰龙光环：放置一个辰龙半身 + 一个巳蛇半身
  ZY.G.p.units['2_6'] = ZY.Board.makeGeneralHalf('辰龙', '辰', 0, '3_6', 1, 'p');
  ZY.G.p.units['3_6'] = ZY.Board.makeGeneralHalf('辰龙', '龙', 1, '2_6', 1, 'p');
  ZY.G.e.units['1_2'] = ZY.Board.makeGeneralHalf('巳蛇', '巳', 0, '2_2', 1, 'e');
  ZY.Map.ensureMarked();
  BT.draw(ctx);
});

// board.drawUnit（兵种 / 碎片 / 武将半身 / 整武将 / 铲子）
run('board.drawUnit', () => {
  const B = ZY.Board;
  C.SOLDIER_CHARS.forEach((ch) => B.drawUnit(ctx, B.makeSoldier(ch, 2), 0, 0, 50, 1));
  B.drawUnit(ctx, B.makeFrag('子'), 0, 0, 50, 1);
  B.drawUnit(ctx, B.makeShovel(), 0, 0, 50, 1);
  B.drawUnit(ctx, B.makeGeneralHalf('子鼠', '子', 0, '1_0', 2, 'p'), 0, 0, 50, 1);
  B.drawUnit(ctx, B.makeGeneral('子鼠'), 0, 0, 50, 1);
});

// UI 界面（开始页 / HUD / 结算 / 暂停 / 武器库 6 槽）
run('ui.screens', () => {
  const UI = ZY.UI, B = ZY.Board;
  ZY.frameTime = () => 1.5;
  UI.currentAvatar = () => C.AVATAR_DEFAULT;
  ZY.G = {
    time: 1, bullets: [], effects: [], enemies: [],
    wave: 2, waveState: 'idle', restTimer: 4, coinReward: 6, online: false,
    p: Object.assign(B.newSide(), { bench: new Array(C.ECON.benchSize).fill(null) }),
    e: Object.assign(B.newSide(), { bench: new Array(C.ECON.benchSize).fill(null) })
  };
  ZY.G.p.bench[0] = B.makeSoldier('爪', 2);
  ZY.G.p.bench[1] = B.makeFrag('子');
  ZY.G.p.units['2_7'] = B.makeGeneralHalf('辰龙', '辰', 0, '3_7', 1, 'p');
  ZY.G.e.units['2_2'] = B.makeGeneralHalf('巳蛇', '巳', 0, '3_2', 1, 'e');
  UI.drawStart(ctx);
  UI.drawHUD(ctx);
  UI.drawPause(ctx);
  UI.drawOver(ctx, true);
  UI.drawWeaponLib(ctx);
  UI.drawAvatarPicker(ctx);
});

// 武器库槽位应为 6（每位生肖一个）
run('weapon-slots-6', () => {
  if (ZY.UI.weaponSlots.length !== C.GENERAL_NAMES.length) {
    throw new Error('weapon slots=' + ZY.UI.weaponSlots.length + ' expected ' + C.GENERAL_NAMES.length);
  }
});

console.log('render smoke OK: ' + calls + ' draw groups executed without errors');
