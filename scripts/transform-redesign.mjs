import fs from 'fs';

const file = process.argv[2] || 'admin-ui-redesign-final.html';
let s = fs.readFileSync(file, 'utf8');

const implemented = new Set(['workbench', 'employees', 'punch', 'schedule', 'daily', 'roles']);

// 1) 在 <body> 后插入纯 CSS 状态输入（radio=页面，checkbox=弹窗）
const stateInputs = `<!-- 纯 CSS 交互状态（无需 JS 即可翻页 / 弹窗） -->
<input type="radio" name="pg" id="pg-workbench" class="pg-state" checked>
<input type="radio" name="pg" id="pg-employees" class="pg-state">
<input type="radio" name="pg" id="pg-punch" class="pg-state">
<input type="radio" name="pg" id="pg-schedule" class="pg-state">
<input type="radio" name="pg" id="pg-daily" class="pg-state">
<input type="radio" name="pg" id="pg-roles" class="pg-state">
<input type="radio" name="pg" id="pg-placeholder" class="pg-state">
<input type="checkbox" id="m-emp-add" class="pg-state">
<input type="checkbox" id="m-emp-edit" class="pg-state">
<input type="checkbox" id="m-resign" class="pg-state">
<input type="checkbox" id="m-schedule-edit" class="pg-state">
<input type="checkbox" id="m-schedule-add" class="pg-state">
<input type="checkbox" id="m-schedule-batch" class="pg-state">
<input type="checkbox" id="m-approve" class="pg-state">
<input type="checkbox" id="m-role-add" class="pg-state">
`;
s = s.replace('<body>', '<body>\n' + stateInputs);

// 2) 侧边栏 .side-item div -> label[for]，按是否实现映射 radio
s = s.split('\n').map(line => {
  const m = line.match(/^(\s*)<div class="side-item" data-page="([^"]+)">(.*)<\/div>\s*$/);
  if (m) {
    const [, indent, p, inner] = m;
    const forId = implemented.has(p) ? 'pg-' + p : 'pg-placeholder';
    return `${indent}<label class="side-item" for="${forId}">${inner}</label>`;
  }
  return line;
}).join('\n');

// 3) 工作台快捷磁贴 div[onclick=switchPage] -> label[for]
s = s.split('\n').map(line => {
  const m = line.match(/^(\s*)<div class="tile" onclick="switchPage\('([^']+)'\)">(.*)<\/div>\s*$/);
  if (m) {
    const [, indent, p, inner] = m;
    const forId = implemented.has(p) ? 'pg-' + p : 'pg-placeholder';
    return `${indent}<label class="tile" for="${forId}">${inner}</label>`;
  }
  return line;
}).join('\n');

// 4) openModal 的 button 触发 -> label[for]
s = s.replace(/<button([^>]*)onclick="openModal\('modal-([^']+)'\)"([^>]*)>([\s\S]*?)<\/button>/g,
  '<label$1for="m-$2"$3>$4</label>');

// 5) openModal 的 div 触发（todo-item / cal-cell-data） -> label[for]
s = s.replace(/<div class="todo-item"([^>]*)onclick="openModal\('modal-approve'\)"([^>]*)>([\s\S]*?)<\/div>/g,
  '<label class="todo-item"$1for="m-approve"$2>$3</label>');
s = s.replace(/<div class="cal-cell"><div class="cal-cell-data"([^>]*)onclick="openModal\('modal-schedule-edit'\)"([^>]*)>([\s\S]*?)<\/div><\/div>/g,
  '<div class="cal-cell"><label class="cal-cell-data"$1for="m-schedule-edit"$2>$3</label></div>');

// 6) closeModal 的 div 关闭按钮（含第1151行 typo） -> label[for]
s = s.replace(/<div class="modal-close" onclick="closeModal\('modal-([^']+)'\)">×<\/div>/g,
  '<label class="modal-close" for="m-$1">×</label>');
s = s.replace(/<div class="modal-close" onclick="closeModal\('modal-approve'\)×<\/div>/g,
  '<label class="modal-close" for="m-approve">×</label>');

// 7) closeModal 的 button（取消/确认/驳回等） -> label[for]，丢弃 alert
s = s.replace(/<button([^>]*)onclick="closeModal\('modal-([^']+)'\)(?:;alert\([^)]*\))?">([\s\S]*?)<\/button>/g,
  '<label$1for="m-$2">$3</label>');

// 8) 每个 modal-mask 内加 backdrop label（点遮罩关闭）
s = s.replace(/<div class="modal-mask" id="modal-([^"]+)">/g,
  '<div class="modal-mask" id="modal-$1"><label class="modal-backdrop" for="m-$1"></label>');

// 9) CSS：页面显示规则（:checked 驱动）
s = s.replace(/\.page-view\{display:none\}\n\.page-view\.active\{display:block\}/,
`.page-view{display:none}
#pg-workbench:checked ~ .app #page-workbench,
#pg-employees:checked ~ .app #page-employees,
#pg-punch:checked ~ .app #page-punch,
#pg-schedule:checked ~ .app #page-schedule,
#pg-daily:checked ~ .app #page-daily,
#pg-roles:checked ~ .app #page-roles,
#pg-placeholder:checked ~ .app #page-placeholder{display:block}`);

// 10) CSS：侧栏高亮 + 状态输入隐藏
const navHighlight = `
/* 纯 CSS 导航高亮（无需 JS） */
#pg-workbench:checked ~ .app label.side-item[for="pg-workbench"],
#pg-employees:checked ~ .app label.side-item[for="pg-employees"],
#pg-punch:checked ~ .app label.side-item[for="pg-punch"],
#pg-schedule:checked ~ .app label.side-item[for="pg-schedule"],
#pg-daily:checked ~ .app label.side-item[for="pg-daily"],
#pg-roles:checked ~ .app label.side-item[for="pg-roles"],
#pg-placeholder:checked ~ .app label.side-item[for="pg-placeholder"]{background:var(--brand-bg);color:var(--brand);border-left-color:var(--brand)}
.pg-state{position:absolute;width:0;height:0;opacity:0;pointer-events:none;overflow:hidden}`;
s = s.replace('</style>', navHighlight + '\n</style>');

// 11) CSS：模态框改为 display 驱动 + 滚动条美化
s = s.replace(
`.modal-mask{position:fixed;inset:0;background:rgba(0,0,0,.35);backdrop-filter:blur(4px);z-index:999;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .2s}
.modal-mask.show{opacity:1;pointer-events:auto}
.modal{background:var(--surface);border-radius:var(--radius-lg);width:520px;max-width:90vw;max-height:85vh;overflow-y:auto;box-shadow:0 12px 48px rgba(0,0,0,.12);transform:translateY(12px);transition:transform .2s}
.modal-mask.show .modal{transform:translateY(0)}`,
`.modal-mask{position:fixed;inset:0;background:rgba(0,0,0,.35);backdrop-filter:blur(4px);z-index:999;display:none;align-items:center;justify-content:center}
#m-emp-add:checked ~ .modal-mask#modal-emp-add,
#m-emp-edit:checked ~ .modal-mask#modal-emp-edit,
#m-resign:checked ~ .modal-mask#modal-resign,
#m-schedule-edit:checked ~ .modal-mask#modal-schedule-edit,
#m-schedule-add:checked ~ .modal-mask#modal-schedule-add,
#m-schedule-batch:checked ~ .modal-mask#modal-schedule-batch,
#m-approve:checked ~ .modal-mask#modal-approve,
#m-role-add:checked ~ .modal-mask#modal-role-add{display:flex}
.modal{position:relative;z-index:1;background:var(--surface);border-radius:var(--radius-lg);width:520px;max-width:90vw;max-height:85vh;overflow-y:auto;box-shadow:0 12px 48px rgba(0,0,0,.12)}
.modal-backdrop{position:absolute;inset:0}`);

// 12) CSS：滚动条美化（侧栏 / 内容 / 弹窗 / 权限区）
const scrollbar = `
/* ===== 滚动条美化 ===== */
.side-menu,.content,.modal,.perm-body,.cal-grid{scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.18) transparent}
.side-menu::-webkit-scrollbar,.content::-webkit-scrollbar,.modal::-webkit-scrollbar,.perm-body::-webkit-scrollbar,.cal-grid::-webkit-scrollbar{width:8px;height:8px}
.side-menu::-webkit-scrollbar-thumb,.content::-webkit-scrollbar-thumb,.modal::-webkit-scrollbar-thumb,.perm-body::-webkit-scrollbar-thumb,.cal-grid::-webkit-scrollbar-thumb{background:rgba(0,0,0,.16);border-radius:4px}
.side-menu::-webkit-scrollbar-thumb:hover,.content::-webkit-scrollbar-thumb:hover,.modal::-webkit-scrollbar-thumb:hover,.perm-body::-webkit-scrollbar-thumb:hover,.cal-grid::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.3)}
.side-menu::-webkit-scrollbar-track,.content::-webkit-scrollbar-track,.modal::-webkit-scrollbar-track,.perm-body::-webkit-scrollbar-track,.cal-grid::-webkit-scrollbar-track{background:transparent}`;
s = s.replace('</style>', scrollbar + '\n</style>');

// 13) 重写 <script>：去掉 switchPage/openModal/closeModal，保留时钟/印章/权限/面包屑增强
const newScript = `<script>
// 侧边栏分组折叠（渐进增强：无 JS 时分组默认展开）
function toggleMenu(el){
  const children=el.nextElementSibling;
  if(children && children.classList.contains('side-children')){
    children.classList.toggle('collapsed');
    el.classList.toggle('collapsed');
  }
}
// 面包屑（渐进增强）
const bcMap={workbench:'工作台',employees:'员工管理',punch:'打卡',schedule:'排班管理',daily:'考勤日报',roles:'角色权限',placeholder:'模块预览'};
document.querySelectorAll('input[name="pg"]').forEach(r=>{
  r.addEventListener('change',()=>{
    const id=r.id.replace('pg-','');
    const bc=document.getElementById('breadcrumbPage');
    if(bc&&bcMap[id])bc.textContent=bcMap[id];
  });
});
// 打卡时钟（模拟 punch.tsx 的 setInterval）
(function tick(){
  const now=new Date();
  const pt=document.getElementById('punchTime'); if(pt)pt.textContent=now.toTimeString().split(' ')[0];
  const days=['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
  const pd=document.getElementById('punchDate'); if(pd)pd.textContent=now.getFullYear()+' 年 '+(now.getMonth()+1)+' 月 '+now.getDate()+' 日 '+days[now.getDay()];
  setTimeout(tick,1000);
})();
// 印章模式
function selectStamp(el,name,color){
  document.querySelectorAll('.stamp-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  window._selectedStamp={name,color};
}
// 权限勾选
document.querySelectorAll('.perm-check').forEach(c=>{c.addEventListener('click',()=>c.classList.toggle('checked'));});
</script>`;
s = s.replace(/<script>[\s\S]*?<\/script>/, newScript);

fs.writeFileSync(file, s);
console.log('transform done');
