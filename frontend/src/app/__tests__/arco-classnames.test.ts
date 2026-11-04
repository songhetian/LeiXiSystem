/**
 * Arco 类名 / 自研工具类的「存在性」闸门
 *
 * 背景：本项目两次出现「覆盖样式写在不存在的类名上」——`.arco-form-item-label`
 * （真名 `-label-item`）、`.arco-modal-body`（真名 `-content`）、`.arco-table-tr-checked`
 * （真名 `-row-checked`）等 50 余条规则静默失效，设计值从未生效，且不会有任何报错。
 * CSS 不会因为选择器选不中任何元素而报错，所以只能靠静态闸门兜住。
 *
 * 本闸门做两件事：
 *  1. 自有 CSS 里出现的每个 `.arco-*` 类，必须能在 Arco 的 arco.css 里找到，
 *     或者落在 DOM_ONLY 白名单里（该类由组件 JS 渲染、但 Arco 未给它写样式）。
 *  2. 自有 CSS 里定义的每个 `.lx-*` 类，必须在 src 的 ts/tsx 里被真实引用，
 *     防止再堆积「Tailwind 化之前的工具类残骸」。
 */
import fs from 'fs';
import path from 'path';

const FRONTEND_ROOT = path.join(__dirname, '..', '..', '..');
const CSS_FILES = ['src/app/globals.css', 'src/app/arco-overrides.css'].map((p) =>
  path.join(FRONTEND_ROOT, p),
);
const ARCO_CSS = path.join(
  FRONTEND_ROOT,
  'node_modules',
  '@arco-design',
  'web-react',
  'dist',
  'css',
  'arco.css',
);

/**
 * 由组件 JS 渲染、但 arco.css 里没有样式规则的类名（不属于死代码）。
 * 新增条目必须写明取证位置，否则等于给死类开后门。
 */
const DOM_ONLY: Record<string, string> = {
  'arco-picker-range': '_class/picker/input-range.js:137: cs(prefixCls, prefixCls + "-range")',
  'arco-message-normal': 'Message/index.js:36 messageTypes 含 normal；_class/notice.js:122 拼接',
  'arco-theme-dark': '本项目自建的 body 类（非 Arco 类名），见 arco-overrides.css 末段',
};

function readCss(): string {
  return CSS_FILES.map((f) => fs.readFileSync(f, 'utf-8'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

/** 只取「选择器部分」的类名，避免把声明值里的字符串误判为选择器 */
function selectorClasses(css: string): Set<string> {
  const out = new Set<string>();
  const re = /([^{}]+)\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const selector = m[1];
    if (/^\s*@/.test(selector)) continue;
    for (const c of selector.matchAll(/\.([\w-]+)/g)) out.add(c[1]);
  }
  return out;
}

function arcoKnownClasses(): Set<string> {
  const arco = fs.readFileSync(ARCO_CSS, 'utf-8');
  const out = new Set<string>();
  for (const c of arco.matchAll(/\.(arco-[\w-]+)/g)) out.add(c[1]);
  return out;
}

/** 全部业务源码（排除测试），用于判断 .lx-* 是否真的被挂到 DOM 上 */
function sourceFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', '.next', 'coverage', '__tests__'].includes(entry.name)) continue;
        walk(p);
      } else if (/\.(tsx?|jsx?)$/.test(entry.name) && !/\.(spec|test)\./.test(entry.name)) {
        files.push(p);
      }
    }
  };
  walk(path.join(FRONTEND_ROOT, 'src'));
  return files;
}

describe('Arco 类名存在性闸门', () => {
  const used = selectorClasses(readCss());
  const known = arcoKnownClasses();

  const arcoUsed = [...used].filter((c) => c.startsWith('arco-'));
  const missing = arcoUsed.filter((c) => !known.has(c) && !(c in DOM_ONLY));

  it('自有 CSS 使用的 .arco-* 类名必须在 arco.css 或白名单中', () => {
    expect(missing).toEqual([]);
  });

  it('白名单条目必须仍是「Arco 有渲染、CSS 无样式」的真实类名（防止白名单腐化）', () => {
    // 白名单里的类名若已出现在 arco.css，说明 Arco 后来补了样式 —— 应从白名单移除
    const redundant = Object.keys(DOM_ONLY).filter((c) => known.has(c) && c !== 'arco-theme-dark');
    expect(redundant).toEqual([]);
  });

  it('登录页/表单/表格等关键选择器指向真实类名（回归样例）', () => {
    expect(used.has('arco-form-label-item')).toBe(true);
    expect(used.has('arco-modal-title')).toBe(true);
    expect(used.has('arco-modal-content')).toBe(true);
    expect(used.has('arco-select-focused')).toBe(true);
    expect(used.has('arco-table-row-checked')).toBe(true);
    expect(used.has('arco-input-inner-wrapper')).toBe(true);
    // 曾经写错的类名不得回流
    for (const dead of [
      'arco-form-item-label',
      'arco-modal-header-title',
      'arco-modal-body',
      'arco-table-tr-checked',
      'arco-select-view-focused',
      'arco-input-wrapper',
      'arco-dropdown-item',
      'arco-menu-item-selected',
      'arco-tag-default',
      'arco-btn-default',
    ]) {
      expect(used.has(dead)).toBe(false);
    }
  });

  it('自有 .lx-* 类必须至少被一处源码引用（不留死工具类）', () => {
    const source = sourceFiles()
      .map((f) => fs.readFileSync(f, 'utf-8'))
      .join('\n');
    const lxDefined = [...used].filter((c) => c.startsWith('lx-'));
    expect(lxDefined.length).toBeGreaterThan(50); // 防止解析失效导致空断言
    const unused = lxDefined.filter((c) => !new RegExp(`\\b${c}\\b`).test(source));
    expect(unused).toEqual([]);
  });
});
