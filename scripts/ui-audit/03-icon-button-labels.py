# -*- coding: utf-8 -*-
"""扫描无无障碍名称的图标按钮（<button> 内只有图标，且无 aria-label/title）。"""
import io
import os
import re

ROOT = r'E:\System\LeiXiSystem\frontend\src'
SKIP = ('__tests__', '__mocks__', 'node_modules')
btn_re = re.compile(r'<button\b([^<>]*?)(/?)>', re.S)

hits = []
for dirpath, dirnames, filenames in os.walk(ROOT):
    if any(s in dirpath for s in SKIP):
        continue
    for fn in filenames:
        if not fn.endswith('.tsx'):
            continue
        p = os.path.join(dirpath, fn)
        src = io.open(p, encoding='utf-8', errors='ignore').read()
        # 取 <button ...> ... </button> 成对内容
        for m in re.finditer(r'<button\b([^<>]*?)>(.*?)</button>', src, re.S):
            attrs, inner = m.group(1), m.group(2)
            if 'aria-label' in attrs or 'title=' in attrs:
                continue
            # 去掉所有 JSX 表达式与标签，看是否还剩可见文字
            text = re.sub(r'\{[^{}]*\}', '', inner)
            text = re.sub(r'<[^>]+>', '', text)
            text = text.replace('&nbsp;', ' ').strip()
            if text:
                continue  # 有文字，可作可访问名称
            # 剩下的可能是 {cond ? 'A' : 'B'} 这类表达式
            exprs = re.findall(r'\{([^{}]*)\}', inner)
            joined = ' '.join(exprs)
            if re.search(r"[\u4e00-\u9fa5A-Za-z]{2,}", joined):
                continue  # 表达式里有中文/英文文案
            line = src[:m.start()].count('\n') + 1
            rel = os.path.relpath(p, ROOT).replace('\\', '/')
            hits.append((rel, line, ' '.join(inner.split())[:60]))

print('无 aria-label/title 且无可访问文本的 <button> 共 %d 处' % len(hits))
print('-' * 78)
for rel, line, snippet in hits:
    print('%-42s:%-5d %s' % (rel, line, snippet))
