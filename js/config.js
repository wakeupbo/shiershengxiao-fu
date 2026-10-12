// 游戏数值配置（十二生肖主题：爪/角/牙/翼平行兵种 + 金色生肖碎片 + 仙桃经济）
// 说明：核心数值框架完全沿用原项目，仅替换主题名称、兵种字、武将、地图与美术配置。
(function () {
  var root = (typeof GameGlobal !== 'undefined') ? GameGlobal
    : (typeof globalThis !== 'undefined') ? globalThis
    : (typeof window !== 'undefined') ? window
    : (typeof self !== 'undefined') ? self : {};
  var ZY = root.ZY = root.ZY || {};

  var C = {};

  // ============ 基础信息 ============
  C.GAME_NAME = '十二生肖';
  C.GAME_SLOGAN = '文字合成塔防 · 生肖对战';

  // ============ 经济 ============
  C.CURRENCY_NAME = '仙桃';
  C.CURRENCY_ICON = '🍑';

  // ============ 守将 ============
  C.GUARDIAN_CHAR = '福';      // 守将为「福」字（红色菱形底，代表福气）
  C.GUARDIAN_HEARTS = 3;

  // 四大基础兵种：同字同级二合一升级，等级 1~5
  // 爪=快速近战 / 角=前排坦克 / 牙=高爆发 / 翼=远程
  // 数值沿用原版 刀/枪/骑/弓 四档，仅更换兵种字与名称。
  C.SOLDIERS = {
    '爪': { name: '爪兵', dmg: 16, itv: 0.75, range: 1.35, hp: 120 },
    '角': { name: '角兵', dmg: 24, itv: 0.95, range: 1.8,  hp: 110 },
    '牙': { name: '牙兵', dmg: 34, itv: 1.15, range: 1.5,  hp: 150 },
    '翼': { name: '翼兵', dmg: 13, itv: 0.55, range: 3.2,  hp: 80  }
  };
  C.SOLDIER_CHARS = ['爪', '角', '牙', '翼'];
  C.MAX_LV = 5;
  C.lvMul = function (lv) { return Math.pow(2.1, lv - 1); };

  // ============ 六大生肖武将 ============
  // 征兵抽到金色单字碎片（不能作战，纯占格），拼齐姓名觉醒武将。
  // 每局从 6 个中随机抽取 C.HEROES_PER_GAME 个（与原版 3~4 个一致）。
  C.HEROES = [
    { name: '子鼠', f1: '子', f2: '鼠', skill: 'pierce',  desc: '鼠群突袭·贯穿直线' },
    { name: '丑牛', f1: '丑', f2: '牛', skill: 'stun',    desc: '蛮牛冲撞·范围眩晕' },
    { name: '寅虎', f1: '寅', f2: '虎', skill: 'execute', desc: '猛虎扑杀·处决残敌' },
    { name: '卯兔', f1: '卯', f2: '兔', skill: 'snipe',   desc: '月兔疾跃·速射' },
    { name: '辰龙', f1: '辰', f2: '龙', skill: 'aura',    desc: '龙腾祥瑞·友军攻击+20%' },
    { name: '巳蛇', f1: '巳', f2: '蛇', skill: 'venom',   desc: '毒蛇缠绕·减速侵蚀' }
  ];
  C.HEROES_PER_GAME = 4;

  // 武将基础数值（沿用原版数值框架；巳蛇为新增，取中位强度）
  // 未装备武器时只有基础攻击；装备武器后伤害+武器加成，攻击特效变为武器造型。
  C.HERO_STATS = {
    '子鼠': { dmg: 90,  itv: 0.7,  range: 3.6 },
    '丑牛': { dmg: 72,  itv: 1.2,  range: 1.8 },
    '寅虎': { dmg: 156, itv: 1.3,  range: 2.2 },
    '卯兔': { dmg: 51,  itv: 0.38, range: 4.5 },
    '辰龙': { dmg: 36,  itv: 1.0,  range: 2.6 },
    '巳蛇': { dmg: 110, itv: 0.9,  range: 3.0 }
  };

  // 5 位拥有专属神器的武将（用于武器装备绑定；巳蛇无专属，对应原版无第 6 个武将）
  // 每位生肖都有专属神器与定制攻击特效
  C.GENERAL_NAMES = ['子鼠', '丑牛', '寅虎', '卯兔', '辰龙', '巳蛇'];

  // ============ 生肖专属攻击特效 ============
  // fx：基础弹道/技能特效造型；color/accent：主色/辅色；weapon：专属神器弹道造型
  C.HERO_FX = {
    '子鼠': { fx: 'rat',    color: '#d8b45a', accent: '#8a6a2a', weapon: 'claw'       },
    '丑牛': { fx: 'ox',     color: '#a8703a', accent: '#5a3a1c', weapon: 'horn'       },
    '寅虎': { fx: 'tiger',  color: '#e8902a', accent: '#8a3a1a', weapon: 'tigerfang'  },
    '卯兔': { fx: 'rabbit', color: '#dceaf8', accent: '#7fa6c8', weapon: 'moonarrow'  },
    '辰龙': { fx: 'dragon', color: '#f0c850', accent: '#3a8ad0', weapon: 'dragonpearl'},
    '巳蛇': { fx: 'snake',  color: '#8fd45a', accent: '#6a3a8a', weapon: 'venomfang'  }
  };

  // 由 selectHeroes() 动态填充：C.GENERALS / C.FRAG_MAP / C.FRAG_CHARS / C.HERO_POOL
  C.GENERALS = {};
  C.FRAG_MAP = {};
  C.FRAG_CHARS = [];

  function heroByName(name) {
    for (var i = 0; i < C.HEROES.length; i++) if (C.HEROES[i].name === name) return C.HEROES[i];
    return null;
  }

  // 根据所选武将列表重建武将数值表 + 碎片配对表
  function buildHeroTables(names) {
    var gens = {}, map = {}, chars = [];
    names.forEach(function (name) {
      var hero = heroByName(name);
      var st = C.HERO_STATS[name];
      if (!hero || !st) return;
      gens[name] = { dmg: st.dmg, itv: st.itv, range: st.range, skill: hero.skill, desc: hero.desc };
      map[hero.f1] = [name, hero.f2];
      map[hero.f2] = [name, hero.f1];
      chars.push(hero.f1, hero.f2);
    });
    C.GENERALS = gens;
    C.FRAG_MAP = map;
    C.FRAG_CHARS = chars;
    C.HERO_POOL = names.slice();
  }

  // 每局开始时调用：从 6 个生肖武将中随机抽 n 个（默认 HEROES_PER_GAME）作为本局可觉醒武将
  C.selectHeroes = function (n) {
    var all = C.HEROES.map(function (h) { return h.name; });
    var count = Number.isFinite(n) ? Math.max(1, Math.floor(n)) : C.HEROES_PER_GAME;
    if (count >= all.length) { buildHeroTables(all); return C.HERO_POOL; }
    // Fisher-Yates 洗牌后取前 count 个
    for (var i = all.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0;
      var t = all[i]; all[i] = all[j]; all[j] = t;
    }
    buildHeroTables(all.slice(0, count));
    return C.HERO_POOL;
  };

  // 默认全量（测试 / 未开局时的兜底）
  buildHeroTables(C.HEROES.map(function (h) { return h.name; }));

  // 征兵抽取权重（每次征兵直接替换整个备战席为5张随机卡牌，原版机制）
  // 调优：铲子对 AI 无价值且稀释产出，权重 8→4；碎片合成率过低，22→26
  C.RECRUIT_POOL = [
    { kind: 's', w: 70 },    // 士兵
    { kind: 'f', w: 26 },    // 武将碎片
    { kind: 'shovel', w: 4 } // 铲子道具（可解锁任意绿色 block 格为 build 格）
  ];

  // 敌人：生肖主题小怪（数值沿用原版，仅替换外观字）
  C.ENEMIES = {
    zei:  { ch: '狸', hp: 60,   spd: 1.05, mantou: 2, size: 0.62 },
    dao:  { ch: '豺', hp: 130,  spd: 0.9,  mantou: 3, size: 0.66 },
    kou:  { ch: '獠', hp: 280,  spd: 0.75, mantou: 5, size: 0.7  },
    fei:  { ch: '狐', hp: 150,  spd: 1.5,  mantou: 4, size: 0.6  },
    boss: { ch: '年', hp: 1100, spd: 0.5,  mantou: 30, size: 0.95, boss: true }
  };
  C.hpMul = function (wave) {
    return 1 + (wave - 1) * 0.3 + Math.pow(Math.max(0, wave - 6), 1.5) * 0.12;
  };

  C.ECON = {
    startMantou: 20,   // 开局仙桃数（变量名沿用原版）
    recruitBase: 10,
    recruitInc: 2,
    hearts: 3,
    benchSize: 5,
    waveBonus: function (w) { return 8 + w * 2; }
  };

  // 地图元数据（真正的布局在 js/map.js，这里提供名称/主题色/路径风格供 UI 与文档引用）
  C.MAPS = [
    { name: '鼠洞', color: '#8B7355', path: 'narrow_zigzag' },
    { name: '牛栏', color: '#6B8E23', path: 'wide_straight' },
    { name: '虎穴', color: '#8B0000', path: 'double_fork'   },
    { name: '兔窝', color: '#E6E6FA', path: 'circular_long' },
    { name: '龙宫', color: '#191970', path: 'water_obstacle'}
  ];

  C.LEVEL_NAME = '鼠洞';
  C.MAX_WAVE = 10; // 单人 AI 对战撑过即判定胜利（若对手先失守则提前胜利）
  C.ONLINE_MAX_REPORTED_WAVE = 9999; // 公网无尽对战仅用于同步与战绩的安全夹值

  // 玩家头像（十二生肖 5 位，程序化绘制人物画像）
  C.AVATARS = ['zishu', 'chouniu', 'yinhu', 'maotu', 'chenlong'];
  C.AVATAR_LABELS = { zishu: '子鼠', chouniu: '丑牛', yinhu: '寅虎', maotu: '卯兔', chenlong: '辰龙' };
  C.AVATAR_DEFAULT = 'zishu';

  // ============ 武器系统 ============
  // 4 品质：凡品5 / 良品5 / 珍品5 / 神器6（每位生肖一件专属）= 21 件武器
  // 品质色 + 掉落概率 + 合成所需碎片数
  C.WEAPON_QUALITY = {
    green:  { name: '凡品', color: '#5aa860', drop: 0.10, fragNeed: 0 }, // 绿色成品直接掉落
    blue:   { name: '良品', color: '#4a8ad4', drop: 0.05, fragNeed: 0 }, // 蓝色成品直接掉落
    purple: { name: '珍品', color: '#a85ef0', drop: 0.02, fragNeed: 3 }, // 紫色3碎片合成
    orange: { name: '神器', color: '#e8a23a', drop: 0.01, fragNeed: 5 }  // 橙色5碎片合成
  };
  C.WEAPON_QUALITY_ORDER = ['green', 'blue', 'purple', 'orange'];

  // 武器列表：每件武器有 id/name/quality/owner(可选,角色名)/dmg(加成)/shape(弹道造型)
  // 橙色6件：6位生肖武将专属神器（每件弹道造型与该生肖属性对应）
  // 紫色5件：生肖年画法宝
  // 蓝色5件：精良兵器
  // 绿色5件：凡间兵器
  C.WEAPONS = [
    // ===== 橙色神器（6件，武将专属，5碎片合成） =====
    { id: 'dinghai',   name: '鼠王金爪', quality: 'orange', owner: '子鼠', dmg: 90, shape: 'claw',        desc: '鼠王图腾·迅捷无双' },
    { id: 'dingba',    name: '伏牛铁角', quality: 'orange', owner: '丑牛', dmg: 80, shape: 'horn',        desc: '蛮牛冲撞·力可拔山' },
    { id: 'jiangyao',  name: '虎啸骨杖', quality: 'orange', owner: '寅虎', dmg: 130, shape: 'tigerfang',  desc: '百兽之王·威震山林' },
    { id: 'xizhang',   name: '玉兔玄弓', quality: 'orange', owner: '卯兔', dmg: 50, shape: 'moonarrow',   desc: '月宫灵弓·千里穿杨' },
    { id: 'longzhu',   name: '龙宫明珠', quality: 'orange', owner: '辰龙', dmg: 40, shape: 'dragonpearl', desc: '东海龙宫·镇海夜明珠' },
    { id: 'lingshe',   name: '灵蛇毒刃', quality: 'orange', owner: '巳蛇', dmg: 45, shape: 'venomfang',   desc: '灵蛇吐信·毒侵肌骨' },

    // ===== 紫色珍品（5件，通用法宝，3碎片合成） =====
    { id: 'bajiaoshan', name: '芭蕉宝扇',   quality: 'purple', dmg: 60, shape: 'fan',    desc: '一扇熄火·呼风唤雨' },
    { id: 'huluping',   name: '紫金玉葫',   quality: 'purple', dmg: 55, shape: 'gourd',  desc: '吞纳万物·封妖镇邪' },
    { id: 'qixingjian', name: '七星宝剑',   quality: 'purple', dmg: 65, shape: 'sword',  desc: '北斗七星·斩妖除魔' },
    { id: 'jingping',   name: '白玉净瓶',   quality: 'purple', dmg: 50, shape: 'vase',   desc: '甘露净水·起死回生' },
    { id: 'huangjinrope', name: '捆仙金绳', quality: 'purple', dmg: 45, shape: 'rope',   desc: '金绳缚妖·无处可逃' },

    // ===== 蓝色良品（5件，成品直接掉落） =====
    { id: 'qingfeng',  name: '青锋剑',  quality: 'blue', dmg: 30, shape: 'sword', desc: '寒光凛凛·削铁如泥' },
    { id: 'xuantie',   name: '玄铁盾',  quality: 'blue', dmg: 22, shape: 'shield', desc: '坚不可摧·固若金汤' },
    { id: 'hanbing',   name: '寒冰刃',  quality: 'blue', dmg: 28, shape: 'knife', desc: '北冰寒铁·冰封万里' },
    { id: 'liehuo',    name: '烈火枪',  quality: 'blue', dmg: 32, shape: 'spear', desc: '南焰火精·灼烧敌军' },
    { id: 'fenglei',   name: '风雷弓',  quality: 'blue', dmg: 24, shape: 'bow',   desc: '风雷相激·万里穿杨' },

    // ===== 绿色凡品（5件，成品直接掉落） =====
    { id: 'liumu',     name: '柳木剑',  quality: 'green', dmg: 12, shape: 'sword', desc: '乡野常见·聊胜于无' },
    { id: 'zhujie',    name: '竹节鞭',  quality: 'green', dmg: 14, shape: 'whip',  desc: '竹节所制·灵活轻便' },
    { id: 'tiegong',   name: '铁背弓',  quality: 'green', dmg: 10, shape: 'bow',   desc: '猎户标配·精度尚可' },
    { id: 'mutong',    name: '木铜盾',  quality: 'green', dmg: 8,  shape: 'shield', desc: '包铜木盾·抵御流矢' },
    { id: 'shifu',     name: '石斧',    quality: 'green', dmg: 16, shape: 'axe',   desc: '粗石打磨·力大无穷' }
  ];
  // 按 id 索引方便查询
  C.WEAPON_MAP = {};
  C.WEAPONS.forEach(function (w) { C.WEAPON_MAP[w.id] = w; });

  // 玩家段位（11 级）：每级 5 阶（一~五），每阶满 5 星后再通关一次升下一阶
  C.RANKS = [
    '力士', '天兵', '天将', '星官', '星君',
    '真君', '元帅', '天王', '大帝', '天尊',
    '玉皇大天尊'
  ];
  C.SUB_LEVELS = ['一', '二', '三', '四', '五'];
  C.SUB_LEVELS_PER_RANK = 5; // 每级内部分阶数
  C.STARS_PER_RANK = 5; // 每阶满星数

  ZY.C = C;
})();
