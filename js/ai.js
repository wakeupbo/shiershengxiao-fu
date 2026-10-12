// AI 操作逻辑：对手侧自动运营；也供 ?bot=1 挂机调试驱动玩家侧
(function () {
  var root = (typeof GameGlobal !== 'undefined') ? GameGlobal
    : (typeof globalThis !== 'undefined') ? globalThis
    : (typeof window !== 'undefined') ? window
    : (typeof self !== 'undefined') ? self : {};
  var ZY = root.ZY = root.ZY || {};

  var AI = {};
  var thinkT = 0;

  // 基础难度参数（最低档）
  var THINK_ITV = 1.25;
  var MISS_RATE = 0.28;

  AI.reset = function () { thinkT = 2.0; curDiff._cached = false; };

  // 根据玩家段位计算 AI 难度：段位越高，AI 思考越快、失误越少、抽卡运气越好。
  // 2026-07 调整目标：低段 AI 不再第 1 波大量崩盘，让单人局稳定进入 6~10 波。
  // 数据锚点（玩家侧模拟固定 0.8s 思考 / 10% 失误）：
  //   rank0  : thinkItv=1.25 missRate=0.28 luck=0.15，平均结束约第 8.8 波
  //   rank5  : thinkItv≈0.72 missRate≈0.09，中段仍接近五五开
  //   rank10 : thinkItv≈0.34 missRate≈0，保持高段挑战
  AI.difficulty = function () {
    var prog = ZY.Rank.load();
    var C = ZY.C;
    var total = (C.RANKS.length * C.SUB_LEVELS_PER_RANK * C.STARS_PER_RANK);
    var cur = prog.rank * C.SUB_LEVELS_PER_RANK * C.STARS_PER_RANK
      + (prog.subLevel - 1) * C.STARS_PER_RANK
      + prog.stars;
    var ratio = Math.max(0, Math.min(1, cur / total));
    var r = ratio;
    var thinkItv = Math.max(0.34, 0.363 * r * r - 1.331 * r + 1.25);
    var missRate = Math.max(0, 0.242 * r * r - 0.528 * r + 0.28);
    var luck = Math.min(1, 0.15 + ratio * 0.85 + Math.max(0, ratio - 0.8) * 0.72);
    return {
      ratio: ratio,
      thinkItv: thinkItv,
      missRate: missRate,
      luck: luck
    };
  };
  var curDiff = { thinkItv: THINK_ITV, missRate: MISS_RATE, luck: 0 };

  function B() { return ZY.Board; }
  function unitCellRange(unit) {
    var stats = ZY.unitStats(unit);
    if (!stats || stats.inert) return 0;
    return stats.range || 0;
  }

  function unitDps(unit) {
    var stats = ZY.unitStats(unit);
    if (!stats || stats.inert) return 0;
    return (stats.dmg || 0) / Math.max(0.2, stats.itv || 1);
  }

  function pathCoverageScore(unit, side, c, r) {
    var range = unitCellRange(unit);
    if (!range) return 0;
    var path = ZY.Map.pathOf(side);
    var score = 0;
    for (var i = 0; i < path.length; i++) {
      var dx = path[i][0] - c;
      var dy = path[i][1] - r;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > range + 0.15) continue;
      var progress = i / Math.max(1, path.length - 1);
      score += 10 + progress * 8 + Math.max(0, range - dist) * 2;
    }
    return score + unitDps(unit) * 0.08;
  }

  function bestEmptyCellForUnit(S, side, unit, cells) {
    var best = null;
    var bestScore = -Infinity;
    for (var c = 0; c < cells.length; c++) {
      var k = cells[c][0] + '_' + cells[c][1];
      if (S.units[k]) continue;
      var score = pathCoverageScore(unit, side, cells[c][0], cells[c][1]);
      // 稳定打破平分：沿原地图顺序保留一点偏好，避免 AI 每次选择完全边缘格。
      score -= c * 0.01;
      if (score > bestScore) {
        bestScore = score;
        best = cells[c];
      }
    }
    return best;
  }

  // 执行一步最优操作，返回是否有动作
  // luck 参数：征兵运气加成（0~1），默认使用 curDiff.luck；挂机模式驱动玩家侧时应传 0
  AI.step = function (S, side, luck) {
    var cells = ZY.Map.buildOf(side);
    var useLuck = (luck !== undefined) ? luck : curDiff.luck;

    // 1. 席内碎片配对 + 同级士兵合成
    for (var i = 0; i < S.bench.length; i++) {
      for (var j = i + 1; j < S.bench.length; j++) {
        if (!S.bench[i] || !S.bench[j]) continue;
        // 碎片配对检测
        var fp = B().fragPair(S.bench[i], S.bench[j]);
        if (fp) {
          // 碎片配对成功：放置到阵地时才合成（席内仅记录配对意向）
          // 不直接合成，因为需要两个相邻格子；继续尝试其他合成
        }
        var m = B().tryMerge(S.bench[i], S.bench[j]);
        if (m) {
          S.bench[j] = m;
          S.bench[i] = null;
          if (side === 'p') {
            var bp = B().benchSlotCenter(j);
            ZY.Battle.fx(m.kind === 'g' ? 'summon' : 'ink', bp.x, bp.y);
          }
          return true;
        }
      }
    }

    // 2. 阵地互相合成
    var keys = Object.keys(S.units);
    for (var a = 0; a < keys.length; a++) {
      for (var b = a + 1; b < keys.length; b++) {
        if (B().tryMerge(S.units[keys[a]], S.units[keys[b]])) {
          B().mergeOnBoard(S, side, keys[a], keys[b]);
          return true;
        }
      }
    }

    // 3. 席上单位合到阵地
    for (var i2 = 0; i2 < S.bench.length; i2++) {
      var u = S.bench[i2];
      if (!u) continue;
      for (var c = 0; c < cells.length; c++) {
        var k = cells[c][0] + '_' + cells[c][1];
        var t = S.units[k];
        if (t && B().tryMerge(u, t)) {
          B().placeFromBench(S, side, i2, cells[c][0], cells[c][1]);
          return true;
        }
      }
    }

    // 4. 士兵/武将上阵（碎片留席上等配对；席满时也硬放）
    //    铲子AI不会使用，直接丢弃避免遗留
    var emptyBench = 0;
    S.bench.forEach(function (x) { if (!x) emptyBench++; });
    for (var i3 = 0; i3 < S.bench.length; i3++) {
      var u2 = S.bench[i3];
      if (!u2) continue;
      if (u2.kind === 'shovel') { S.bench[i3] = null; continue; } // AI丢弃铲子
      if (u2.kind === 'f' && emptyBench > 1) continue;
      var bestCell = bestEmptyCellForUnit(S, side, u2, cells);
      if (bestCell) {
        B().placeFromBench(S, side, i3, bestCell[0], bestCell[1]);
        return true;
      }
    }

    // 5. 征兵（原版机制：替换整个备战席为5张新卡）
    // 修复死锁：原条件「备战席全空」几乎永不成立（碎片会留守）。
    // 新条件：席上无可用士兵/武将（只剩碎片/铲子/空位）且仙桃足够时即征兵，
    // 让 AI 能持续补充战力、对局进入后期。
    var hasPlayable = false;
    for (var bi = 0; bi < S.bench.length; bi++) {
      var bu = S.bench[bi];
      if (bu && (bu.kind === 's' || bu.kind === 'g')) { hasPlayable = true; break; }
    }
    if (!hasPlayable && S.mantou >= B().recruitCost(S)) {
      return B().recruit(S, false, useLuck);
    }
    return false;
  };

  // 当前 AI 抽卡运气（供 newGame 初始手牌使用）
  AI.curLuck = function () { return AI.difficulty().luck; };

  AI.update = function (dt) {
    var G = ZY.G;
    if (!curDiff._cached) { curDiff = AI.difficulty(); curDiff._cached = true; }
    thinkT -= dt;
    if (thinkT > 0) return;
    thinkT = curDiff.thinkItv;
    if (Math.random() < curDiff.missRate) return;
    AI.step(G.e, 'e');
  };

  ZY.AI = AI;
})();
