# -*- coding: utf-8 -*-
"""统计 --lx-* 设计 token 的定义与使用，找出死 token / 重复值。"""
import io
import os
import re
from collections import Counter

ROOT = r'E:\System\LeiXiSystem\frontend\src'
css_text = ''
tsx_text = ''
for dirpath, dirnames, filenames in os.walk(ROOT):
    if any(s in dirpath for s in ('__tests__', '__mocks__', 'node_modules')):
        continue
    for fn in filenames:
        if fn.endswith('.css'):
            css_text += io.open(os.path.join(dirpath, fn), encoding='utf-8', errors='ignore').read() + '\n'
        elif fn.endswith(('.tsx', '.ts')):
            tsx_text += io.open(os.path.join(dirpath, fn), encoding='utf-8', errors='ignore').read() + '\n'

# 定义：--lx-xxx: value;  （只看 :root 与暗色块里的定义）
defs = {}
for m in re.finditer(r'(--lx-[a-z0-9-]+)\s*:\s*([^;]+);', css_text):
    name, val = m.group(1), m.group(2).strip()
    defs.setdefault(name, []).append(val)

# 使用：var(--lx-xxx) 出现次数
usage = Counter(re.findall(r'var\(\s*(--lx-[a-z0-9-]+)', css_text + tsx_text))

print('=' * 80)
print('A. 定义了但从未被 var() 引用的死 token')
print('=' * 80)
dead = []
for name in sorted(defs):
    if usage.get(name, 0) == 0:
        dead.append(name)
        print('  %-34s 定义值: %s' % (name, defs[name][0]))
print('  小计: %d 个' % len(dead))

print()
print('=' * 80)
print('B. 同名 token 在不同主题下取值重复 / 语义重叠（浅色主题内）')
print('=' * 80)
# 取浅色主题（第一次定义）值做对比
light = {k: v[0] for k, v in defs.items() if len(v) >= 1}
by_val = {}
for k, v in light.items():
    if v.startswith('linear-gradient') or v.startswith('var('):
        continue
    by_val.setdefault(v.lower(), []).append(k)
for v, names in sorted(by_val.items()):
    if len(names) > 1:
        print('  %-12s <- %s' % (v, ', '.join(sorted(names))))

print()
print('=' * 80)
print('C. 使用次数最多的 token（TOP 15）')
print('=' * 80)
for name, cnt in usage.most_common(15):
    print('  %-34s %d 次' % (name, cnt))

print()
print('D. 汇总：token 定义 %d 个，被引用 %d 个，死 token %d 个'
      % (len(defs), sum(1 for n in defs if usage.get(n, 0) > 0), len(dead)))
