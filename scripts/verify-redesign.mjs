#!/usr/bin/env node
// 校验 admin-ui-redesign-final.html 的结构完整性
// 防止再次出现「CSS 缺花括号导致全局样式崩坏」这类问题。
// 用法：node scripts/verify-redesign.mjs
import fs from 'fs';
import path from 'path';

const file = path.resolve(process.argv[2] || 'admin-ui-redesign-final.html');
const s = fs.readFileSync(file, 'utf8');

const errors = [];

// 1) CSS 花括号配平
const styleStart = s.indexOf('<style>');
const styleEnd = s.indexOf('</style>');
if (styleStart < 0 || styleEnd < 0) {
  errors.push('未找到 <style> 标签');
} else {
  const css = s.slice(styleStart + 7, styleEnd);
  let open = 0, close = 0;
  for (const c of css) { if (c === '{') open++; else if (c === '}') close++; }
  if (open !== close) errors.push(`CSS 花括号不配平：{ = ${open}, } = ${close}, diff = ${open - close}`);
}

// 2) div / label 配平
const divDiff = (s.match(/<div\b/g) || []).length - (s.match(/<\/div>/g) || []).length;
if (divDiff !== 0) errors.push(`div 标签不配平：diff = ${divDiff}`);
const labelDiff = (s.match(/<label\b/g) || []).length - (s.match(/<\/label>/g) || []).length;
if (labelDiff !== 0) errors.push(`label 标签不配平：diff = ${labelDiff}`);

// 3) 页面 radio 与 page-view 对应
const radios = [...s.matchAll(/id="(pg-[a-z]+)" class="pg-state"/g)].map(m => m[1]);
const views = [...s.matchAll(/id="page-([a-z]+)"/g)].map(m => m[1]);
const radioSet = new Set(radios);
for (const v of views) if (!radioSet.has('pg-' + v)) errors.push(`页面 view #page-${v} 缺少对应 radio pg-${v}`);
for (const r of radios) if (!views.includes(r.slice(3))) errors.push(`radio ${r} 缺少对应 page-view`);

// 4) 弹窗 checkbox 与 modal-mask 对应
const checks = [...s.matchAll(/id="(m-[a-z-]+)" class="pg-state"/g)].map(m => m[1]);
const masks = [...s.matchAll(/class="modal-mask" id="(modal-[a-z-]+)"/g)].map(m => 'modal-' + m[1].slice(6));
const checkSet = new Set(checks);
for (const m of masks) if (!checkSet.has('m-' + m.slice(6))) errors.push(`modal-mask ${m} 缺少对应 checkbox`);
for (const c of checks) if (!masks.includes('modal-' + c.slice(2))) errors.push(`checkbox ${c} 缺少对应 modal-mask`);

// 5) label[for] 引用有效性
const refs = [...s.matchAll(/for="(pg-[a-z]+|m-[a-z-]+)"/g)].map(m => m[1]);
const allIds = new Set([...radios, ...checks]);
const bad = refs.filter(r => !allIds.has(r));
if (bad.length) errors.push(`label for 无效引用：${bad.join(', ')}`);

// 6) 关键渲染规则存在
if (!s.includes('#pg-workbench:checked ~ .app #page-workbench')) errors.push('缺少 page-show 规则');
if (!s.includes('#m-emp-add:checked ~ .modal-mask#modal-emp-add')) errors.push('缺少 modal-show 规则');

// 输出
console.log('==== 校验结果 ====');
console.log(`页面 radio: ${radios.length}  页面 view: ${views.length}  弹窗 checkbox: ${checks.length}  modal-mask: ${masks.length}`);
if (errors.length) {
  console.log('❌ 发现问题：');
  errors.forEach(e => console.log('  - ' + e));
  process.exit(1);
} else {
  console.log('✅ 全部通过：CSS 配平、标签配平、radio/view 对应、checkbox/mask 对应、for 引用、关键规则均正常');
}
