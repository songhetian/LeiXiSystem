# -*- coding: utf-8 -*-
"""扫描非语义可点击元素（div/span/li/td + onClick），支持多行 JSX 属性。"""
import io
import os
import re

ROOT = r'E:\System\LeiXiSystem\frontend\src'
SKIP = ('__tests__', '__mocks__', 'node_modules')

# 匹配 <tag ... > 开标签（非自闭合也涵盖），属性区允许换行
tag_re = re.compile(r'<(div|span|li|td|tr|p|section|article)\b([^<>]*?)(/?>)', re.S)

hits = []
for dirpath, dirnames, filenames in os.walk(ROOT):
    if any(s in dirpath for s in SKIP):
        continue
    for fn in filenames:
        if not fn.endswith(('.tsx', '.ts')):
            continue
        p = os.path.join(dirpath, fn)
        src = io.open(p, encoding='utf-8', errors='ignore').read()
        for m in tag_re.finditer(src):
            attrs = m.group(2)
            if 'onClick' not in attrs:
                continue
            if 'role=' in attrs or 'tabIndex' in attrs or 'onKeyDown' in attrs or 'onKeyPress' in attrs:
                continue  # 已补语义或键盘支持
            line = src[:m.start()].count('\n') + 1
            rel = os.path.relpath(p, ROOT).replace('\\', '/')
            cls = re.search(r'className="([^"]{0,60})', attrs) or re.search(r"className=\{`([^`]{0,60})", attrs)
            hits.append((rel, line, m.group(1), cls.group(1) if cls else '-'))

print('非语义可点击元素（缺 role/tabIndex/onKeyDown）共 %d 处' % len(hits))
print('-' * 78)
for rel, line, tag, cls in hits:
    print('%-46s:%-5d <%s>  %s' % (rel, line, tag, cls))
