const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..');

function loadScript(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  delete require.cache[require.resolve(fullPath)];
  require(fullPath);
}

function createHarness({ onlineActive }) {
  let matchEndCalls = 0;
  globalThis.ZY = {};
  loadScript('js/config.js');
  Object.assign(globalThis.ZY, {
    L: { cell: 1 },
    Main: {
      matchEnd() {
        matchEndCalls += 1;
      }
    },
    Map: {
      pathPoints() {
        return [{ x: 0, y: 0 }, { x: 1, y: 0 }];
      }
    },
    Online: onlineActive
      ? { shouldSkipOpponentSimulation: () => true }
      : null,
    Battle: { fx() {} },
    UI: { toast() {} },
    sfx() {}
  });
  loadScript('js/enemies.js');
  globalThis.ZY.G = {
    enemies: [],
    e: { hearts: 3, mantou: 0 },
    p: { hearts: 3, mantou: 0 },
    restTimer: 0,
    spawnQueue: [],
    spawnTimer: 0,
    wave: globalThis.ZY.C.MAX_WAVE,
    waveState: 'cleared'
  };
  return {
    ZY: globalThis.ZY,
    matchEndCalls: () => matchEndCalls
  };
}

test('solo mode ends after the configured final wave', () => {
  const harness = createHarness({ onlineActive: false });

  harness.ZY.Enemies.update(0.1);

  assert.equal(harness.matchEndCalls(), 1);
  assert.equal(harness.ZY.G.wave, harness.ZY.C.MAX_WAVE);
});

test('online pvp continues past the solo final wave', () => {
  const harness = createHarness({ onlineActive: true });

  harness.ZY.Enemies.update(0.1);

  assert.equal(harness.matchEndCalls(), 0);
  assert.equal(harness.ZY.G.wave, harness.ZY.C.MAX_WAVE + 1);
  assert.equal(harness.ZY.G.waveState, 'spawning');
});