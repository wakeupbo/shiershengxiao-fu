#!/bin/bash
# 启动本地预览服务器并打开浏览器（跨平台：macOS/Linux/Windows Git Bash）
DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=8765

# 检测端口是否被占用（跨平台兼容）
port_in_use() {
    if command -v lsof &>/dev/null; then
        lsof -i :$PORT >/dev/null 2>&1
    elif command -v ss &>/dev/null; then
        ss -tlnp 2>/dev/null | grep -q ":$PORT "
    elif command -v netstat &>/dev/null; then
        netstat -an 2>/dev/null | grep -q ":$PORT .*LISTEN"
    else
        return 1
    fi
}

# 跨平台打开浏览器
open_browser() {
    local url="http://127.0.0.1:$PORT/index.html"
    if command -v xdg-open &>/dev/null; then
        xdg-open "$url" 2>/dev/null
    elif command -v open &>/dev/null; then
        open "$url" 2>/dev/null
    elif command -v start &>/dev/null; then
        start "$url" 2>/dev/null
    else
        echo "请手动打开浏览器访问: $url"
    fi
}

LOG=$(mktemp 2>/dev/null || echo "/tmp/zy_http_$$.log")
if port_in_use; then
    echo "端口 $PORT 已有服务在运行"
else
    nohup python3 -m http.server $PORT --directory "$DIR" >"$LOG" 2>&1 &
    sleep 1
fi
open_browser
