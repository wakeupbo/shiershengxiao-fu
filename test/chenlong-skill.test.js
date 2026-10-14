const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..');

function loadScript(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  delete require.cache[require.resolve(fullPath)];
  require(fullPath);
}

test('Chen Long fires a fireball from the circling dragon mouth toward its target', () => {
  globalThis.ZY = {
    L: { cell: 60 },
    Map: {
      cellCenter(c, r) {
        return { x: c * 60 + 30, y: r * 60 + 30 };
      }
    },
    Board: {
      eachUnit(side, callback) {
        Object.keys(side.units).forEach((key) => {
          const [c, r] = key.split('_').map(Number);
          callback(side.units[key], c, r, key);
        });
      }
    },
    Enemies: { damage() {} },
    unitStats() {
      return { inert: false, range: 2.6, dmg: 36, itv: 1, skill: 'aura' };
    },
    sfx() {}
  };

  loadScript('js/config.js');
  loadScript('js/chenlong-skill.js');
  loadScript('js/battle.js');
  const ZY = globalThis.ZY;
  const head = {
    kind: 'g', name: '辰龙', ch: '辰', half: 0, pairedKey: '1_0', cd: 0, attackT: 0
  };
  const tail = {
    kind: 'g', name: '辰龙', ch: '龙', half: 1, pairedKey: '0_0', cd: 0, attackT: 0
  };
  const target = { x: 130, y: 30, side: 'p', dead: false, seg: 0, segT: 0, hp: 100, maxHp: 100 };
  ZY.G = {
    time: 0,
    p: { units: { '0_0': head, '1_0': tail } },
    e: { units: {} },
    enemies: [target],
    bullets: [],
    effects: []
  };

  ZY.Battle.update(0);

  const projectile = ZY.G.bullets[0];
  assert.ok(projectile);
  assert.equal(projectile.hero, '辰龙');
  assert.equal(projectile.fireball, true);
  assert.equal(projectile.spd, 480);
  const pairCenterX = (ZY.Map.cellCenter(0, 0).x + ZY.Map.cellCenter(1, 0).x) / 2;
  const pairCenterY = (ZY.Map.cellCenter(0, 0).y + ZY.Map.cellCenter(1, 0).y) / 2;
  const angle = Math.atan2(target.y - ZY.ChenLongSkill.dragonCenter(pairCenterX, pairCenterY, 48, 0).y,
    target.x - pairCenterX);
  const mouth = ZY.ChenLongSkill.mouthPosition(pairCenterX, pairCenterY, 48, angle, 0);
  assert.equal(projectile.x, mouth.x);
  assert.equal(projectile.y, mouth.y);
  assert.equal(head.attackAngle, angle);

  delete globalThis.ZY;
});
