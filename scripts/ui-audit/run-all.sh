#!/usr/bin/env bash
# 一键运行前端 UI 设计规范审计全套脚本
# 用法：bash scripts/ui-audit/run-all.sh
set -uo pipefail

PY="C:/Users/Song/.workbuddy/binaries/python/versions/3.13.12/python.exe"

# 取 Windows 风格路径。Git Bash 下 pwd 返回 /e/System/...，交给 Windows 版 Python
# 会被解析成 E:\e\System\...（多一层 e）——必须用 pwd -W 或 cygpath -w。
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -W)"

if [ ! -x "$PY" ]; then
  echo "未找到 managed Python：$PY" >&2
  echo "请改用：python scripts/ui-audit/01-color-contrast.py" >&2
  exit 1
fi

for f in "$SCRIPT_DIR"/0*.py; do
  echo
  echo "###############################################################################"
  echo "# $(basename "$f")"
  echo "###############################################################################"
  # 02/03 在无命中时可能返回非 0，不视为失败
  "$PY" "$f" || true
done
