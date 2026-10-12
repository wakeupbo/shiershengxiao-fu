const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..');

function loadScript(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  delete require.cache[require.resolve(fullPath)];
  require(fullPath);
}

function createHarness(initialStorage = {}) {
  const storage = { ...initialStorage };
  globalThis.ZY = {
    adapter: {
      storageGet(key) {
        return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null;
      },
      storageSet(key, value) {
        storage[key] = String(value);
      }
    }
  };
  loadScript('js/config.js');
  loadScript('js/weapon.js');
  return { ZY: globalThis.ZY, storage };
}

function weaponIdsByQuality(ZY, quality) {
  return ZY.C.WEAPONS
    .filter((weapon) => weapon.quality === quality)
    .map((weapon) => weapon.id);
}

function assertRedeemQuality(code, expectedQuality) {
  const { ZY } = createHarness();
  const expectedWeaponIds = weaponIdsByQuality(ZY, expectedQuality);

  assert.equal(ZY.Weapon.isLibraryUnlocked(), false);
  const result = ZY.Weapon.redeemCode(` ${code.toUpperCase()} `);

  assert.equal(result.ok, true);
  assert.equal(result.code, code);
  assert.equal(result.quality, expectedQuality);
  assert.deepEqual(result.weaponIds.sort(), expectedWeaponIds.sort());
  assert.deepEqual(ZY.Weapon.state().owned.sort(), expectedWeaponIds.sort());
  assert.equal(ZY.Weapon.isLibraryUnlocked(), true);
}

test('redeem codes unlock the weapon library and grant every weapon in the mapped quality', () => {
  assertRedeemQuality('maojunzc666', 'blue');
  assertRedeemQuality('maojunzc888', 'purple');
  assertRedeemQuality('maojunzc999', 'orange');
});

test('redeem code can only be claimed once', () => {
  const { ZY } = createHarness();
  const expectedWeaponIds = weaponIdsByQuality(ZY, 'orange');

  const first = ZY.Weapon.redeemCode('maojunzc999');
  const second = ZY.Weapon.redeemCode('maojunzc999');

  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'used');
  assert.deepEqual(ZY.Weapon.state().owned.sort(), expectedWeaponIds.sort());
});

test('invalid redeem code does not unlock the weapon library', () => {
  const { ZY } = createHarness();

  const result = ZY.Weapon.redeemCode('wrong-code');

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid');
  assert.equal(ZY.Weapon.isLibraryUnlocked(), false);
  assert.deepEqual(ZY.Weapon.state().owned, []);
});

test('existing weapon progress keeps the library unlocked after migration', () => {
  const storedWeapons = JSON.stringify({ owned: ['qingfeng'], frags: {}, equip: {} });
  const { ZY } = createHarness({ zy_weapons: storedWeapons });

  assert.equal(ZY.Weapon.isLibraryUnlocked(), true);
});