const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..');

function loadScript(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  delete require.cache[require.resolve(fullPath)];
  require(fullPath);
}

function createHarness() {
  const effects = [];
  globalThis.ZY = {
    adapter: { vibrate() {} },
    Battle: {
      fx(type, x, y, text, color) {
        effects.push({ type, x, y, text, color });
      }
    },
    Map: {
      cellCenter() {
        return { x: 0, y: 0 };
      }
    },
    R: {},
    UI: { toast() {} },
    sfx() {}
  };

  loadScript('js/config.js');
  loadScript('js/board.js');

  return { ZY: globalThis.ZY, effects };
}

function createZishuState(ZY, level = 1) {
  return {
    bench: [],
    units: {
      '0_0': ZY.Board.makeGeneralHalf('子鼠', '子', 0, '1_0', level, 'p'),
      '1_0': ZY.Board.makeGeneralHalf('子鼠', '鼠', 1, '0_0', level, 'p')
    }
  };
}

test('matching fragment upgrades the targeted general half and syncs the whole general level', () => {
  const { ZY } = createHarness();
  const state = createZishuState(ZY, 1);
  state.bench[0] = ZY.Board.makeFrag('子');

  const upgraded = ZY.Board.tryUpgradeGeneral(state, {
    from: { type: 'bench', idx: 0 },
    unit: state.bench[0]
  }, '0_0');

  assert.equal(upgraded, true);
  assert.equal(state.units['0_0'].lv, 2);
  assert.equal(state.units['1_0'].lv, 2);
  assert.equal(state.bench[0], null);
});

test('any fragment belonging to the general upgrades the whole general from either half', () => {
  const { ZY } = createHarness();
  const state = createZishuState(ZY, 1);
  state.bench[0] = ZY.Board.makeFrag('子');

  const upgraded = ZY.Board.tryUpgradeGeneral(state, {
    from: { type: 'bench', idx: 0 },
    unit: state.bench[0]
  }, '1_0');

  assert.equal(upgraded, true);
  assert.equal(state.units['0_0'].lv, 2);
  assert.equal(state.units['1_0'].lv, 2);
  assert.equal(state.bench[0], null);
});

test('whole general can continue upgrading after level five', () => {
  const { ZY } = createHarness();
  const state = createZishuState(ZY, 5);
  state.bench[0] = ZY.Board.makeFrag('鼠');

  const upgraded = ZY.Board.tryUpgradeGeneral(state, {
    from: { type: 'bench', idx: 0 },
    unit: state.bench[0]
  }, '0_0');

  assert.equal(upgraded, true);
  assert.equal(state.units['0_0'].lv, 6);
  assert.equal(state.units['1_0'].lv, 6);
  assert.equal(state.bench[0], null);
});

test('general stat growth slows after the early upgrade levels', () => {
  const { ZY } = createHarness();
  const levelFive = ZY.unitStats(ZY.Board.makeGeneralHalf('子鼠', '子', 0, '1_0', 5, 'p'));
  const levelSix = ZY.unitStats(ZY.Board.makeGeneralHalf('子鼠', '子', 0, '1_0', 6, 'p'));

  assert.ok(levelSix.dmg > levelFive.dmg);
  assert.ok(levelSix.dmg < Math.round(levelFive.dmg * 1.3));
  assert.ok(levelSix.itv < levelFive.itv);
  assert.ok(levelSix.itv > levelFive.itv * 0.9);
});
