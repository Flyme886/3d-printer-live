#!/bin/bash
# 把任意一段视频归一化成主播挂件能用的规格：
# 1:1 正方形 · 720×720 · 30fps · 无音轨 · H.264 + faststart
#
# 用法：
#   ./scripts/prepare-clip.command 输入.mp4 idle
#   ./scripts/prepare-clip.command 输入.mp4 welcome 2     # 第 2 段欢迎语
#
# 输出到 assets/talking/<intent>-<序号>.mp4，然后记得把文件名写进 clips.json。
set -e
cd "$(dirname "$0")/.." || exit 1

IN="$1"
INTENT="${2:-talk}"
IDX="${3:-1}"

if [ -z "$IN" ] || [ ! -f "$IN" ]; then
  echo "用法：./scripts/prepare-clip.command 输入.mp4 [idle|welcome|thanks|printing|done|talk] [序号]"
  exit 1
fi
if ! command -v ffmpeg >/dev/null; then
  echo "需要 ffmpeg：brew install ffmpeg"
  exit 1
fi

OUT="assets/talking/${INTENT}-${IDX}.mp4"

# 居中裁正方形 -> 缩放到 720 -> 统一帧率/像素格式 -> 去音轨
ffmpeg -y -loglevel error -i "$IN" -t 6 -an \
  -vf "crop='min(iw,ih)':'min(iw,ih)',scale=720:720:flags=lanczos,fps=30,format=yuv420p" \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -movflags +faststart \
  "$OUT"

DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")
echo "已生成 $OUT（${DUR} 秒）"
echo "把它写进 assets/talking/clips.json 对应的话术数组里，刷新页面即可生效。"
