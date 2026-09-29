# -*- coding: utf-8 -*-
"""雷犀 UI 配色对比度核算（WCAG 2.1 / 2.2）"""
def lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def lum(rgb):
    r, g, b = rgb
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def hex2rgb(h):
    h = h.lstrip('#')
    if len(h) == 3:
        h = ''.join(ch * 2 for ch in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def blend(fg, alpha, bg):
    return tuple(round(fg[i] * alpha + bg[i] * (1 - alpha)) for i in range(3))


W = hex2rgb('#ffffff')
rows = []


def chk(label, fg_hex, bg):
    bg_rgb = hex2rgb(bg) if isinstance(bg, str) else bg
    rows.append((label, ratio(hex2rgb(fg_hex), bg_rgb)))


FAIL, LARGE, PASS = 'FAIL', 'AA-large only', 'PASS'

print('=' * 78)
print('A. 浅色主题 · 文字/图形调色板实测（AA 正文 >=4.5:1，大字与图形 >=3:1）')
print('=' * 78)
chk('text-1 #0f172a on 卡片白', '#0f172a', '#ffffff')
chk('text-2 #334155 on 卡片白', '#334155', '#ffffff')
chk('text-3 #64748b on 卡片白', '#64748b', '#ffffff')
chk('text-4 #94a3b8 on 卡片白  <- 次要/占位文字', '#94a3b8', '#ffffff')
chk('text-4 #94a3b8 on 页面底 #f1f3f8', '#94a3b8', '#f1f3f8')
chk('sider-text #475569 on 侧栏白', '#475569', '#ffffff')
chk('sider-group-text #94a3b8 on 侧栏白  <- 菜单分组标题', '#94a3b8', '#ffffff')
chk('brand #2455D9 on 卡片白', '#2455D9', '#ffffff')

print()
print('-' * 78)
print('B. 语义状态色（StatusTag 实际用法：同色文字 + 同色 8% 透明底）')
print('-' * 78)
SUCC = hex2rgb('#22c55e')
DANG = hex2rgb('#ef4444')
WARN = hex2rgb('#f59e0b')
PRIM = hex2rgb('#2455D9')
chk('success #22c55e on success-bg(8%)', '#22c55e', blend(SUCC, 0.08, W))
chk('danger  #ef4444 on danger-bg(8%)', '#ef4444', blend(DANG, 0.08, W))
chk('warning #f59e0b on warning-bg(8%)', '#f59e0b', blend(WARN, 0.08, W))
chk('info    #2455D9 on info-bg(8%)', '#2455D9', blend(PRIM, 0.08, W))
chk('success #22c55e on 卡片白（裸文字）', '#22c55e', '#ffffff')
chk('warning #f59e0b on 卡片白（裸文字）', '#f59e0b', '#ffffff')
chk('danger  #ef4444 on 卡片白（裸文字）', '#ef4444', '#ffffff')

print()
print('-' * 78)
print('C. 点缀色（菜单分组/图标着色，同色文字 + 8% 底）')
print('-' * 78)
for name, h in [('purple', '#8b5cf6'), ('teal', '#14b8a6'), ('coral', '#f97316'),
                ('pink', '#ec4899'), ('indigo', '#6366f1'), ('emerald', '#10b981')]:
    rgb = hex2rgb(h)
    chk('%s %s on 自身8%%底' % (name, h), h, blend(rgb, 0.08, W))

print()
print('-' * 78)
print('D. 暗色主题')
print('-' * 78)
chk('text-1 #f1f5f9 on 卡片 #151a28', '#f1f5f9', '#151a28')
chk('text-3 #94a3b8 on 卡片 #151a28', '#94a3b8', '#151a28')
chk('text-4 #64748b on 卡片 #151a28  <- 次要文字', '#64748b', '#151a28')
chk('text-4 #64748b on 页面 #0b0f1a', '#64748b', '#0b0f1a')
chk('sider-group-text #64748b on 侧栏 #101527', '#64748b', '#101527')
chk('sider-text #a8b3c7 on 侧栏 #101527', '#a8b3c7', '#101527')
# Arco 主色按钮：bg=--lx-primary(暗色下未变) 配白字
chk('主色按钮 #2455D9 底 vs 页面 #0b0f1a（非文字对比需>=3:1）', '#2455D9', '#0b0f1a')
# 暗色下语义色文字（token 未在暗色块中调整）
DK_CARD = '#151a28'
chk('success #22c55e on 暗色卡片', '#22c55e', DK_CARD)
chk('warning #f59e0b on 暗色卡片', '#f59e0b', DK_CARD)
chk('danger  #ef4444 on 暗色卡片', '#ef4444', DK_CARD)
chk('purple #8b5cf6 on 暗色卡片', '#8b5cf6', DK_CARD)
chk('teal   #14b8a6 on 暗色卡片', '#14b8a6', DK_CARD)
chk('coral  #f97316 on 暗色卡片', '#f97316', DK_CARD)
chk('pink   #ec4899 on 暗色卡片', '#ec4899', DK_CARD)
chk('indigo #6366f1 on 暗色卡片', '#6366f1', DK_CARD)

print()
print('-' * 78)
print('E. 暗色主题下的硬编码浅色（无 data-theme 覆盖）')
print('-' * 78)
chk('.app-header 底色 rgba(255,255,255,.85) 合成后 文字 #f1f5f9', '#f1f5f9',
    blend(W, 0.85, hex2rgb('#0b0f1a')))
print('  .app-header 实际合成底色 = %s（暗色下仍是浅色条）'
      % str(blend(W, 0.85, hex2rgb('#0b0f1a'))))
chk('.page-tabs 底色 rgba(255,255,255,.7) 合成后 文字 #f1f5f9', '#f1f5f9',
    blend(W, 0.7, hex2rgb('#0b0f1a')))
print('  .page-tabs 实际合成底色 = %s' % str(blend(W, 0.7, hex2rgb('#0b0f1a'))))
print('  滚动条 ::-webkit-scrollbar-thumb rgba(0,0,0,.1) on #0b0f1a -> %.2f:1（近乎不可见）'
      % ratio(blend(hex2rgb('#000000'), 0.1, hex2rgb('#0b0f1a')), hex2rgb('#0b0f1a')))
print('  侧栏滚动条 rgba(0,0,0,.08) on #101527 -> %.2f:1'
      % ratio(blend(hex2rgb('#000000'), 0.08, hex2rgb('#101527')), hex2rgb('#101527')))

print()
print('F. 焦点环 rgba(22,93,255,0.10) 3px 在自身底色上的可见度')
print('  浅色：环色 vs 卡片白 -> %.2f:1（WCAG 2.4.13 要求 >=3:1）'
      % ratio(blend(hex2rgb('#165DFF'), 0.1, W), W))
print('  暗色：环色 vs 卡片 #151a28 -> %.2f:1'
      % ratio(blend(hex2rgb('#165DFF'), 0.1, hex2rgb('#151a28')), hex2rgb('#151a28')))
print()
print('=' * 78)
for label, r in rows:
    mark = PASS if r >= 4.5 else (LARGE if r >= 3.0 else FAIL)
    print('%5.2f:1  [%-13s] %s' % (r, mark, label))
