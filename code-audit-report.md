# 代码审计报告：悟空与唐僧 文字合成塔防小游戏

**审计范围：** `js/config.js`、`js/map.js`、`js/render.js`、`js/adapter.js`
**审计日期：** 2026-07-16

---

## BUG-01: `globalThis` 回退不一致可能导致适配层未初始化时崩溃

- **文件：** `js/adapter.js` 第 4-5 行 vs `js/config.js` 第 3-4 行
- **类型：** 逻辑错误
- **严重程度：** 中
- **描述：** `adapter.js` 的 root 检测顺序是 `GameGlobal -> globalThis -> window -> this`，而 `config.js` 是 `GameGlobal -> window -> globalThis`。当环境既没有 `GameGlobal` 也没有 `window`（如某些 SSR 或特殊 JS 引擎），两者可能绑定到不同的 root 对象，导致 `ZY.C`、`ZY.Map`、`ZY.R`、`ZY.adapter` 分布在不同全局对象上，互相无法访问。
- **建议修复：** 统一所有文件的 root 检测顺序，建议统一为 `GameGlobal -> (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined') ? window : this`。

---

## BUG-02: `adapter.js` 第 6 行直接访问 `root.ZY` 但 root 可能是 `this`

- **文件：** `js/adapter.js` 第 6 行
- **类型：** 逻辑错误
- **严重程度：** 低
- **描述：** 当 `GameGlobal`、`globalThis`、`window` 均不存在时，root 回退到 `this`。在严格模式下 `this` 为 `undefined`，`root.ZY = ...` 会抛出 `TypeError: Cannot set property 'ZY' of undefined`。
- **建议修复：** 将回退改为 `var root = typeof self !== 'undefined' ? self : (function(){ return this; })() || {}`，或在最外层加 `try/catch` 保底赋一个空对象。

---

## BUG-03: `render.js` 第 6 行引用 `ZY.adapter` 但该模块可能尚未加载

- **文件：** `js/render.js` 第 6 行
- **类型：** 逻辑错误
- **严重程度：** 高
- **描述：** `render.js` 在 IIFE 顶部执行 `var A = ZY.adapter`（第 6 行），但 `ZY.adapter` 依赖 `adapter.js` 的初始化。如果加载顺序不是 `adapter.js -> render.js`，则 `A` 为 `undefined`，后续调用 `A.createOffCanvas()`（第 39 行）会抛出 `TypeError: Cannot read property 'createOffCanvas' of undefined`。这是一种**隐式模块依赖**问题，没有保护措施。
- **建议修复：** 将 `var A = ZY.adapter` 改为惰性获取：在每次使用时执行 `var A = ZY.adapter`，或在顶部加空值保护 `var A = ZY.adapter || {}`，并在调用处检查 `A.createOffCanvas` 是否存在。

---

## BUG-04: `map.js` 第 169 行和 177 行依赖 `ZY.L` 但无空值保护

- **文件：** `js/map.js` 第 169 行、第 177 行
- **类型：** 逻辑错误
- **严重程度：** 中
- **描述：** `M.cellCenter` 和 `M.cellAt` 直接访问 `var L = ZY.L`。`ZY.L`（布局配置）在 `main.js` 中计算，若在布局计算完成前调用这些函数（例如 `pathPoints` 在初始化阶段被间接调用），`L` 为 `undefined`，导致 `L.mapX`、`L.cell` 等访问报错。
- **建议修复：** 在函数入口添加空值守卫：`if (!ZY.L) return null;`，或添加断言抛出有意义的错误信息。

---

## BUG-05: `adapter.js` 第 39 行 DPR 上限硬编码为 2，可能丢失高清屏细节

- **文件：** `js/adapters.js` 第 39 行、第 67 行
- **类型：** 性能/代码质量
- **严重程度：** 低
- **描述：** `Math.min(info.pixelRatio || 2, 2)` 和 `Math.min(window.devicePixelRatio || 1, 2)` 将 DPR 上限硬编码为 2。在 DPR=3 的设备（如部分 Android 手机）上会导致画面模糊。虽然这是为了性能做的取舍，但对 Canvas 游戏来说清晰度很重要。
- **建议修复：** 将上限改为可配置常量，例如 `var MAX_DPR = 2.5`，或根据设备性能动态调整。在高端设备上允许 DPR=3。

---

## BUG-06: `adapter.js` 第 88-94 行 `pos()` 函数使用 `DW / rect.width` 做坐标转换导致 Y 轴坐标被压缩

- **文件：** `js/adapter.js` 第 94 行
- **类型：** 逻辑错误
- **严重程度：** 高
- **描述：** `pos()` 函数将鼠标/触摸的屏幕坐标转换为设计坐标时，Y 坐标计算使用的是 `DW / rect.width` 而不是 `DH / rect.height`：
  ```js
  return [(cx - rect.left) * (DW / rect.width), (cy - rect.top) * (DW / rect.width)];
  ```
  当 canvas 的宽高比与设计稿的宽高比（750:1334）不同时，Y 坐标会严重偏移。例如在宽屏浏览器上，`rect.width` 较大导致缩放因子较小，点击底部的按钮实际映射到中部位置。**这是一个可复现的严重交互 Bug。**
- **建议修复：** Y 坐标应使用 `DH / rect.height` 进行转换：
  ```js
  return [(cx - rect.left) * (DW / rect.width), (cy - rect.top) * (A.DH / rect.height)];
  ```
  注意需要使用当前的 `A.DH` 而非静态常量。

---

## BUG-07: `adapter.js` 第 102-107 行 `touchend` 事件未使用 `changedTouches` 防御性检查

- **文件：** `js/adapter.js` 第 103-106 行
- **类型：** 逻辑错误
- **严重程度：** 中
- **描述：** `touchend` 事件处理中直接访问 `e.changedTouches[0]` 而未检查数组是否存在或为空。虽然在大多数浏览器中 `changedTouches` 不会为空，但在极端情况（如多指同时抬起但事件被部分吞掉）可能导致 `Cannot read property 'clientX' of undefined`。
- **建议修复：** 添加防御性检查：`var t = e.changedTouches && e.changedTouches[0]; if (!t) { emit('up', -1, -1); return; }`

---

## BUG-08: `adapter.js` 第 56-57 行小游戏端 `touchend` 传递坐标 (0,0) 可能触发误点击

- **文件：** `js/adapter.js` 第 56-57 行
- **类型：** 逻辑错误
- **严重程度：** 中
- **描述：** 当 `e.changedTouches` 为空时，小游戏端发送 `emit('up', 0, 0)` 而非特殊值。坐标 (0, 0) 是画布左上角的有效位置，可能意外触发该区域的按钮或交互。
- **建议修复：** 与第 59 行 `touchCancel` 保持一致，使用特殊坐标如 `emit('up', -1, -1)` 表示无效触摸。在消费端应忽略坐标为负值的 `up` 事件。

---

## BUG-09: `config.js` 第 60-61 行 `hpMul` 函数对 wave=1 返回值不合理

- **文件：** `js/config.js` 第 60-61 行
- **类型：** 逻辑错误（轻微）
- **严重程度：** 低
- **描述：** `hpMul(1)` = `1 + 0 * 0.3 + Math.pow(0, 1.5) * 0.12` = 1。这本身没错（第一波无加成），但 `Math.pow(Math.max(0, wave - 6), 1.5)` 在 wave=6 时也为 0，意味着第 1-6 波的敌人 HP 线性增长，但增长斜率从第 7 波才变为指数增长。如果这是设计意图则不是 bug，但曲线在 wave=6 处有导数不连续（从线性突然变指数）。
- **建议修复：** 如果希望平滑过渡，可将公式改为 `1 + (wave - 1) * 0.3 + Math.pow(Math.max(0, wave - 1), 1.5) * 0.04`，让指数项从一开始就存在但增速缓慢。

---

## BUG-10: `map.js` 第 162-165 行 `isUnlockable` 使用 `M.ROWS / 2` 进行半场划分，ROWS=10 时浮点比较

- **文件：** `js/map.js` 第 164 行
- **类型：** 逻辑错误
- **严重程度：** 低
- **描述：** `side === 'p' ? r >= M.ROWS / 2 : r < M.ROWS / 2`，当 `M.ROWS = 10` 时 `M.ROWS / 2 = 5`，所以 `r >= 5` 和 `r < 5`。第 5 行（中央山脊行）会被判定为玩家半场。如果设计意图是"玩家占 5-9 行，对手占 0-4 行"，那 `r=5` 归玩家是正确的。但如果中央山脊行（第 5 行）不应属于任何一方，则逻辑有误。此为边界判断的清晰性问题。
- **建议修复：** 使用整数比较 `r >= 5` 替代 `r >= M.ROWS / 2`，避免浮点歧义。明确注释中央行归属。

---

## BUG-11: `map.js` 第 128 行 `pickRandom()` 在模块加载时立即执行，产生不可控的副作用

- **文件：** `js/map.js` 第 128 行
- **类型：** 代码质量
- **严重程度：** 低
- **描述：** `pickRandom()` 在 IIFE 内立即调用（第 128 行），这意味着每次页面加载/模块初始化都会随机选择一个地图，即使游戏还没有开始。如果其他模块在初始化阶段读取 `ZY.Map.cellType`，会得到一个随机的初始状态。虽然后面有 `resetUnlockable()` 重置，但中间窗口期可能导致不一致。
- **建议修复：** 延迟初始化到第一次实际需要时，或在 `pickRandom` 中标记为"未正式开始"状态，与 `resetUnlockable` 区分。

---

## BUG-12: `render.js` 第 26-31 行伪随机 `srand` 使用线性同余法，种子溢出风险

- **文件：** `js/render.js` 第 28 行
- **类型：** 逻辑错误
- **严重程度：** 低
- **描述：** `seed = (seed * 9301 + 49297) % 233280`。在 JavaScript 中数字为 64 位浮点数（IEEE 754），`seed * 9301 + 49297` 的最大值为 `233279 * 9301 + 49297 = 2169640296`，此值在 `Number.MAX_SAFE_INTEGER`（约 9e15）范围内，不会溢出。因此此处**不是真正的 bug**，但 LCG 的随机质量较差（低位周期短），若用于安全相关场景则不可接受。在纯装饰场景下可以接受。
- **建议修复：** 仅需注意此 PRNG 不应用于任何影响游戏逻辑的地方（如抽卡、伤害计算等），仅用于视觉效果即可。

---

## BUG-13: `render.js` 第 459 行使用 `ctx.filter = 'blur(4px)'` 在部分小游戏环境不支持

- **文件：** `js/render.js` 第 459 行
- **类型：** 兼容性/性能
- **严重程度：** 中
- **描述：** `ctx.filter` API 在微信小游戏和抖音小游戏的 Canvas 实现中不一定支持。如果环境不支持，设置 `filter` 会被静默忽略，不会报错但也不会产生模糊效果。此外，`filter = 'blur()'` 是一个**高开销操作**，在每帧渲染中调用 `inkHalo` 会严重影响帧率。
- **建议修复：** 1）在 `adapter.js` 中添加能力检测 `A.supportsFilter = (function(){ try { var c = document.createElement('canvas'); var g = c.getContext('2d'); g.filter = 'blur(1px)'; return true; } catch(e) { return false; } })()`；2）在 `inkHalo` 中根据能力决定是否使用 `filter`，不支持时用多层半透明圆替代；3）考虑缓存 `inkHalo` 渲染结果到离屏 Canvas，避免每帧重复计算。

---

## BUG-14: `render.js` 第 35-76 行 `paper()` 背景缓存未按主题名区分

- **文件：** `js/render.js` 第 38 行
- **类型：** 逻辑错误
- **严重程度：** 中
- **描述：** `bgCache` 的失效条件检查 `bgCache._theme !== bgCol`，其中 `bgCol = th.bg || '#ded3bd'`。但两张不同的地图可能有相同的 `bg` 颜色值（虽然当前 5 张图没有重复），一旦新增地图且 `bg` 色碰巧相同，将使用错误的缓存背景。应该用地图名称（`curName()`）或主题对象的完整标识来区分。
- **建议修复：** 将缓存 key 改为地图名：`bgCache._mapName !== ZY.Map.curName()`，这样每张地图有独立缓存，同时通过尺寸变化触发重建。

---

## BUG-15: `render.js` 第 28-31 行 `srand` 闭包使用 `var` 声明，每次调用创建新闭包

- **文件：** `js/render.js` 第 26-31 行
- **类型：** 性能
- **严重程度：** 低
- **描述：** `srand(seed)` 每次调用都返回一个新的函数闭包。在 `tileGreen`、`tilePath` 等函数中，每个格子都会调用 `srand(seed)` 创建新闭包。在 8x10=80 个格子的地图上，每帧会创建 80 个闭包对象。虽然 JavaScript 引擎对此有优化，但仍是额外的 GC 压力。
- **建议修复：** 可接受当前做法（闭包极轻量），但若追求极致性能，可改为对象方法模式：`var rng = { seed: seed, next: function(){ this.seed = (this.seed * 9301 + 49297) % 233280; return this.seed / 233280; } }`，避免每次创建新函数。

---

## BUG-16: `adapter.js` 第 76-77 行 `resize` 每次都重新获取 `getContext('2d')`

- **文件：** `js/adapter.js` 第 76 行
- **类型：** 性能/代码质量
- **严重程度：** 低
- **描述：** 每次窗口 resize 时都调用 `canvas.getContext('2d')`。虽然浏览器对同一 canvas 的 `getContext` 调用有缓存（返回同一对象），但这是冗余操作。更重要的是，`resize` 中 `canvas.width = cssW * dpr` 会重置 canvas 状态（包括变换矩阵），然后紧接着 `setTransform` 重新设置，这是正确的。但 `getContext` 的冗余调用增加了代码阅读的困惑。
- **建议修复：** 将 `getContext` 移到 `resize` 外部，只调用一次：`A.ctx = canvas.getContext('2d')`，`resize` 中只做尺寸设置和变换矩阵重置。

---

## BUG-17: `adapter.js` 第 80 行 `ZY.onResize` 回调可能在 `ZY` 其他模块初始化前触发

- **文件：** `js/adapter.js` 第 80 行
- **类型：** 逻辑错误
- **严重程度：** 低
- **描述：** `initWeb` 中 `resize()` 立即执行并可能触发 `ZY.onResize()`，但此时 `ZY.R`（render 模块）可能尚未加载。如果 `onResize` 内部调用 `R.paper` 等函数，将因 `R` 未定义而报错。
- **建议修复：** 确保 `adapter.js` 是最后加载的模块，或在 `onResize` 中添加存在性检查。

---

## BUG-18: `render.js` 第 1357-1358 行 `inside` 函数使用 `<=` 判断边界，相邻按钮可能同时响应

- **文件：** `js/render.js` 第 1358 行
- **类型：** 逻辑错误
- **严重程度：** 低
- **描述：** `x >= b.x && x <= b.x + b.w && y <= b.y + b.h && y >= b.y` 使用了 `<=`（包含边界）。当两个按钮恰好相邻（一个按钮的右边等于另一个按钮的左边）时，点击边界像素点会同时命中两个按钮。不过实际游戏中按钮间通常有间距，且代码中检查按钮时通常按优先级遍历，因此实际影响较小。
- **建议修复：** 将右侧和底部的 `<=` 改为 `<`，即 `x < b.x + b.w && y < b.y + b.h`，避免边界重叠。

---

## BUG-19: `config.js` 和 `map.js` 全局变量 `ZY.C`、`ZY.Map`、`ZY.R` 无命名空间隔离保护

- **文件：** `js/config.js` 第 140 行、`js/map.js` 第 214 行、`js/render.js` 第 1362 行
- **类型：** 代码质量/安全
- **严重程度：** 低
- **描述：** 所有模块都将自身挂载到全局 `ZY` 对象上。如果第三方脚本或浏览器扩展也使用了 `ZY` 这个全局变量名，会造成命名冲突。此外，`root.ZYRoot = root`（adapter.js 第 7 行）将全局对象自身也暴露到了 `ZYRoot` 属性上，增加了被外部代码篡改的风险。
- **建议修复：** 考虑使用更独特的命名空间（如 `ZYGame`），并删除 `ZYRoot` 的暴露。

---

## BUG-20: `config.js` 第 11-16 行兵种数值缺乏文档说明单位和含义

- **文件：** `js/config.js` 第 11-16 行
- **类型：** 代码质量
- **严重程度：** 低
- **描述：** `dmg`、`itv`、`range`、`hp` 等属性没有注释说明单位。`itv` 看起来是间隔（秒），`range` 是攻击距离（格子数），`dmg` 是单次伤害，但需要查看其他模块才能确认。特别是 `range` 的单位：1.35 格是否包含自身格子？0.5 格是什么含义？
- **建议修复：** 在 `C.SOLDIERS` 上方添加结构体注释，说明每个字段的单位、含义和计算公式。

---

## BUG-21: `render.js` 第 459-461 行 `ctx.filter` 设置后未在 `finally` 块中保证重置

- **文件：** `js/render.js` 第 459-461 行
- **类型：** 逻辑错误
- **严重程度：** 低
- **描述：** `inkHalo` 函数中在 `ctx.filter = 'blur(4px)'` 后调用 `ctx.fill()`，然后 `ctx.filter = 'none'`。如果在 `fill()` 调用时抛出异常（理论上不太可能，但 Canvas API 在某些条件下可能失败），`filter` 不会被重置，影响后续所有渲染操作。
- **建议修复：** 使用 `try/finally` 确保 `filter` 总是被重置：
  ```js
  ctx.filter = 'blur(4px)';
  try { ctx.fill(); }
  finally { ctx.filter = 'none'; }
  ```

---

## BUG-22: `adapter.js` 第 70 行 Web 端宽度计算使用了固定的宽高比约束

- **文件：** `js/adapter.js` 第 70 行
- **类型：** 代码质量
- **严重程度：** 低
- **描述：** `var cssW = Math.min(window.innerWidth, Math.max(360, Math.floor(cssH * 0.56)))` 强制宽度为高度的 56%，并限制最小宽度 360px。这个魔数 `0.56` 对应 750/1334 的设计比例。在超宽屏上 canvas 会非常窄且居中，在大屏显示器上体验不佳。
- **建议修复：** 将宽高比 `0.56` 和最小宽度 `360` 提取为命名常量，并添加注释说明设计意图。

---

## BUG-23: `map.js` 第 141 行路径格标记会覆盖先前建造格的标记

- **文件：** `js/map.js` 第 141-143 行
- **类型：** 逻辑错误
- **严重程度：** 中
- **描述：** `markAll()` 中先将所有格子标记为 `block`，然后标记路径格为 `path`，再标记建造格为 `build_p`/`build_e`。问题在于如果某个布局数据中建造格与路径格有重叠，路径格的标记会被建造格覆盖。虽然当前 5 张地图数据没有重叠，但**没有运行时验证**。如果未来新增地图时出现了重叠，将导致敌人可以走到建造格上或建造格被判定为路径。
- **建议修复：** 在 `markAll()` 或 `pickRandom()` 中加入断言检查：
  ```js
  P_BUILD.forEach(function(p) {
    var k = key(p[0], p[1]);
    if (M.cellType[k] === 'path') console.error('Build cell overlaps path!', p);
  });
  ```

---

## BUG-24: `render.js` 整体缺乏 `save()/restore()` 的对称性审计，`globalAlpha` 泄漏风险

- **文件：** `js/render.js` 多处（例如 `tileGreen` 第 164-169 行、`tilePath` 第 176-223 行）
- **类型：** 逻辑错误
- **严重程度：** 中
- **描述：** `tileGreen` 和 `tilePath` 函数在中间多次修改 `ctx.globalAlpha`，最终在第 164/223 行恢复为 1。但没有使用 `save()/restore()` 包裹。如果在渲染过程中被中断或异常，`globalAlpha` 不会被重置，影响后续所有绘制操作的透明度。例如 `tileGreen` 第 116 行设置 `globalAlpha = 0.35`，如果 `edge === 'ember'` 分支中的 `stroke()` 抛出异常，后续绘制的所有内容都会是 35% 透明度。
- **建议修复：** 在函数入口使用 `ctx.save()`，出口使用 `ctx.restore()`，替代手动重置 `globalAlpha`。

---

## BUG-25: `config.js` 武器系统无最大持有数量限制

- **文件：** `js/config.js` 第 81-128 行
- **类型：** 安全/平衡性
- **严重程度：** 低
- **描述：** 武器系统定义了 20 件武器，但没有定义玩家最大持有武器数量。如果 `storageSet` 持久化武器列表，理论上武器数量可以无限增长，可能导致存档数据膨胀。这更多是游戏设计/平衡性问题。
- **建议修复：** 在 `C.ECON` 或武器系统配置中添加 `maxWeapons: 10` 等限制。

---

## BUG-26: `adapter.js` 第 117-129 行存储接口无数据校验

- **文件：** `js/adapter.js` 第 117-129 行
- **类型：** 安全
- **严重程度：** 中
- **描述：** `storageGet` 和 `storageSet` 没有对存储的值进行任何校验。如果存储数据被篡改（如通过浏览器开发者工具修改 localStorage），读取后直接使用可能导致：
  1. 反序列化出的对象结构与预期不符
  2. 数值越界（如 HP 为负数、等级超过 MAX_LV）
  3. 注入非法属性导致游戏逻辑异常
- **建议修复：** 在读取存档后添加数据校验和清洗：
  ```js
  function sanitize(data) {
    if (typeof data !== 'object' || data === null) return null;
    data.hearts = Math.max(0, Math.min(data.hearts || 3, 99));
    // ... 其他字段
    return data;
  }
  ```

---

## BUG-27: `adapter.js` 第 69-70 行 `innerHeight` 包含浏览器地址栏，可能导致布局跳动

- **文件：** `js/adapter.js` 第 69 行
- **类型：** 逻辑错误
- **严重程度：** 低
- **描述：** 在移动端浏览器中，`window.innerHeight` 会随地址栏的显示/隐藏而变化。当用户向下滚动导致地址栏隐藏时，`innerHeight` 增大，触发 `resize`，导致 canvas 尺寸变化。在游戏进行中这种布局跳动会导致触摸坐标偏移。
- **建议修复：** 使用 `window.visualViewport.height` 替代 `window.innerHeight`，或在首次加载后锁定高度不再响应 `resize` 事件中的高度变化。

---

## BUG-28: `render.js` 第 66 行飞鸟和第 55-62 行远山使用了绝对坐标定位

- **文件：** `js/render.js` 第 55-66 行
- **类型：** 逻辑错误（轻微）
- **严重程度：** 低
- **描述：** 远山的 `baseY`（96, 118）和飞鸟的 y 坐标（60, 44, 52）是固定像素值。由于设计稿宽度为 750、高度为 1334（或根据屏幕比例变化的 `DH`），在非常矮的屏幕上（如横屏模式），这些装饰可能出现在地图区域上方甚至被裁切。不过因为背景缓存了，只会影响美观。
- **建议修复：** 将装饰位置改为相对比例：`w * 0.07`（远山）而非固定 96。

---

## BUG-29: `map.js` 第 101-106 行镜像函数仅翻转 x 和 y，不适用于非中心对称布局

- **文件：** `js/map.js` 第 101-106 行
- **类型：** 代码质量
- **严重程度：** 低
- **描述：** `mirrorPath` 使用 `[COLS-1-p[0], ROWS-1-p[1]]` 做 180 度中心对称镜像。当前所有路径都是从左下到右下（玩家侧）或从右上到左上（对手侧），镜像后路径方向反转，是正确的。但如果路径包含环路或分支（当前没有），镜像可能产生非预期结果。代码没有验证镜像后的路径是否仍然合法（连续不自交）。
- **建议修复：** 添加一个路径合法性验证函数（检查每对相邻点曼哈顿距离为 1、无重复访问），在 `pickRandom` 中对镜像后的路径也运行验证。

---

## 总结

| 严重程度 | 数量 | 编号 |
|---------|------|------|
| **高**   | 2    | BUG-03, BUG-06 |
| **中**   | 8    | BUG-01, BUG-04, BUG-07, BUG-08, BUG-13, BUG-14, BUG-23, BUG-24, BUG-26 |
| **低**   | 12   | BUG-02, BUG-05, BUG-09, BUG-10, BUG-11, BUG-12, BUG-15, BUG-16, BUG-17, BUG-18, BUG-19, BUG-20, BUG-21, BUG-22, BUG-25, BUG-27, BUG-28, BUG-29 |

### 最需优先修复的问题：

1. **BUG-06**（高）：Web 端坐标转换 Y 轴使用错误的缩放因子，导致宽屏下点击位置严重偏移，是直接影响游戏可玩性的 Bug。
2. **BUG-03**（高）：`render.js` 依赖 `ZY.adapter` 但无保护，加载顺序错误会导致整个渲染模块崩溃。
3. **BUG-26**（中）：存储无校验，可能导致存档损坏后的崩溃。
4. **BUG-24**（中）：`globalAlpha` 泄漏风险，可能导致整个画面透明度异常。
