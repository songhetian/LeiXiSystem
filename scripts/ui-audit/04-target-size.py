# -*- coding: utf-8 -*-
"""扫描 CSS 中交互元素（cursor:pointer / button）的尺寸，找出 < 24px / < 44px 的点击目标。"""
import io
import os
import re

FILES = [
    r'E:\System\LeiXiSystem\frontend\src\app\globals.css',
    r'E:\System\LeiXiSystem\frontend\src\app\arco-overrides.css',
]

rule_re = re.compile(r'([^{}]+)\{([^{}]*)\}', re.S)
# 注意：必须用 (?<![a-z-]) 排除 line-height / max-height 这类复合属性，
# 早期版本用 \b 会误把 line-height 当成 height（\b 在 "line-height" 的连字符后成立）。
size_re = re.compile(r'(?<![a-z-])(width|height|min-width|min-height)\s*:\s*(\d+)px', re.I)

small = []
for f in FILES:
    src = io.open(f, encoding='utf-8', errors='ignore').read()
    for m in rule_re.finditer(src):
        sel, body = m.group(1).strip(), m.group(2)
        if 'cursor: pointer' not in body and 'cursor:pointer' not in body:
            continue
        dims = {}
        for sm in size_re.finditer(body):
            dims[sm.group(1).lower()] = int(sm.group(2))
        w = dims.get('width') or dims.get('min-width')
        h = dims.get('height') or dims.get('min-height')
        if w is None and h is None:
            continue
        eff_w = w if w is not None else h
        eff_h = h if h is not None else w
        if eff_w < 44 or eff_h < 44:
            # 行号取「选择器首行」而非正则匹配起点：group(1) 含前导空行/注释，
            # 直接用 m.start() 会往前偏 1~2 行（曾把 .page-tab-close 报成 1754 而非 1756）。
            sel_start = m.start(1) + (m.group(1).rfind('\n') + 1)
            line = src[:sel_start].count('\n') + 1
            sel_show = ' '.join(sel.split())[:56]
            small.append((os.path.basename(f), line, sel_show, eff_w, eff_h))

print('可点击元素命中 < 44x44px 的规则共 %d 条' % len(small))
print('%-22s %-7s %-44s %s' % ('文件', '行号', '选择器', '尺寸(w x h)'))
print('-' * 92)
for f, line, sel, w, h in small:
    flag = '<<< 低于 WCAG 2.5.8 最小 24px' if (w < 24 or h < 24) else ''
    print('%-22s %-7d %-44s %sx%s  %s' % (f, line, sel, w, h, flag))
