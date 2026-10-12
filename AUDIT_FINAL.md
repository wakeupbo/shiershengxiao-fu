# 悟空与唐僧 · 项目代码审计总报告

**审计日期**: 2026-07-16
**审计范围**: 全项目（核心游戏引擎 13 个 JS 模块 + 入口文件 + 仿真/工具脚本 + 部署配置）
**项目地址**: `https://github.com/maojunzc/wukong-tangseng`

---

## 一、项目概况

纯 Canvas 手写引擎的塔防小游戏，零第三方依赖，一套代码同时支持微信小游戏、抖音小游戏和浏览器。代码规模约 5000+ 行 JS，13 个核心模块通过 IIFE + 全局对象 `ZY` 进行通信。

---

## 二、Bug 总览

| 分类 | 高危 | 中危 | 低危 | 合计 |
|------|------|------|------|------|
| 核心游戏引擎 (adapter/config/map/render/board/enemies/battle/ai/rank/weapon/audio/ui/main) | 3 | 18 | 29+ | 50+ |
| 仿真/工具/部署 (sim/tools/deploy) | 4 | 8 | 10 | 22 |
| **总计** | **7** | **26** | **39+** | **72+** |

---

## 三、必须优先修复的严重 Bug（高危）

### BUG-06 | adapter.js:94 — Web 端 Y 坐标转换使用了错误的缩放因子
- **类型**: 逻辑错误
- **影响**: 宽屏浏览器上点击位置严重偏移，**直接导致游戏不可玩**
- **描述**: `pos()` 函数 Y 坐标计算使用 `DW / rect.width`（宽度比例）而非 `DH / rect.height`（高度比例），导致宽屏上点击底部按钮会映射到画面中部
- **修复**: 将 Y 轴缩放因子改为 `DH / rect.height`

### BUG-03 | render.js:6 — 隐式模块依赖无保护
- **类型**: 逻辑错误
- **影响**: 加载顺序异常时整个渲染模块崩溃
- **描述**: IIFE 顶部 `var A = ZY.adapter` 在 adapter.js 未加载时为 undefined，后续 `A.createOffCanvas()` 抛 TypeError
- **修复**: 改为惰性获取或加空值守卫

### BUG-AI-001 | ai.js:80-87 — AI 阵地合成健壮性不足
- **类型**: 逻辑错误
- **影响**: AI 行为异常可能导致游戏体验失衡
- **描述**: `Object.keys` 快照与实际状态可能脱节，`mergeOnBoard` 返回值不可靠时静默失败
- **修复**: 在 merge 后添加断言验证旧键已被清理

### TOOL-019 | headless_sim.js:26 — 遍历 units 缺少空值保护
- **类型**: 逻辑错误
- **影响**: 无头模拟器在单位被消灭后抛 TypeError，导致整个批量模拟中断
- **修复**: 添加 `if (u && u.kind === 'g')` 保护

### TOOL-002/012 | shot.py + start.sh — 硬编码 macOS 路径和命令
- **类型**: 兼容性问题
- **影响**: 非 macOS 环境下工具完全不可用
- **修复**: 使用跨平台 API（`shutil.which`、`command -v`）检测可用命令

### TOOL-018 | debug_sim.js + headless_sim.js — 使用 `print()` 而非 `console.log()`
- **类型**: 兼容性问题
- **影响**: Node.js 环境下直接报错 `ReferenceError: print is not defined`
- **修复**: 全部替换为 `console.log()`

---

## 四、重要 Bug（中危，建议尽快修复）

### 游戏逻辑类

| 编号 | 文件 | 描述 |
|------|------|------|
| BUG-036 | ai.js:131 | 挂机模式(?bot=1)下，玩家征兵错误使用了 AI 的 luck 值 |
| BUG-020 | main.js:222,227 | `ZY.G = null` 时未清理模块状态，`weaponLibOpen` 残留导致回到首页仍显示武器库 |
| BUG-019 | ui.js:362 | 拖拽放置高亮判定与 board.js 实际放置逻辑可能不一致 |
| BUG-032 | ai.js:65 + board.js:154 | AI 无法在备战席配对碎片，注释与实现不符 |
| BUG-026 | weapon.js:101-107 | 碎片可能掉给已拥有武器的无用碎片，浪费掉落机会 |
| BUG-025 | weapon.js:71-77 | 掉落概率总和仅 18%，82% 无掉落，设计意图不明确 |
| BUG-033 | ui.js:538-607 | 武器库列表在小屏设备上超出画布，滚动功能未实现 |
| BUG-005 | main.js:78 | `MAX_WAVE` 为 0 时游戏立即结束，`wave` 为 0 时奖励计算不合理 |
| BUG-008 | ui.js:378-440 | `drawOver` 缺少 `ctx.restore()`，canvas 状态泄漏 |
| BUG-007 | ui.js:49 | Toast 位置硬编码 `y=300`，不随布局自适应 |

### 渲染/适配类

| 编号 | 文件 | 描述 |
|------|------|------|
| BUG-013 | render.js:459 | `ctx.filter='blur(4px)'` 在小游戏端不支持且性能开销大 |
| BUG-014 | render.js:38 | 背景缓存 key 用颜色区分而非地图名，新增地图可能使用错误缓存 |
| BUG-024 | render.js 多处 | `globalAlpha` 修改未用 `save()/restore()` 包裹，异常时透明度泄漏 |
| BUG-04 | map.js:169,177 | `ZY.L` 无空值保护，布局计算完成前调用可能报错 |
| BUG-01 | adapter.js vs config.js | `globalThis` 回退顺序不一致，特殊环境下可能绑定不同 root |
| BUG-07 | adapter.js:103-106 | `touchend` 未检查 `changedTouches` 是否为空 |
| BUG-08 | adapter.js:56-57 | touchend 传 (0,0) 而非 (-1,-1)，可能触发误点击 |
| BUG-023 | map.js:141-143 | 路径格与建造格标记可能重叠，无运行时验证 |
| BUG-26 | adapter.js:117-129 | localStorage 存储数据无校验，篡改后可能导致崩溃 |

### 工具/部署类

| 编号 | 文件 | 描述 |
|------|------|------|
| TOOL-015 | deploy.yml:34 | 部署产物包含 sim/tools 等非必要文件，泄露游戏数值设计 |
| TOOL-016 | deploy.yml | 缺少 `.nojekyll` 文件，`_` 开头的目录会被忽略 |
| TOOL-001 | gen_audio.py:29 | `env()` 函数 `dur<=a` 时除零错误 |
| TOOL-004 | shot.py:13-68 | Chrome 子进程未 `wait()` 等待退出，可能产生僵尸进程 |
| TOOL-005 | shot.py:15 | CDP 调试端口 9333 硬编码，无端口冲突检测 |
| TOOL-008 | run.js:118 | `DIFF_OVERRIDE` JSON 解析无异常处理 |
| TOOL-009 | sweep.js:41-44 | 段位参数无上界校验，可能越界访问 |

---

## 五、代码质量问题汇总（低危）

### 性能相关
- ai.js:62-87 双重循环冗余比较（每对访问两次）
- audio.js:36 sfx 限流 45ms 过短，高频音效叠放刺耳
- ui.js:82,179 每帧都读 storage（刀币、最佳波次）
- ai.js:142 每帧调用 `AI.difficulty()` 重新计算难度
- render.js:459 `ctx.filter='blur(4px)'` 每帧调用性能开销大
- render.js:26-31 `srand` 每次创建新闭包（80次/帧）
- rank.js:71-75 满级后仍执行 clamp + save

### 代码质量
- 全局变量 `ZY.weaponLibOpen` 未显式初始化
- main.js:33 `benchX` 偏移量 `+34` 为魔术数字
- main.js:16 `benchSlot = 92` 不随屏幕自适应
- config.js:11-16 兵种数值缺乏单位注释
- audio.js:20-26 音效创建失败时静默吞异常
- gen_audio.py 随机种子未固定，音效不可复现

### 兼容性/健壮性
- adapter.js:69 `innerHeight` 在移动端随地址栏跳动
- render.js:55-66 远山和飞鸟使用绝对坐标
- adapter.js:39 DPR 上限硬编码为 2，高清屏模糊
- start.sh:5-10 端口检测与服务启动存在 TOCTOU 竞态
- shot.py:18 临时目录路径硬编码
- run.js:265-269 ratio 计算与游戏常量硬编码重复，易失步

---

## 六、架构层面建议

1. **模块系统**: 当前使用 IIFE + 全局对象 `ZY` 通信，隐式依赖关系严重。建议考虑简单的模块化方案（如 ES Module），至少在 adapter.js 中统一 root 检测。

2. **状态管理**: 游戏状态散布在 `ZY.G`、各模块闭包变量、localStorage 中，清理不完整。建议建立统一的游戏状态生命周期管理。

3. **数据校验**: localStorage 读写完全没有校验和版本迁移机制，存档损坏时无法恢复。

4. **Canvas 状态管理**: 多处手动修改 `globalAlpha`、`fillStyle` 等而不使用 `save()/restore()`，应建立统一规范。

5. **部署安全**: GitHub Pages 部署了全部仓库文件，应过滤掉工具脚本和内部数值配置。

---

## 七、附录

- [核心模块审计报告1（config/map/render/adapter）](computer://d:\Personal\Desktop\wukong-tangseng-main\code-audit-report.md)
- [核心模块审计报告2（board/enemies/battle）](computer://d:\Personal\Desktop\wukong-tangseng-main\audit_report.md)
- [核心模块审计报告3（ai/main/ui/rank/weapon/audio）](computer://d:\Personal\Desktop\wukong-tangseng-main\audit_report.md)
- [仿真/工具/部署审计报告](computer://d:\Personal\Desktop\wukong-tangseng-main\AUDIT_REPORT.md)
