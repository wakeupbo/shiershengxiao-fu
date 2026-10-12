// 地图：8列×10行，上半场为对手(AI)，下半场为玩家，中央山脊分隔
// 5 张生肖主题地图随机切换，每局随机调用一种；每张图玩家侧 S 形土路 + 镜像对手侧
// （鼠洞 / 牛栏 / 虎穴 / 兔窝 / 龙宫）
(function () {
  var root = (typeof GameGlobal !== 'undefined') ? GameGlobal
    : (typeof globalThis !== 'undefined') ? globalThis
    : (typeof window !== 'undefined') ? window
    : (typeof self !== 'undefined') ? self : {};
  var ZY = root.ZY = root.ZY || {};

  var M = {};
  M.COLS = 8;
  M.ROWS = 10;

  // ---- 5 种地图布局（玩家侧路径 + 建造格），对手侧 = 180° 镜像 ----
  // 约束：路径必须是从 (0,9) 到 (7,9) 的单条不自交连续线，
  //       相邻点曼哈顿距离=1，任何格不能被访问两次；建造格不能与路径重叠
  // theme: 每张图独立的视觉风格（背景/草地/土路/外框/路缘装饰）
  // edge:  hole=鼠洞  pen=牛栏  den=虎穴  burrow=兔窝  palace=龙宫
  var LAYOUTS = [
    {
      name: '鼠洞',
      // 曲折窄路（S 形）：底0→3，上，中3→6，下，底6→7
      pPath: [
        [0, 9], [1, 9], [2, 9], [3, 9],
        [3, 8], [3, 7],
        [4, 7], [5, 7], [6, 7],
        [6, 8], [6, 9],
        [7, 9]
      ],
      pBuild: [
        [1, 8], [2, 8], [4, 8], [5, 8],
        [1, 6], [2, 6], [4, 6], [5, 6]
      ],
      // 鼠洞：土黄 / 暗棕，狭窄曲折
      theme: { bg: '#ded0b0', grass: '#a89060', grassDark: '#75603a', path: '#7a6242', pathDark: '#4e3c24', frame: '#3a2a16', edge: 'hole' }
    },
    {
      name: '牛栏',
      // 宽阔直路（反 S）：底0→1，上，中1→6（长横），下，底6→7
      pPath: [
        [0, 9], [1, 9],
        [1, 8], [1, 7],
        [2, 7], [3, 7], [4, 7], [5, 7], [6, 7],
        [6, 8], [6, 9],
        [7, 9]
      ],
      pBuild: [
        [0, 8], [2, 8], [4, 8], [5, 8], [7, 8],
        [0, 6], [2, 6], [4, 6], [5, 6], [7, 6]
      ],
      // 牛栏：草绿 / 木色，宽阔直路适合远程
      theme: { bg: '#e8eed6', grass: '#8fae6a', grassDark: '#5f8040', path: '#b3a06a', pathDark: '#7c6a3c', frame: '#463a20', edge: 'pen' }
    },
    {
      name: '虎穴',
      // 分岔压力（U 形）：左侧直上→中行横穿→右侧直下
      pPath: [
        [0, 9], [0, 8], [0, 7],
        [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7],
        [7, 8], [7, 9]
      ],
      pBuild: [
        [2, 9], [5, 9], [2, 8], [4, 8], [5, 8],
        [1, 6], [3, 6], [4, 6], [6, 6]
      ],
      // 虎穴：岩灰 / 暗红，双路压制
      theme: { bg: '#d9d2cb', grass: '#928b84', grassDark: '#5a5450', path: '#9c5a42', pathDark: '#6a3424', frame: '#2e2420', edge: 'den' }
    },
    {
      name: '兔窝',
      // 绕行长路（L 形）：底0→4，上，中4→7，下到终点
      pPath: [
        [0, 9], [1, 9], [2, 9], [3, 9], [4, 9],
        [4, 8], [4, 7],
        [5, 7], [6, 7], [7, 7],
        [7, 8], [7, 9]
      ],
      pBuild: [
        [5, 9], [6, 9], [0, 8], [1, 8], [2, 8], [3, 8], [5, 8], [6, 8],
        [1, 6], [4, 6], [6, 6]
      ],
      // 兔窝：月白 / 淡蓝，路径最长
      theme: { bg: '#eef2f8', grass: '#cfe0ee', grassDark: '#a2c0d8', path: '#86aed0', pathDark: '#5f88aa', frame: '#3a4a5a', edge: 'burrow' }
    },
    {
      name: '龙宫',
      // 水路交错（Z 形）：底0→2，上，中2→5，下，底5→7
      pPath: [
        [0, 9], [1, 9], [2, 9],
        [2, 8], [2, 7],
        [3, 7], [4, 7], [5, 7],
        [5, 8], [5, 9],
        [6, 9], [7, 9]
      ],
      pBuild: [
        [0, 8], [1, 8], [3, 8], [4, 8], [6, 8], [7, 8],
        [0, 6], [1, 6], [3, 6], [4, 6], [6, 6], [7, 6]
      ],
      // 龙宫：深蓝 / 金，水路交错
      theme: { bg: '#d6e2ef', grass: '#3f5f8f', grassDark: '#27436b', path: '#6fa3cd', pathDark: '#4a7ba6', frame: '#0e1c34', edge: 'palace' }
    }
  ];

  function mirrorPath(path) {
    return path.map(function (p) { return [M.COLS - 1 - p[0], M.ROWS - 1 - p[1]]; });
  }
  function mirrorBuild(build) {
    return build.map(function (p) { return [M.COLS - 1 - p[0], M.ROWS - 1 - p[1]]; });
  }

  // 当前局使用的地图（每局随机选一个）
  var curLayout = null;
  var P_PATH = null, E_PATH = null, P_BUILD = null, E_BUILD = null;

  function key(c, r) { return c + '_' + r; }

  // 选定本局地图：随机一个布局并计算镜像
  function pickRandom(index) {
    var idx = Number.isFinite(index) ? Math.floor(index) : Math.floor(Math.random() * LAYOUTS.length);
    if (idx < 0 || idx >= LAYOUTS.length) idx = 0;
    curLayout = LAYOUTS[idx];
    P_PATH = curLayout.pPath;
    E_PATH = mirrorPath(P_PATH);
    P_BUILD = curLayout.pBuild;
    E_BUILD = mirrorBuild(P_BUILD);
    M.theme = curLayout.theme; // 暴露当前主题给渲染层
    // 更新关卡名供 UI 显示
    if (ZY.C) ZY.C.LEVEL_NAME = curLayout.name;
    M._marked = false;
  }
  // 默认选第一张，避免初始化前访问报错
  pickRandom();

  M.pathOf = function (side) { return side === 'p' ? P_PATH : E_PATH; };
  M.buildOf = function (side) { return side === 'p' ? P_BUILD : E_BUILD; };
  M.spawnOf = function (side) { return M.pathOf(side)[0]; };
  M.adouOf = function (side) { return M.pathOf(side)[M.pathOf(side).length - 1]; };
  M.curName = function () { return curLayout ? curLayout.name : LAYOUTS[0].name; };

  M.cellType = {}; // key -> 'path' | 'build_p' | 'build_e' | 'block'
  function markAll() {
    for (var c = 0; c < M.COLS; c++)
      for (var r = 0; r < M.ROWS; r++)
        M.cellType[key(c, r)] = 'block';
    P_PATH.concat(E_PATH).forEach(function (p) { M.cellType[key(p[0], p[1])] = 'path'; });
    P_BUILD.forEach(function (p) { M.cellType[key(p[0], p[1])] = 'build_p'; });
    E_BUILD.forEach(function (p) { M.cellType[key(p[0], p[1])] = 'build_e'; });
  }
  M.ensureMarked = function () { if (!M._marked) { markAll(); M._marked = true; } };

  // 每局重置：随机选新地图并重新标记
  M.resetUnlockable = function (index) {
    pickRandom(index);
    markAll();
    M._marked = true;
  };

  // 铲子解锁：将任意 block 格转为 build_<side>（所有绿色空地都可铲）
  M.unlockCell = function (c, r, side) {
    var k = key(c, r);
    if (M.cellType[k] !== 'block') return false;
    M.cellType[k] = 'build_' + side;
    return true;
  };
  // 是否可铲：block 格且在指定阵营半场（玩家下半场 / 对手上半场）
  M.isUnlockable = function (c, r, side) {
    if (M.cellType[key(c, r)] !== 'block') return false;
    return side === 'p' ? r >= M.ROWS / 2 : r < M.ROWS / 2;
  };

  // 像素坐标换算（依赖 ZY.L 布局，在 main.js 计算后可用）
  M.cellCenter = function (c, r) {
    var L = ZY.L; if (!L) return { x: 0, y: 0 };
    return {
      x: L.mapX + c * L.cell + L.cell / 2,
      y: L.mapY + r * L.cell + L.cell / 2
    };
  };

  M.cellAt = function (x, y) {
    var L = ZY.L; if (!L) return null;
    var c = Math.floor((x - L.mapX) / L.cell);
    var r = Math.floor((y - L.mapY) / L.cell);
    if (c < 0 || c >= M.COLS || r < 0 || r >= M.ROWS) return null;
    return { c: c, r: r };
  };

  // 带容差的建造格判定：返回最近的 build 格
  M.buildCellAt = function (x, y, side) {
    var L = ZY.L;
    var c = Math.floor((x - L.mapX) / L.cell);
    var r = Math.floor((y - L.mapY) / L.cell);
    var candidates = [
      [c,r],[c-1,r],[c+1,r],[c,r-1],[c,r+1],
      [c-1,r-1],[c+1,r-1],[c-1,r+1],[c+1,r+1]
    ];
    var best = null, bestDist = Infinity;
    var tolerance = L.cell * 0.7;
    for (var i = 0; i < candidates.length; i++) {
      var cc = candidates[i][0], rr = candidates[i][1];
      var k = cc + '_' + rr;
      if (M.cellType[k] !== 'build_' + side) continue;
      var center = M.cellCenter(cc, rr);
      var d = Math.hypot(x - center.x, y - center.y);
      if (d < tolerance && d < bestDist) {
        best = { c: cc, r: rr };
        bestDist = d;
      }
    }
    return best;
  };

  // 路径像素点序列（供敌人行进插值）
  M.pathPoints = function (side) {
    return M.pathOf(side).map(function (p) { return M.cellCenter(p[0], p[1]); });
  };

  ZY.Map = M;
})();
