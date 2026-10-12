# 代码审计报告 - 悟空与唐僧 仿真/工具/部署脚本

**审计范围**: `sim/run.js`, `sim/sweep.js`, `tools/debug_sim.js`, `tools/headless_sim.js`, `tools/gen_audio.py`, `tools/shot.py`, `start.sh`, `.github/workflows/deploy.yml`

**审计日期**: 2026-07-16

---

## TOOL-001 | gen_audio.py 第29行 | 逻辑错误 | 中

**文件**: `d:\Personal\Desktop\wukong-tangseng-main\tools\gen_audio.py` 第29行

**描述**: `env()` 函数在 `dur == a` 时会产生除零错误。衰减公式 `(1 - (t - a) / (dur - a))` 中分母为 `dur - a`，当调用者传入 `dur <= a` 时触发 `ZeroDivisionError`。当前所有调用点的 `dur` 均远大于 `a`（最小值 `dur=0.07, a=0.002`），暂不会触发，但作为通用工具函数缺乏防御性检查。

**建议修复**:
```python
def env(t, dur, a=0.005, r=0.6):
    if t < a:
        return t / a
    if dur <= a:
        return 0.0
    return max(0.0, (1 - (t - a) / (dur - a))) ** r
```

---

## TOOL-002 | shot.py 第14行 | 兼容性问题 | 高

**文件**: `d:\Personal\Desktop\wukong-tangseng-main\tools\shot.py` 第14行

**描述**: Chrome 路径硬编码为 macOS 专属 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`。在 Linux 或 Windows 环境下直接报 `FileNotFoundError`，脚本完全不可用。项目仓库的 GitHub Actions 部署在 `ubuntu-latest`，此脚本无法在 CI 中运行。

**建议修复**:
```python
import shutil
chrome_path = shutil.which('google-chrome') or shutil.which('chromium-browser')
if not chrome_path:
    raise RuntimeError('Chrome/Chromium not found in PATH')
```

---

## TOOL-003 | shot.py 第18行 | 代码质量 | 低

**文件**: `d:\Personal\Desktop\wukong-tangseng-main\tools\shot.py` 第18行

**描述**: `--user-data-dir=/tmp/zyshot_cdp` 硬编码了临时目录路径。多次并行调用时会发生 Chrome 用户数据目录冲突（Chrome 对同一 user-data-dir 加文件锁），导致第二次启动失败。应使用 `tempfile.mkdtemp()` 创建独立临时目录。

**建议修复**:
```python
import tempfile
tmp_dir = tempfile.mkdtemp(prefix='zyshot_')
# ... 使用 tmp_dir 作为 user-data-dir ...
# finally 中清理: shutil.rmtree(tmp_dir, ignore_errors=True)
```

---

## TOOL-004 | shot.py 第13-68行 | 资源泄漏 | 中

**文件**: `d:\Personal\Desktop\wukong-tangseng-main\tools\shot.py` 第13-68行

**描述**: Chrome 子进程仅调用 `terminate()`（发送 SIGTERM），但未调用 `wait()` 等待进程退出，也未使用 `with` 上下文或 `atexit` 确保资源回收。Chrome headless 模式下 SIGTERM 有时无法完全终止所有子进程，导致僵尸进程累积。此外，WebSocket 连接 `ws` 在 `finally` 块中未显式关闭。

**建议修复**:
```python
finally:
    ws.close()
    chrome.terminate()
    try:
        chrome.wait(timeout=5)
    except subprocess.TimeoutExpired:
        chrome.kill()
        chrome.wait()
```

---

## TOOL-005 | shot.py 第15行 | 逻辑错误 | 中

**文件**: `d:\Personal\Desktop\wukong-tangseng-main\tools\shot.py` 第15行

**描述**: CDP 调试端口 `9333` 硬编码，无端口冲突检测。若该端口已被其他 Chrome 实例或进程占用，脚本将连接到错误的目标或无法获取预期的 tab 列表，导致不可预测的行为（截取到其他页面的截图或直接失败）。

**建议修复**: 使用 `0` 让操作系统分配随机端口，或添加端口可用性检测逻辑。若必须固定端口，至少应在连接失败时给出明确错误提示。

---

## TOOL-006 | shot.py 第11行 | 健壮性 | 中

**文件**: `d:\Personal\Desktop\wukong-tangseng-main\tools\shot.py` 第11行

**描述**: 直接通过 `sys.argv[1]`、`sys.argv[2]`、`float(sys.argv[3])` 获取参数，无任何校验。缺少参数时抛出 `IndexError`，`wait_s` 非数字时抛出 `ValueError`，均无友好错误提示。URL 未做合法性检查，可能传入无效地址导致 Chrome 导航失败后仍等待超时。

**建议修复**:
```python
if len(sys.argv) != 4:
    print(f'Usage: {sys.argv[0]} <url> <out.png> <wait_seconds>', file=sys.stderr)
    sys.exit(1)
url, out, wait_s = sys.argv[1], sys.argv[2], float(sys.argv[3])
```

---

## TOOL-007 | shot.py 第40-43行 | 逻辑错误 | 低

**文件**: `d:\Personal\Desktop\wukong-tangseng-main\tools\shot.py` 第40-43行

**描述**: `send()` 函数内部通过 `ws.recv()` 循环等待匹配 `id` 的响应消息，但非目标消息（如异步事件通知）被静默丢弃。在等待截图结果等场景下，可能丢失关键的 `Runtime.exceptionThrown` 等事件，导致运行时错误被隐藏。

**建议修复**: 将异步事件分发到独立的事件监听线程/队列中处理，而非在同步请求-响应循环中丢弃。

---

## TOOL-008 | run.js 第118行 | 健壮性 | 中

**文件**: `d:\Personal\Desktop\wukong-tangseng-main\sim\run.js` 第118行

**描述**: `DIFF_OVERRIDE` 环境变量通过 `JSON.parse()` 直接解析，无异常处理。若用户设置了格式错误的 JSON 值（如缺少引号、多余逗号），脚本将立即崩溃并抛出不可读的 `SyntaxError: Unexpected token...`，难以定位问题来源。

**建议修复**:
```javascript
const DIFF_OVERRIDE = process.env.DIFF_OVERRIDE
  ? (() => { try { return JSON.parse(process.env.DIFF_OVERRIDE); }
             catch(e) { console.error('DIFF_OVERRIDE JSON 解析失败:', e.message); process.exit(1); } })()
  : null;
```

---

## TOOL-009 | sweep.js 第41-44行 | 逻辑错误 | 中

**文件**: `d:\Personal\Desktop\wukong-tangseng-main\sim\sweep.js` 第41-44行

**描述**: `RANK_NAMES` 数组长度为 11（索引 0-10），但 `RANK_TO` 参数无上界校验。当用户传入 `RANK_TO > 10` 时，第 44 行 `RANK_NAMES[r]` 返回 `undefined`，输出变为 `rank 11 undefined ...`，且第 42 行的 `ratio` 计算结果会超过 1.0，产生无意义的统计数据。

**建议修复**:
```javascript
const RANK_MAX = RANK_NAMES.length - 1;
const RANK_TO = Math.min(ARGS[2] !== undefined ? parseInt(ARGS[2], 10) : 10, RANK_MAX);
```

---

## TOOL-010 | sweep.js 第56-58行 | 健壮性 | 低

**文件**: `d:\Personal\Desktop\wukong-tangseng-main\sim\sweep.js` 第56-58行

**描述**: 子进程输出中查找 `SWEEP_RESULT` 行后直接 `JSON.parse()`，无格式校验。若子进程因运行时错误输出了非 JSON 内容（如错误堆栈被截断后恰好以 `SWEEP_RESULT` 开头），解析将失败并抛出未捕获异常，导致整个扫描中断。

**建议修复**: 用 `try-catch` 包裹 `JSON.parse`，解析失败时输出原始行内容以便调试，并 `continue` 跳过该段位。

---

## TOOL-011 | sweep.js 第47行 | 性能问题 | 低

**文件**: `d:\Personal\Desktop\wukong-tangseng-main\sim\sweep.js` 第47行

**描述**: 使用 `execSync` 同步等待每个段位的子进程完成。默认配置为 11 个段位 x 300 局，每局模拟 800 秒游戏时间（24000 步），总串行执行时间可能非常长（数十分钟到数小时）。段位之间无数据依赖，完全可以用 `child_process.spawn` 或 worker 线程并行执行。

**建议修复**: 使用 `Promise.all` + `child_process.exec` 或 `worker_threads` 并行运行多个段位的模拟。

---

## TOOL-012 | start.sh 第5、10行 | 兼容性问题 | 高

**文件**: `d:\Personal\Desktop\wukong-tangseng-main\start.sh` 第5、10行

**描述**: 脚本使用了 `lsof`（第5行）和 `open`（第10行）两个 macOS 专属命令。在 Linux 上 `open` 不存在（应使用 `xdg-open`），部分 Linux 发行版可能未预装 `lsof`。项目部署在 GitHub Pages（ubuntu-latest），此脚本在 CI 或 Linux 开发环境中完全不可用。

**建议修复**:
```bash
# 端口检测兼容写法
if command -v lsof &>/dev/null; then
    lsof -i :$PORT >/dev/null 2>&1 && echo "端口 $PORT 已有服务在运行"
elif command -v ss &>/dev/null; then
    ss -tlnp | grep -q ":$PORT " && echo "端口 $PORT 已有服务在运行"
fi

# 打开浏览器兼容写法
if command -v xdg-open &>/dev/null; then
    xdg-open "http://127.0.0.1:$PORT/index.html"
elif command -v open &>/dev/null; then
    open "http://127.0.0.1:$PORT/index.html"
fi
```

---

## TOOL-013 | start.sh 第5-10行 | 逻辑错误 | 低

**文件**: `d:\Personal\Desktop\wukong-tangseng-main\start.sh` 第5-10行

**描述**: 端口检测与服务启动之间存在竞态条件（TOCTOU）。`lsof` 检测端口空闲后，在 `python3 -m http.server` 实际绑定端口之前，另一个进程可能抢占了该端口。虽然在实际使用中概率极低，但属于经典的竞态缺陷。

**建议修复**: 直接尝试启动服务，通过检查退出码判断端口是否被占用：
```bash
if ! python3 -m http.server $PORT --directory "$DIR" >/tmp/zy_http.log 2>&1; then
    echo "端口 $PORT 启动失败，可能已被占用"
fi
```

---

## TOOL-014 | start.sh 第8行 | 代码质量 | 低

**文件**: `d:\Personal\Desktop\wukong-tangseng-main\start.sh` 第8行

**描述**: 日志文件路径 `/tmp/zy_http.log` 硬编码。在多用户系统或多次运行场景中，日志会被互相覆盖。应使用 `$XDG_RUNTIME_DIR` 或 `mktemp` 生成唯一路径。

**建议修复**:
```bash
LOG=$(mktemp /tmp/zy_http_XXXXXX.log)
nohup python3 -m http.server $PORT --directory "$DIR" >"$LOG" 2>&1 &
```

---

## TOOL-015 | deploy.yml 第34行 | 安全/性能问题 | 中

**文件**: `d:\Personal\Desktop\wukong-tangseng-main\.github\workflows\deploy.yml` 第34行

**描述**: `path: .` 将整个仓库根目录作为部署产物上传，包括 `sim/`（仿真脚本）、`tools/`（开发工具）、`.github/`（CI 配置）、`node_modules/`（如存在）等非必要文件。这导致：(1) 部署体积膨胀，构建和上传时间增加；(2) 内部工具脚本暴露在公网，可能泄露游戏数值设计和测试逻辑；(3) 若将来添加含敏感信息的配置文件，也会被意外部署。

**建议修复**:
```yaml
- name: Upload artifact
  uses: actions/upload-pages-artifact@v3
  with:
    path: .
    exclude: |
      sim/
      tools/
      .github/
      **/*.py
      **/*.sh
      node_modules/
```
或者维护一个明确的部署目录白名单。

---

## TOOL-016 | deploy.yml 缺失 | 功能缺陷 | 中

**文件**: `d:\Personal\Desktop\wukong-tangseng-main\.github\workflows\deploy.yml`

**描述**: 工作流中未创建 `.nojekyll` 文件。GitHub Pages 默认使用 Jekyll 处理站点，以 `_` 开头的文件或目录会被 Jekyll 忽略。若项目中存在此类文件（如 `_shared/`、`_assets/`），它们将不会出现在部署后的站点上。此外，即使不需要 Jekyll，添加 `.nojekyll` 可以跳过 Jekyll 构建步骤，加快部署速度。

**建议修复**: 在 Upload artifact 步骤之前添加：
```yaml
- name: Disable Jekyll
  run: touch .nojekyll
```

---

## TOOL-017 | run.js 第229-237行 vs 第244行 | 逻辑错误 | 低

**文件**: `d:\Personal\Desktop\wukong-tangseng-main\sim\run.js` 第229-237行、第244行

**描述**: 代码同时返回自定义的 `winner` 字段和游戏原生的 `G.win` 字段，但两者的判定逻辑不同。`winner` 在超时场景下通过比较双方红心数决定胜负（第233-236行），而 `G.win` 由游戏内部的 `matchEnd()` 设置，可能采用不同的判定标准（如波数、综合评分等）。下游消费者若误用 `G.win` 而非 `winner`，会得到不一致的分类结果。

**建议修复**: 统一使用一种判定逻辑。若 `winner` 是更完善的判定，应移除 `G.win` 或明确标注其含义差异；或在报告中明确说明两者的适用场景。

---

## TOOL-018 | debug_sim.js 第31行、headless_sim.js 第44行 | 兼容性问题 | 高

**文件**: `d:\Personal\Desktop\wukong-tangseng-main\tools\debug_sim.js` 第31行, `d:\Personal\Desktop\wukong-tangseng-main\tools\headless_sim.js` 第44行

**描述**: 两个脚本均使用 `print()` 函数输出信息。在 Node.js 中 `print` 不是标准全局函数（仅存在于 V8 shell / d8 等引擎中），调用时会抛出 `ReferenceError: print is not defined`。若这些脚本被设计为在浏览器控制台中运行，`print` 同样不可用（浏览器使用 `console.log`）。根据文件头注释（debug_sim.js: "诊断工具"，headless_sim.js: "无头数值模拟"），它们应当能在 Node.js 或游戏 VM 上下文中运行，但当前在两种环境中都会报错。

**建议修复**: 全部替换为 `console.log()`。

---

## TOOL-019 | headless_sim.js 第26行 | 逻辑错误 | 高

**文件**: `d:\Personal\Desktop\wukong-tangseng-main\tools\headless_sim.js` 第26行

**描述**: `for (var k in G.p.units) if (G.p.units[k].kind === 'g')` 未做空值保护。在对战过程中，单位被消灭后对应的 `units[key]` 可能被设为 `null` 或 `undefined`（取决于游戏内部实现），直接访问 `.kind` 会抛出 `TypeError: Cannot read property 'kind' of null/undefined`，导致整个模拟中断。对比 `run.js` 第180行已做了 `if (u && u.kind === 'g')` 的保护。

**建议修复**:
```javascript
for (var k in G.p.units) {
  var u = G.p.units[k];
  if (u && u.kind === 'g') pGenerals[u.name] = true;
}
```

---

## TOOL-020 | run.js 第265-269行 | 健壮性 | 低

**文件**: `d:\Personal\Desktop\wukong-tangseng-main\sim\run.js` 第265-269行

**描述**: 手动计算 `RATIO` 的公式（`rank * SUB_LEVELS * STARS + (subLevel-1) * STARS + stars`）与 `ZY.AI.difficulty()` 内部的 ratio 计算逻辑重复。如果游戏 `config.js` 中的 `RANKS`、`SUB_LEVELS_PER_RANK`、`STARS_PER_RANK` 常量被修改，`run.js` 中的硬编码乘数不会自动同步，导致 ratio 计算结果与实际游戏不一致。同理，`sweep.js` 第25行也硬编码了 `SUB_LEVELS_PER_RANK = 5` 和 `STARS_PER_RANK = 5`。

**建议修复**: 直接从已加载的游戏常量中读取 `C.SUB_LEVELS_PER_RANK` 和 `C.STARS_PER_RANK`，而非在仿真脚本中硬编码重复定义。

---

## TOOL-021 | shot.py 第50-55行 | 资源泄漏 | 低

**文件**: `d:\Personal\Desktop\wukong-tangseng-main\tools\shot.py` 第50-55行

**描述**: 等待循环中将 `ws.settimeout(1)` 改为 1 秒超时以实现非阻塞轮询，但循环结束后恢复了 `ws.settimeout(30)`。若在等待期间发生未捕获的异常（如 `json.loads` 解析非 JSON 消息失败），WebSocket 连接可能处于不一致状态。此外，整个等待循环没有总体超时保护——如果 `Page.navigate` 一直没有触发 `Page.loadEventFired`，循环会精确运行 `wait_s` 秒，但期间所有事件都被忽略（仅打印异常/控制台），可能导致页面尚未加载完成就执行截图。

**建议修复**: 监听 `Page.loadEventFired` 事件确认页面加载完成后再截图，而非仅靠固定等待时间。

---

## TOOL-022 | gen_audio.py | 代码质量 | 低

**文件**: `d:\Personal\Desktop\wukong-tangseng-main\tools\gen_audio.py`

**描述**: `noise()` 函数使用 `random.random()` 生成随机噪声，但未设置随机种子。每次运行脚本都会产生不同的 WAV 文件内容，导致音效不可复现。在 CI/CD 流水线中，这意味着每次构建产物的音频文件 hash 不同，影响缓存效率和构建确定性。

**建议修复**: 在脚本开头添加 `random.seed(42)` 或通过命令行参数/环境变量控制种子，确保可复现构建。

---

## 汇总统计

| 严重程度 | 数量 | 编号 |
|---------|------|------|
| 高 | 3 | TOOL-002, TOOL-012, TOOL-018, TOOL-019 |
| 中 | 8 | TOOL-001, TOOL-004, TOOL-005, TOOL-006, TOOL-008, TOOL-009, TOOL-015, TOOL-016 |
| 低 | 9 | TOOL-003, TOOL-007, TOOL-010, TOOL-011, TOOL-013, TOOL-014, TOOL-017, TOOL-020, TOOL-021, TOOL-022 |

| 类型 | 数量 |
|------|------|
| 兼容性问题 | 2 (TOOL-002, TOOL-012, TOOL-018) |
| 逻辑错误 | 5 (TOOL-001, TOOL-005, TOOL-009, TOOL-013, TOOL-017, TOOL-019) |
| 健壮性 | 3 (TOOL-006, TOOL-008, TOOL-010, TOOL-020) |
| 资源泄漏 | 2 (TOOL-004, TOOL-021) |
| 安全/性能 | 1 (TOOL-015) |
| 功能缺陷 | 1 (TOOL-016) |
| 代码质量 | 4 (TOOL-003, TOOL-011, TOOL-014, TOOL-022) |