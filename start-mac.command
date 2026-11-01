#!/bin/bash
# macOS 启动脚本：起本地服务 + 用默认浏览器打开打印台
# 双击即可（若被 Gatekeeper 拦截：右键 → 打开）
cd "$(dirname "$0")" || exit 1

if curl -s -o /dev/null --max-time 2 http://127.0.0.1:8080/ ; then
  echo "服务已在 8080 端口运行，直接打开页面。"
else
  echo "正在启动打印服务 http://127.0.0.1:8080 ..."
  nohup python3 launch.py --server-only > /tmp/printer-server.log 2>&1 &
  sleep 2
fi

open "http://127.0.0.1:8080/"
echo "已打开打印台。演示模式会自动开始打印测试头像。"
echo "关闭服务：lsof -ti:8080 | xargs kill"
