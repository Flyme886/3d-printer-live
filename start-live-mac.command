#!/bin/bash
# macOS 直播抓取脚本：用带调试端口的 Chrome 打开抖音直播间，再启动数据桥
# 用法：
#   双击运行，按提示输入直播间号
#   或命令行：./start-live-mac.command 123456789
# 前提：先运行 start-mac.command，打印台页面保持打开
cd "$(dirname "$0")" || exit 1

ROOM="$1"
if [ -z "$ROOM" ]; then
  read -r -p "请输入抖音直播间号或完整链接: " INPUT
  ROOM=$(printf '%s' "$INPUT" | grep -oE '[0-9]{5,25}' | tail -1)
fi

if [ -z "$ROOM" ]; then
  echo "没有识别到直播间号，退出。"
  read -r -p "按回车关闭…" _
  exit 1
fi

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ ! -x "$CHROME" ]; then
  echo "没找到 Google Chrome。请安装 Chrome，或手动用下面的命令开一个带调试端口的浏览器："
  echo "  <浏览器路径> --remote-debugging-port=9222 --user-data-dir=\"$PWD/.bridge-profile\" https://live.douyin.com/$ROOM"
  read -r -p "按回车关闭…" _
  exit 1
fi

if curl -s --max-time 2 http://127.0.0.1:9222/json/version > /dev/null ; then
  echo "已检测到调试端口 :9222，复用这个浏览器。"
else
  echo "正在打开直播间窗口（首次需要扫码登录抖音，登录状态会保存在 .bridge-profile）…"
  "$CHROME" \
    --remote-debugging-port=9222 \
    --user-data-dir="$PWD/.bridge-profile" \
    --no-first-run --no-default-browser-check \
    --disable-backgrounding-occluded-windows \
    --disable-renderer-backgrounding \
    --disable-background-timer-throttling \
    "https://live.douyin.com/$ROOM" > /dev/null 2>&1 &
  sleep 5
fi

if [ ! -x "$(command -v node)" ]; then
  echo "没找到 Node.js，请先安装：https://nodejs.org"
  read -r -p "按回车关闭…" _
  exit 1
fi

echo "启动数据桥，房间号 $ROOM（窗口留着小化会暂停采集，别最小化）…"
node douyin-bridge.mjs "$ROOM"
