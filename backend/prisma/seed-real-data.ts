// ===== 真实业务数据种子（替换原 seed.ts 里"公式随机生成的演示/mock 数据"）=====
//
// 宗旨：
// 1) 每一位员工都绑定一个真实 User 账号（userId 关联），方便"我的申请/我的工资条/员工详情"验证；
// 2) 部门、职位、员工、员工事务（入职/离职/调岗/转正）、人员履历、员工变动流水、
//    员工考勤、工资条、薪资、报销 全部为真实、连贯、可核对的数据；
// 3) 幂等可重复执行：组织/用户/员工按唯一键 upsert，批量关系数据在对应表为空时才写入。
//
// 说明：仅用做开发/测试环境真实数据注入；登录密码统一 123456。
import { PrismaClient, EmployeeStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// ===== 类型 =====
export interface RSEmployee {
  employeeNo: string;
  name: string;
  gender: string;
  /** 登录账号 user-name（reuse 固定为 admin/staff 之外必须全局唯一） */
  userName: string;
  department: string;
  position: string;
  hireDate: string; // YYYY-MM-DD
  resignDate?: string;
  phone: string;
  salary: number;
  rating: number;
  education: string;
  skills: string;
  emergencyContact: string;
  emergencyPhone: string;
  address: string;
  status?: EmployeeStatus;
}

export type RSTransferType = 'transfer' | 'promotion' | 'demotion' | 'salary_adjust';
export interface RSTransfer {
  id?: string;
  employeeNo: string;
  type: RSTransferType;
  fromDepartment?: string;
  toDepartment?: string;
  fromPosition?: string;
  toPosition?: string;
  fromSalary?: number;
  toSalary?: number;
  effectiveDate: string;
  reason?: string;
  status: 'approved' | 'completed';
}

export interface RSResignation {
  id?: string;
  employeeNo: string;
  reason: string;
  resignDate: string;
  status: 'approved' | 'completed';
  handoverRemark?: string;
}

export interface RSReimbursementItem {
  name: string;
  itemType?: string;
  expenseDate?: string;
  amount: number;
  description?: string;
}
export interface RSReimbursement {
  id?: string;
  typeCode: string;
  title: string;
  description?: string;
  applicantNo: string;
  items: RSReimbursementItem[];
  totalAmount: number;
  status: 'draft' | 'pending' | 'approving' | 'approved' | 'rejected' | 'cancelled';
  payStatus?: 'pending' | 'paid' | 'failed' | 'cancelled';
}

export interface RSChangeLog {
  id?: string;
  employeeNo: string;
  field: string;
  oldValue?: string | null;
  newValue?: string | null;
  changeType: string; // admin_update / self_update / resign / restore / batch_update
  createdAt?: string;
}

// ===== 组织 =====
export const RS_DEPARTMENTS: { name: string; description: string; managerNo: string }[] = [
  { name: '技术部', description: '负责公司产品研发与技术支持', managerNo: 'E001' },
  { name: '客服部', description: '面向客户的售前售后支持', managerNo: 'E017' },
  { name: '人事财务部', description: '负责人力资源与财务管理', managerNo: 'E029' },
  { name: '市场部', description: '负责品牌与市场推广', managerNo: 'E030' },
];

export const RS_POSITIONS: { name: string }[] = [
  { name: '产品经理' },
  { name: '后端开发工程师' },
  { name: '前端开发工程师' },
  { name: '测试工程师' },
  { name: 'UI设计师' },
  { name: '客服专员' },
  { name: '客服主管' },
  { name: '人事专员' },
  { name: '人事主管' },
  { name: '财务专员' },
  { name: '财务主管' },
  { name: '市场专员' },
];

// ===== 30 名真实员工（每位都有登录账号；E001 复用 admin、E013 复用 staff）=====
export const RS_EMPLOYEES: RSEmployee[] = [
  // ---- 技术部（经理 E001）----
  { employeeNo: 'E001', name: '陈建华', gender: '男', userName: 'admin', department: '技术部', position: '后端开发工程师', hireDate: '2021-03-15', phone: '13800138001', salary: 36000, rating: 5, education: '硕士', skills: '后端架构/分布式系统/团队管理', emergencyContact: '王芳', emergencyPhone: '13900139001', address: '北京市朝阳区望京街道西园2号院' },
  { employeeNo: 'E002', name: '王馨', gender: '女', userName: 'wangxin', department: '技术部', position: '前端开发工程师', hireDate: '2021-06-01', phone: '13800138002', salary: 18000, rating: 4, education: '本科', skills: 'React/Vue/前端工程化', emergencyContact: '王志强', emergencyPhone: '13900139002', address: '北京市海淀区中关村大街1号' },
  { employeeNo: 'E003', name: '李强', gender: '男', userName: 'liqiang', department: '技术部', position: '后端开发工程师', hireDate: '2022-02-14', phone: '13800138003', salary: 20000, rating: 4, education: '本科', skills: 'Node.js/Go/微服务', emergencyContact: '李梅', emergencyPhone: '13900139003', address: '北京市昌平区回龙观街道' },
  { employeeNo: 'E004', name: '张磊', gender: '男', userName: 'zhanglei', department: '技术部', position: '前端开发工程师', hireDate: '2022-05-20', phone: '13800138004', salary: 16000, rating: 3, education: '本科', skills: 'Vue/小程序/可视化', emergencyContact: '张霞', emergencyPhone: '13900139004', address: '北京市丰台区方庄街道' },
  { employeeNo: 'E005', name: '刘洋', gender: '男', userName: 'liuyang', department: '技术部', position: '测试工程师', hireDate: '2021-09-01', phone: '13800138005', salary: 14000, rating: 3, education: '本科', skills: '自动化测试/接口测试', emergencyContact: '刘燕', emergencyPhone: '13900139005', address: '北京市通州区梨园镇' },
  { employeeNo: 'E006', name: '赵敏', gender: '女', userName: 'zhaomin', department: '技术部', position: '产品经理', hireDate: '2019-08-01', phone: '13800138006', salary: 25000, rating: 4, education: '硕士', skills: '需求分析/PRD/项目管理', emergencyContact: '赵刚', emergencyPhone: '13900139006', address: '北京市西城区金融街' },
  { employeeNo: 'E007', name: '孙浩', gender: '男', userName: 'sunhao', department: '技术部', position: '后端开发工程师', hireDate: '2023-03-10', phone: '13800138007', salary: 18000, rating: 3, education: '本科', skills: 'Java/Spring/中间件', emergencyContact: '孙丽', emergencyPhone: '13900139007', address: '北京市大兴区黄村镇' },
  { employeeNo: 'E008', name: '周颖', gender: '女', userName: 'zhouying', department: '技术部', position: '前端开发工程师', hireDate: '2023-07-15', phone: '13800138008', salary: 15000, rating: 3, education: '本科', skills: 'React/TypeScript/小程序', emergencyContact: '周平', emergencyPhone: '13900139008', address: '北京市石景山区鲁谷' },
  { employeeNo: 'E009', name: '吴迪', gender: '男', userName: 'wudi', department: '技术部', position: '测试工程师', hireDate: '2020-04-01', resignDate: '2024-06-30', phone: '13800138009', salary: 16000, rating: 4, education: '本科', skills: '性能测试/质量体系', emergencyContact: '吴敏', emergencyPhone: '13900139009', address: '北京市门头沟区', status: 'resigned' as EmployeeStatus },
  { employeeNo: 'E010', name: '郑楠', gender: '女', userName: 'zhengnan', department: '技术部', position: '产品经理', hireDate: '2022-08-22', phone: '13800138010', salary: 22000, rating: 4, education: '硕士', skills: '商业分析/用户增长', emergencyContact: '郑伟', emergencyPhone: '13900139010', address: '北京市亦庄经济开发区' },
  { employeeNo: 'E011', name: '冯涛', gender: '男', userName: 'fengtao', department: '技术部', position: '后端开发工程师', hireDate: '2024-01-08', phone: '13800138011', salary: 15000, rating: 3, education: '本科', skills: 'Python/数据接口', emergencyContact: '冯雪', emergencyPhone: '13900139011', address: '北京市密云区' },
  { employeeNo: 'E012', name: '董雪', gender: '女', userName: 'dongxue', department: '技术部', position: 'UI设计师', hireDate: '2021-11-01', phone: '13800138012', salary: 15000, rating: 4, education: '本科', skills: '视觉设计/Figma/交互', emergencyContact: '董军', emergencyPhone: '13900139012', address: '北京市朝阳区酒仙桥' },
  // ---- 客服部（经理 E017）----
  { employeeNo: 'E013', name: '王小明', gender: '男', userName: 'staff', department: '客服部', position: '客服专员', hireDate: '2022-03-15', phone: '13800138013', salary: 9000, rating: 3, education: '大专', skills: '客服话术/客户安抚', emergencyContact: '王凤', emergencyPhone: '13900139013', address: '北京市顺义区后沙峪' },
  { employeeNo: 'E014', name: '韩梅梅', gender: '女', userName: 'hanmeimei', department: '客服部', position: '客服专员', hireDate: '2022-06-10', phone: '13800138014', salary: 8500, rating: 3, education: '大专', skills: '工单处理/服务意识', emergencyContact: '韩军', emergencyPhone: '13900139014', address: '北京市延庆区' },
  { employeeNo: 'E015', name: '曾帅', gender: '男', userName: 'zengshuai', department: '客服部', position: '客服专员', hireDate: '2023-01-12', phone: '13800138015', salary: 8000, rating: 3, education: '大专', skills: '在线客服/话术', emergencyContact: '曾琴', emergencyPhone: '13900139015', address: '北京市房山区良乡' },
  { employeeNo: 'E016', name: '宋雅', gender: '女', userName: 'songya', department: '客服部', position: '客服专员', hireDate: '2023-04-08', phone: '13800138016', salary: 8200, rating: 3, education: '大专', skills: '售后支持/好评维护', emergencyContact: '宋勇', emergencyPhone: '13900139016', address: '北京市平谷区' },
  { employeeNo: 'E017', name: '唐晨', gender: '男', userName: 'tangchen', department: '客服部', position: '客服主管', hireDate: '2020-07-17', phone: '13800138017', salary: 13000, rating: 4, education: '本科', skills: '团队管理/投诉处理', emergencyContact: '唐玉', emergencyPhone: '13900139017', address: '北京市朝阳区双井' },
  { employeeNo: 'E018', name: '曹阳', gender: '男', userName: 'caoyang', department: '客服部', position: '客服专员', hireDate: '2023-09-01', phone: '13800138018', salary: 7800, rating: 3, education: '大专', skills: '电话客服', emergencyContact: '曹静', emergencyPhone: '13900139018', address: '北京市门头沟区' },
  { employeeNo: 'E019', name: '何静', gender: '女', userName: 'hejing', department: '客服部', position: '客服专员', hireDate: '2022-11-22', phone: '13800138019', salary: 8300, rating: 3, education: '本科', skills: 'VIP客户维护', emergencyContact: '何磊', emergencyPhone: '13900139019', address: '北京市昌平区回龙观' },
  { employeeNo: 'E020', name: '邓超', gender: '男', userName: 'dengchao', department: '客服部', position: '客服专员', hireDate: '2021-05-30', resignDate: '2024-09-30', phone: '13800138020', salary: 8600, rating: 3, education: '大专', skills: '售前咨询', emergencyContact: '邓芳', emergencyPhone: '13900139020', address: '北京市房山区', status: 'resigned' as EmployeeStatus },
  { employeeNo: 'E021', name: '林薇', gender: '女', userName: 'linwei', department: '客服部', position: '客服专员', hireDate: '2024-02-19', phone: '13800138021', salary: 7500, rating: 3, education: '大专', skills: '工单/回访', emergencyContact: '林强', emergencyPhone: '13900139021', address: '北京市通州区张家湾' },
  { employeeNo: 'E022', name: '罗勇', gender: '男', userName: 'luoyong', department: '客服部', position: '客服专员', hireDate: '2024-05-06', phone: '13800138022', salary: 7200, rating: 2, education: '大专', skills: '在线客服', emergencyContact: '罗燕', emergencyPhone: '13900139022', address: '北京市顺义区牛栏山' },
  { employeeNo: 'E023', name: '高翔', gender: '男', userName: 'gaoxiang', department: '客服部', position: '客服专员', hireDate: '2023-12-11', phone: '13800138023', salary: 7600, rating: 3, education: '大专', skills: '售后处理', emergencyContact: '高雪', emergencyPhone: '13900139023', address: '北京市怀柔区' },
  // ---- 人事财务部（经理 E029）----
  { employeeNo: 'E024', name: '徐丽', gender: '女', userName: 'xuli', department: '人事财务部', position: '人事专员', hireDate: '2021-10-09', phone: '13800138024', salary: 10000, rating: 4, education: '本科', skills: '招聘/员工关系/入离职办理', emergencyContact: '徐刚', emergencyPhone: '13900139024', address: '北京市东城区东直门' },
  { employeeNo: 'E025', name: '陈洁', gender: '女', userName: 'chenjie', department: '人事财务部', position: '财务专员', hireDate: '2022-04-18', phone: '13800138025', salary: 11000, rating: 4, education: '本科', skills: '账务/报销审核', emergencyContact: '陈峰', emergencyPhone: '13900139025', address: '北京市西城区西单' },
  { employeeNo: 'E026', name: '蒋涛', gender: '男', userName: 'jiangtao', department: '人事财务部', position: '财务主管', hireDate: '2019-07-22', phone: '13800138026', salary: 15000, rating: 4, education: '本科', skills: '财务分析/税务', emergencyContact: '蒋华', emergencyPhone: '13900139026', address: '北京市丰台区花乡' },
  { employeeNo: 'E027', name: '汪雪', gender: '女', userName: 'wangxue', department: '人事财务部', position: '人事专员', hireDate: '2023-02-27', phone: '13800138027', salary: 9500, rating: 3, education: '本科', skills: '培训/绩效辅助', emergencyContact: '汪洋', emergencyPhone: '13900139027', address: '北京市海淀区上地' },
  { employeeNo: 'E028', name: '马骏', gender: '男', userName: 'majun', department: '人事财务部', position: '财务专员', hireDate: '2024-06-03', phone: '13800138028', salary: 9000, rating: 2, education: '本科', skills: '出纳/凭证', emergencyContact: '马丽', emergencyPhone: '13900139028', address: '北京市朝阳区三里屯', status: 'probation' as EmployeeStatus },
  { employeeNo: 'E029', name: '朱芳', gender: '女', userName: 'zhufang', department: '人事财务部', position: '人事主管', hireDate: '2018-09-05', phone: '13800138029', salary: 16000, rating: 5, education: '硕士', skills: '人力资源体系/绩效管理', emergencyContact: '朱涛', emergencyPhone: '13900139029', address: '北京市海淀区学院路' },
  // ---- 市场部（经理 E030）----
  { employeeNo: 'E030', name: '梁文', gender: '男', userName: 'liangwen', department: '市场部', position: '市场专员', hireDate: '2024-07-01', phone: '13800138030', salary: 9000, rating: 2, education: '本科', skills: '内容运营/活动策划', emergencyContact: '梁静', emergencyPhone: '13900139030', address: '北京市朝阳区国贸', status: 'probation' as EmployeeStatus },
];

/** 将员工映射为"用户绑定决策"：E001 复用 admin、E013 复用 staff，其余建独立账号（纯函数，便于测试） */
export function resolveEmployeeUsers(
  employees: RSEmployee[],
  ctx: { adminNo: string; staffNo: string },
): { employee: RSEmployee; reuseUser?: 'admin' | 'staff'; userName: string }[] {
  return employees.map((e) => {
    if (e.employeeNo === ctx.adminNo) return { employee: e, reuseUser: 'admin' as const, userName: 'admin' };
    if (e.employeeNo === ctx.staffNo) return { employee: e, reuseUser: 'staff' as const, userName: 'staff' };
    return { employee: e, userName: e.userName };
  });
}

// ===== 员工事务：调动 / 离职（供"员工事务"页面与"人员履历"时间线真实展示）=====
export const RS_TRANSFERS: RSTransfer[] = [
  { id: 't1', employeeNo: 'E017', type: 'promotion', fromDepartment: '客服部', toDepartment: '客服部', fromPosition: '客服专员', toPosition: '客服主管', effectiveDate: '2023-07-01', reason: '工作表现优异，晋升客服主管', status: 'approved' },
  { id: 't2', employeeNo: 'E027', type: 'transfer', fromDepartment: '客服部', toDepartment: '人事财务部', fromPosition: '客服专员', toPosition: '人事专员', effectiveDate: '2023-05-01', reason: '内部部门调动', status: 'completed' },
  { id: 't3', employeeNo: 'E006', type: 'salary_adjust', fromSalary: 23000, toSalary: 25000, effectiveDate: '2023-08-01', reason: '年度绩效调薪', status: 'completed' },
  { id: 't4', employeeNo: 'E003', type: 'salary_adjust', fromSalary: 18000, toSalary: 20000, effectiveDate: '2024-03-01', reason: '绩效加薪', status: 'completed' },
  { id: 't5', employeeNo: 'E002', type: 'salary_adjust', fromSalary: 15000, toSalary: 18000, effectiveDate: '2023-06-01', reason: '职级晋升调薪', status: 'completed' },
];

export const RS_RESIGNATIONS: RSResignation[] = [
  { id: 'r1', employeeNo: 'E009', reason: '个人职业发展规划', resignDate: '2024-06-30', status: 'completed', handoverRemark: '已完成测试用例与文档交接' },
  { id: 'r2', employeeNo: 'E020', reason: '家庭原因需回老家发展', resignDate: '2024-09-30', status: 'approved', handoverRemark: '工单与客户已移交完成' },
];

// ===== 员工变动流水（供"变动流水"页面与员工详情"入职/离职/再次入职"时间线）=====
export const RS_CHANGE_LOGS: RSChangeLog[] = [
  // 曾离职又再次入职（激活状态，详情弹窗展示 入职→离职→再次入职）
  { id: 'c1', employeeNo: 'E006', field: 'status', oldValue: 'active', newValue: 'resigned', changeType: 'resign', createdAt: '2021-03-01' },
  { id: 'c2', employeeNo: 'E006', field: 'status', oldValue: 'resigned', newValue: 'active', changeType: 'restore', createdAt: '2021-06-01' },
  { id: 'c3', employeeNo: 'E012', field: 'status', oldValue: 'active', newValue: 'resigned', changeType: 'resign', createdAt: '2023-02-01' },
  { id: 'c4', employeeNo: 'E012', field: 'status', oldValue: 'resigned', newValue: 'active', changeType: 'restore', createdAt: '2023-05-01' },
  // 已离职员工（状态已置 resigned，且人员履历显示离职记录）
  { id: 'c5', employeeNo: 'E009', field: 'status', oldValue: 'active', newValue: 'resigned', changeType: 'resign', createdAt: '2024-06-30' },
  { id: 'c6', employeeNo: 'E020', field: 'status', oldValue: 'active', newValue: 'resigned', changeType: 'resign', createdAt: '2024-09-30' },
  // 调岗/晋升/调薪带来的字段变动
  { id: 'c7', employeeNo: 'E017', field: 'positionId', oldValue: '客服专员', newValue: '客服主管', changeType: 'admin_update', createdAt: '2023-07-01' },
  { id: 'c8', employeeNo: 'E027', field: 'departmentId', oldValue: '客服部', newValue: '人事财务部', changeType: 'admin_update', createdAt: '2023-05-01' },
  { id: 'c9', employeeNo: 'E003', field: 'salary', oldValue: '18000', newValue: '20000', changeType: 'admin_update', createdAt: '2024-03-01' },
  { id: 'c10', employeeNo: 'E002', field: 'salary', oldValue: '15000', newValue: '18000', changeType: 'admin_update', createdAt: '2023-06-01' },
];

// ===== 报销（类型 + 单据，金额与明细严格核对）=====
export const REIMBURSEMENT_TYPES: { code: string; name: string; description: string }[] = [
  { code: 'travel', name: '差旅费', description: '出差交通住宿' },
  { code: 'entertainment', name: '业务招待费', description: '客户接待餐饮' },
  { code: 'office', name: '办公耗材', description: '办公设备与耗材' },
  { code: 'traffic', name: '市内交通费', description: '市内打车公交' },
  { code: 'welfare', name: '员工福利', description: '团队建设与福利采购' },
];

// 二级费用类型（与 migrations/20261108120000_seed_reimbursement_dicts 保持一致）
export const EXPENSE_TYPES: { name: string; unit: string | null; sortOrder: number }[] = [
  { name: '飞机票', unit: '张', sortOrder: 10 },
  { name: '火车票', unit: '张', sortOrder: 20 },
  { name: '长途汽车票', unit: '张', sortOrder: 30 },
  { name: '住宿费', unit: '晚', sortOrder: 40 },
  { name: '出差补贴', unit: '天', sortOrder: 50 },
  { name: '市内交通费', unit: '次', sortOrder: 60 },
  { name: '停车费', unit: '次', sortOrder: 70 },
  { name: '过路费', unit: '次', sortOrder: 80 },
  { name: '招待餐费', unit: '次', sortOrder: 90 },
  { name: '招待礼品', unit: '份', sortOrder: 100 },
  { name: '办公用品', unit: '件', sortOrder: 110 },
  { name: '打印复印', unit: '次', sortOrder: 120 },
  { name: '快递费', unit: '单', sortOrder: 130 },
  { name: '软件订阅', unit: '项', sortOrder: 140 },
  { name: '手机话费', unit: '月', sortOrder: 150 },
  { name: '宽带费', unit: '月', sortOrder: 160 },
  { name: '团队活动费', unit: '次', sortOrder: 170 },
  { name: '节日礼品', unit: '份', sortOrder: 180 },
  { name: '其他费用', unit: '项', sortOrder: 999 },
];

export const RS_REIMBURSEMENTS: RSReimbursement[] = [
  {
    id: 're1', typeCode: 'travel', title: '出差成都差旅费', description: '8月项目对接出差', applicantNo: 'E013',
    items: [
      { name: '高铁票北京-成都', itemType: '差旅费-交通', expenseDate: '2026-08-10', amount: 585 },
      { name: '市内交通费', itemType: '差旅费-交通', expenseDate: '2026-08-11', amount: 95 },
      { name: '住宿费三天', itemType: '差旅费-住宿', expenseDate: '2026-08-10', amount: 600 },
    ],
    totalAmount: 1280, status: 'approved', payStatus: 'paid',
  },
  {
    id: 're2', typeCode: 'office', title: '开发机配件采购', description: '开发者外设采购', applicantNo: 'E003',
    items: [
      { name: '机械键盘', expenseDate: '2026-08-05', amount: 360 },
      { name: '显示器支架', expenseDate: '2026-08-05', amount: 160 },
    ],
    totalAmount: 520, status: 'approved', payStatus: 'pending',
  },
  {
    id: 're3', typeCode: 'entertainment', title: '客户接待餐费', description: '重要客户宴请', applicantNo: 'E017',
    items: [{ name: '餐厅接待', itemType: '业务招待费-餐饮', expenseDate: '2026-08-12', amount: 680 }],
    totalAmount: 680, status: 'approved', payStatus: 'paid',
  },
  {
    id: 're4', typeCode: 'travel', title: '北京-上海出差', description: '华东渠道会议', applicantNo: 'E001',
    items: [
      { name: '高铁票北京-上海', itemType: '差旅费-交通', expenseDate: '2026-08-18', amount: 553 },
      { name: '住宿费两晚', itemType: '差旅费-住宿', expenseDate: '2026-08-18', amount: 1200 },
      { name: '市内交通', itemType: '差旅费-交通', expenseDate: '2026-08-19', amount: 647 },
    ],
    totalAmount: 2400, status: 'pending',
  },
  {
    id: 're5', typeCode: 'traffic', title: '8月中下旬市内交通费', applicantNo: 'E006',
    items: [{ name: '打车费用', itemType: '市内交通费-打车', expenseDate: '2026-08-20', amount: 320 }],
    totalAmount: 320, status: 'pending',
  },
  {
    id: 're6', typeCode: 'welfare', title: '团队下午茶采购', description: '季度团队建设', applicantNo: 'E024',
    items: [{ name: '下午茶食品', itemType: '员工福利-团建', expenseDate: '2026-08-15', amount: 450 }],
    totalAmount: 450, status: 'rejected',
  },
];

// ===== 主要写库入口 =====
/** 计算一个月的应工作日（去掉周末），返回 YYYY-MM-DD 数组（只到 upperDate 为止） */
/**
 * 演示考勤日期：从「今天」往前回溯 N 个自然日内的全部工作日（周一至周五）。
 * 旧种子把考勤硬编码在 2026-07，任何晚于 8 月的部署/重置，
 * 工作台的趋势图和出勤统计都是一排零 —— 演示数据必须跟着日历走。
 */
function recentWorkdays(lookbackDays: number): Date[] {
  const out: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = lookbackDays; i >= 0; i--) {
    const dt = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const dow = dt.getDay();
    if (dow === 0 || dow === 6) continue;
    out.push(dt);
  }
  return out;
}

/** 写入真实业务数据（幂等）。ctx: { adminUser, staffUser, staffRoleId } */
export async function seedRealData(
  prisma: PrismaClient,
  ctx: { adminUser: { id: number }; staffUser: { id: number }; staffRoleId: number },
): Promise<void> {
  const ADMIN_NO = 'E001';
  const STAFF_NO = 'E013';
  const passwordHash = await bcrypt.hash('123456', 10);

  // 1) 组织：部门 + 职位
  const deptId = new Map<string, number>();
  for (const d of RS_DEPARTMENTS) {
    const existing = await prisma.department.findFirst({ where: { name: d.name } });
    const row = existing
      ? await prisma.department.update({ where: { id: existing.id }, data: { description: d.description } })
      : await prisma.department.create({ data: { name: d.name, description: d.description } });
    deptId.set(d.name, row.id);
  }
  const posId = new Map<string, number>();
  for (const p of RS_POSITIONS) {
    const existing = await prisma.position.findFirst({ where: { name: p.name } });
    const row = existing ?? (await prisma.position.create({ data: { name: p.name } }));
    posId.set(p.name, row.id);
  }

  // 2) 用户 + 员工（绑定 userId；admin/staff 静态账号复用）
  const binding = resolveEmployeeUsers(RS_EMPLOYEES, { adminNo: ADMIN_NO, staffNo: STAFF_NO });
  const empRows: { employeeNo: string; id: number; salary: number; status: string; departmentId: number }[] = [];
  for (const { employee: e, reuseUser } of binding) {
    let userId: number;
    let realName = e.name;
    if (reuseUser === 'admin') {
      userId = ctx.adminUser.id;
      realName = '系统管理员';
    } else if (reuseUser === 'staff') {
      userId = ctx.staffUser.id;
    } else {
      const user = await prisma.user.upsert({
        where: { username: e.userName },
        update: { realName: e.name, departmentId: deptId.get(e.department) ?? null, status: 'active' },
        create: {
          username: e.userName,
          passwordHash,
          realName: e.name,
          phone: e.phone,
          departmentId: deptId.get(e.department) ?? null,
          status: 'active',
        },
      });
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: ctx.staffRoleId } },
        update: {},
        create: { userId: user.id, roleId: ctx.staffRoleId },
      });
      userId = user.id;
    }

    // admin/staff 已有用户则保证同角色至少绑定 staff 视角即可（admin 拥有全部权限）
    if (reuseUser === 'staff') {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId, roleId: ctx.staffRoleId } },
        update: {},
        create: { userId, roleId: ctx.staffRoleId },
      });
    }

    const status: EmployeeStatus = (e.status as EmployeeStatus) ?? EmployeeStatus.active;
    const row = await prisma.employee.upsert({
      where: { employeeNo: e.employeeNo },
      update: {
        userId,
        name: status === 'active' && reuseUser === 'admin' ? '系统管理员' : e.name,
        departmentId: deptId.get(e.department)!,
        positionId: posId.get(e.position) ?? null,
        salary: e.salary,
        status,
        resignDate: e.resignDate ? new Date(e.resignDate) : null,
        phone: e.phone,
        rating: e.rating,
        education: e.education,
        skills: e.skills,
        emergencyContact: e.emergencyContact,
        emergencyPhone: e.emergencyPhone,
        address: e.address,
      },
      create: {
        employeeNo: e.employeeNo,
        userId,
        name: status === 'active' && reuseUser === 'admin' ? '系统管理员' : e.name,
        departmentId: deptId.get(e.department)!,
        positionId: posId.get(e.position) ?? null,
        hireDate: new Date(e.hireDate),
        resignDate: e.resignDate ? new Date(e.resignDate) : null,
        salary: e.salary,
        phone: e.phone,
        status,
        rating: e.rating,
        education: e.education,
        skills: e.skills,
        emergencyContact: e.emergencyContact,
        emergencyPhone: e.emergencyPhone,
        address: e.address,
      },
    });
    empRows.push({ employeeNo: e.employeeNo, id: row.id, salary: e.salary, status, departmentId: deptId.get(e.department)! });
  }

  // 3) 部门负责人
  for (const d of RS_DEPARTMENTS) {
    const manager = empRows.find((r) => r.employeeNo === d.managerNo);
    if (manager) {
      await prisma.department.update({ where: { id: deptId.get(d.name)! }, data: { managerId: manager.id } });
    }
  }

  const activeEmps = empRows.filter((r) => r.status === EmployeeStatus.active || r.status === EmployeeStatus.probation);

  // 4) 员工事务：调动 + 离职 + 入职 + 转正（表为空才写，幂等）
  if ((await prisma.employeeTransfer.count()) === 0) {
    for (const t of RS_TRANSFERS) {
      const emp = empRows.find((r) => r.employeeNo === t.employeeNo)!;
      const toDept = t.toDepartment ? deptId.get(t.toDepartment) ?? null : null;
      await prisma.employeeTransfer.create({
        data: {
          employeeId: emp.id,
          type: t.type as any,
          fromDepartmentId: t.fromDepartment ? deptId.get(t.fromDepartment) ?? null : null,
          toDepartmentId: toDept,
          fromPositionId: t.fromPosition ? posId.get(t.fromPosition) ?? null : null,
          toPositionId: t.toPosition ? posId.get(t.toPosition) ?? null : null,
          fromSalary: t.fromSalary ?? null,
          toSalary: t.toSalary ?? null,
          effectiveDate: new Date(t.effectiveDate),
          reason: t.reason ?? null,
          status: t.status as any,
        },
      });
    }
  }
  if ((await prisma.resignation.count()) === 0) {
    for (const r of RS_RESIGNATIONS) {
      const emp = empRows.find((x) => x.employeeNo === r.employeeNo)!;
      await prisma.resignation.create({
        data: {
          employeeId: emp.id,
          reason: r.reason,
          resignDate: new Date(r.resignDate),
          status: r.status as any,
          handoverRemark: r.handoverRemark ?? null,
        },
      });
    }
  }
  // 转正记录：试用期员工（E028/E030）——起始日取各自真实入职日期
  if ((await prisma.probation.count()) === 0) {
    for (const no of ['E028', 'E030']) {
      const emp = empRows.find((r) => r.employeeNo === no)!;
      const rs = RS_EMPLOYEES.find((e) => e.employeeNo === no)!;
      const d = new Date(rs.hireDate);
      await prisma.probation.create({
        data: {
          employeeId: emp.id,
          probationStartDate: d,
          probationEndDate: new Date(d.getFullYear(), d.getMonth() + 3, d.getDate()),
          performance: '表现良好，建议按期转正',
          status: 'pending',
        },
      });
    }
  }
  // 入职登记：一位新员工草稿/待审批（真实入职事务样例）
  if ((await prisma.onboarding.count()) === 0) {
    const d = deptId.get('技术部')!;
    await prisma.onboarding.create({
      data: {
        name: '苏晴',
        gender: '女',
        phone: '13800138131',
        email: 'suqing@example.com',
        departmentId: d,
        positionId: posId.get('前端开发工程师'),
        hireDate: new Date('2026-09-01'),
        probationMonths: 3,
        salary: 12000,
        status: 'pending',
        createdBy: ctx.adminUser.id,
        remark: '校招前端岗位，待入职',
      },
    });
  }

  // 5) 员工变动流水（表为空才写；changeType 对齐后端 EmployeeChangeLog 联合）
  if ((await prisma.employeeChangeLog.count()) === 0) {
    const empIdOf = (no: string) => empRows.find((r) => r.employeeNo === no)!.id;
    for (const c of RS_CHANGE_LOGS) {
      await prisma.employeeChangeLog.create({
        data: {
          employeeId: empIdOf(c.employeeNo),
          field: c.field,
          oldValue: c.oldValue ?? null,
          newValue: c.newValue ?? null,
          changeType: c.changeType,
          changedBy: ctx.adminUser.id,
          createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
        },
      });
    }
  }

  // 6) 班次 + 排班 + 考勤日报 + 月度（真实考勤数据）
  const shiftDefs = [
    { name: '早班', startTime: '09:00', endTime: '18:00', restDuration: 60, lateThreshold: 15, earlyThreshold: 15, useGlobalThreshold: true, color: '#3B82F6', description: '标准早班 9:00-18:00', isActive: true },
    { name: '行政班', startTime: '09:00', endTime: '17:30', restDuration: 60, lateThreshold: 10, earlyThreshold: 10, useGlobalThreshold: true, color: '#10B981', description: '行政班次 9:00-17:30', isActive: true },
  ];
  const shiftId = new Map<string, number>();
  for (const s of shiftDefs) {
    const row = await prisma.shift.upsert({ where: { name: s.name }, update: {}, create: s });
    shiftId.set(s.name, row.id);
  }

  // 近 60 天的工作日：趋势图/出勤统计/月度汇总在任何时间演示都「活着」
  const monthDays = recentWorkdays(60);
  if ((await prisma.schedule.count()) === 0) {
    const rows: any[] = [];
    for (const emp of activeEmps) {
      const shift = shiftId.get(emp.departmentId === deptId.get('人事财务部') ? '行政班' : '早班')!;
      for (const wd of monthDays) rows.push({ employeeId: emp.id, shiftId: shift, workDate: wd });
    }
    await prisma.schedule.createMany({ data: rows, skipDuplicates: true });
  }
  if ((await prisma.punchLog.count()) === 0) {
    const rows: any[] = [];
    let seq = 0;
    const empNoOf = new Map(empRows.map((r) => [r.id, r.employeeNo]));
    for (const emp of activeEmps) {
      for (const wd of monthDays) {
        const late = seq % 13 === 0;
        const inT = new Date(wd); inT.setHours(8, late ? 58 : 45 + (seq % 12), 0, 0);
        const outT = new Date(wd); outT.setHours(18, seq % 10, 0, 0);
        rows.push({ employeeNo: empNoOf.get(emp.id), deviceNo: 'REAL-001', punchTime: inT, punchType: 'in', source: 'import', status: 'matched' });
        rows.push({ employeeNo: empNoOf.get(emp.id), deviceNo: 'REAL-001', punchTime: outT, punchType: 'out', source: 'import', status: 'matched' });
        seq++;
      }
    }
    await prisma.punchLog.createMany({ data: rows, skipDuplicates: true });
  }
  if ((await prisma.attendanceDaily.count()) === 0) {
    const rows: any[] = [];
    let seq = 0;
    for (const emp of activeEmps) {
      for (const wd of monthDays) {
        const late = seq % 13 === 0;
        const inT = new Date(wd); inT.setHours(8, late ? 58 : 50, 0, 0);
        const outT = new Date(wd); outT.setHours(18, 10, 0, 0);
        rows.push({
          employeeId: emp.id, workDate: wd, firstPunch: inT, lastPunch: outT, punchCount: 2,
          lateMinutes: late ? 15 : 0, earlyMinutes: 0, overtimeMinutes: 0, leaveDays: 0,
          status: late ? 'late' : 'normal',
        });
        seq++;
      }
    }
    await prisma.attendanceDaily.createMany({ data: rows, skipDuplicates: true });
  }
  // 月度考勤（上月整月 confirmed）
  for (const emp of activeEmps) {
    await prisma.attendanceMonthly.upsert({
      where: { employeeId_month: { employeeId: emp.id, month: '2026-07' } },
      update: {},
      create: {
        employeeId: emp.id, month: '2026-07', workDays: monthDays.length, lateCount: 1,
        totalLateMinutes: 15, earlyCount: 0, totalEarlyMinutes: 0, absentDays: 0, leaveMinutes: 0,
        overtimeHours: 0, status: 'confirmed', confirmedBy: ctx.adminUser.id, confirmedAt: new Date(2026, 7, 2),
      },
    });
  }

  // 7) 薪资项 + 薪资批次 + 明细 + 工资条（稳定近两月）
  const perf = (salary: number) => Math.round((salary * 0.1) / 10) * 10;
  const meal = 300;
  await prisma.salaryItem.upsert({ where: { code: 'base' }, update: {}, create: { code: 'base', name: '基础工资', type: 'fixed', sortOrder: 1 } });
  await prisma.salaryItem.upsert({ where: { code: 'meal' }, update: {}, create: { code: 'meal', name: '餐补', type: 'fixed', amount: meal, sortOrder: 2 } });
  await prisma.salaryItem.upsert({ where: { code: 'performance' }, update: {}, create: { code: 'performance', name: '绩效奖金', type: 'variable', sortOrder: 3 } });

  const payrollDefs = [
    { month: '2026-06', status: 'confirmed' as const, confirmedAt: new Date(2026, 6, 1) },
    { month: '2026-07', status: 'published' as const, confirmedAt: new Date(2026, 7, 1), publishedAt: new Date(2026, 7, 3) },
  ];
  for (const p of payrollDefs) {
    let run = await prisma.payrollRun.findUnique({ where: { month: p.month } });
    if (!run) {
      const total = activeEmps.reduce((s, e) => s + e.salary + meal + perf(e.salary), 0);
      run = await prisma.payrollRun.create({
        data: {
          month: p.month, status: p.status, totalEmployees: activeEmps.length, totalAmount: total,
          checkedBy: ctx.adminUser.id, checkedAt: p.confirmedAt, confirmedBy: ctx.adminUser.id, confirmedAt: p.confirmedAt,
          publishedBy: p.status === 'published' ? ctx.adminUser.id : null,
          publishedAt: (p as any).publishedAt ?? null,
          remark: '真实薪资数据',
        },
      });
    }
    const detailCount = await prisma.payrollDetail.count({ where: { runId: run.id } });
    if (detailCount === 0) {
      const details: any[] = [];
      for (const emp of activeEmps) {
        details.push({ runId: run.id, employeeId: emp.id, itemCode: 'base', itemName: '基础工资', amount: emp.salary });
        details.push({ runId: run.id, employeeId: emp.id, itemCode: 'meal', itemName: '餐补', amount: meal });
        details.push({ runId: run.id, employeeId: emp.id, itemCode: 'performance', itemName: '绩效奖金', amount: perf(emp.salary) });
      }
      await prisma.payrollDetail.createMany({ data: details, skipDuplicates: true });
    }
    const slipCount = await prisma.payslip.count({ where: { runId: run.id } });
    if (slipCount === 0) {
      const slips = activeEmps.map((emp) => ({
        runId: run.id, employeeId: emp.id, month: p.month,
        totalAmount: emp.salary + meal + perf(emp.salary),
        itemsJson: JSON.stringify([
          { code: 'base', name: '基础工资', amount: emp.salary },
          { code: 'meal', name: '餐补', amount: meal },
          { code: 'performance', name: '绩效奖金', amount: perf(emp.salary) },
        ]),
      }));
      await prisma.payslip.createMany({ data: slips, skipDuplicates: true });
    }
  }

  // 8) 报销类型 + 费用类型 + 报销单 + 费用明细 + 支付
  for (const t of REIMBURSEMENT_TYPES) {
    await prisma.reimbursementType.upsert({ where: { code: t.code }, update: { name: t.name, description: t.description }, create: { code: t.code, name: t.name, description: t.description, status: 'active' } });
  }
  // expense_types 无业务唯一键：按 name 判重，避免每次 seed 都重复插入
  for (const t of EXPENSE_TYPES) {
    const exists = await prisma.expenseType.findFirst({ where: { name: t.name } });
    if (!exists) {
      await prisma.expenseType.create({
        data: { name: t.name, unit: t.unit, sortOrder: t.sortOrder, status: 'active' },
      });
    }
  }
  if ((await prisma.reimbursement.count()) === 0) {
    const typeId = new Map(REIMBURSEMENT_TYPES.map((t) => [t.code, 0]));
    for (const t of REIMBURSEMENT_TYPES) {
      const row = await prisma.reimbursementType.findUniqueOrThrow({ where: { code: t.code } });
      typeId.set(t.code, row.id);
    }
    const empIdOf = (no: string) => empRows.find((r) => r.employeeNo === no)!;
    const now = new Date();
    for (const r of RS_REIMBURSEMENTS) {
      const applicant = empIdOf(r.applicantNo);
      const re = await prisma.reimbursement.create({
        data: {
          typeId: typeId.get(r.typeCode)!, typeCode: r.typeCode,
          title: r.title, description: r.description ?? null, totalAmount: r.totalAmount,
          applicantId: applicant.id, applicantName: r.applicantNo === 'E001' ? '系统管理员' : r.applicantNo,
          departmentId: applicant.departmentId, status: r.status as any,
          createdAt: now,
        },
      });
      await prisma.reimbursementItem.createMany({
        data: r.items.map((i) => ({
          reimbursementId: re.id, name: i.name, itemType: i.itemType ?? null,
          expenseDate: i.expenseDate ? new Date(i.expenseDate) : null, amount: i.amount, description: i.description ?? null,
        })),
      });
      if (r.payStatus) {
        await prisma.reimbursementPayment.create({
          data: {
            reimbursementId: re.id, amount: r.totalAmount,
            paymentDate: new Date(2026, 7, 5), status: r.payStatus as any, payMethod: 'bank',
            remark: '真实报销支付', createdBy: ctx.adminUser.id, paidAt: new Date(2026, 7, 5),
          },
        });
      }
    }
  }
}

// 供 spec / 脚本使用：员工状态占用 guard 用
export type { EmployeeStatus };