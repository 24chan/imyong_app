#!/usr/bin/env bash
# 구형 한글(.hwp) → .hwp.xhtml (pyhwp 의 hwp5html). 이미 변환된 파일은 건너뜀
set -u
n=0
for f in raw/*/*.hwp; do
  [ -e "$f" ] || continue
  [ -e "$f.xhtml" ] && continue
  out=$(mktemp -d)
  if timeout 120 hwp5html --output "$out" "$f" >/dev/null 2>&1 && [ -e "$out/index.xhtml" ]; then
    cp "$out/index.xhtml" "$f.xhtml"; n=$((n+1))
  else
    echo "변환 실패: $f"
  fi
  rm -rf "$out"
done
echo "hwp 변환 $n 개"
