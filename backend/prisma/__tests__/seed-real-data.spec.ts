import {
  RS_DEPARTMENTS,
  RS_POSITIONS,
  RS_EMPLOYEES,
  RS_TRANSFERS,
  RS_RESIGNATIONS,
  RS_REIMBURSEMENTS,
  RS_CHANGE_LOGS,
  REIMBURSEMENT_TYPES,
  resolveEmployeeUsers,
  type RSEmployee,
  type RSTransfer,
  type RSResignation,
  type RSReimbursement,
} from '../seed-real-data';

const byNo = new Map<string, RSEmployee>(RS_EMPLOYEES.map((e) => [e.employeeNo, e]));
const POSITIONS = new Set<string>(RS_POSITIONS.map((p) => p.name));
const DEPARTMENTS = new Set<string>(RS_DEPARTMENTS.map((d) => d.name));
const TRANSFER_TYPES = new Set<string>(['transfer', 'promotion', 'demotion', 'salary_adjust']);

describe('prisma/seed-real-data.ts 真实数据契约', () => {
  it('员工数达到预期规模（30 名）且工号唯一', () => {
    expect(RS_EMPLOYEES.length).toBe(30);
    expect(new Set(RS_EMPLOYEES.map((e) => e.employeeNo)).size).toBe(30);
  });

  it('每位员工字段完整：姓名/手机号/薪资/入职日期/部门/职位均已填写', () => {
    for (const e of RS_EMPLOYEES) {
      expect(e.name.trim()).not.toBe('');
      expect(/^1[3-9]\d{9}$/.test(e.phone)).toBe(true);
      expect(e.salary).toBeGreaterThan(0);
      expect(String(e.hireDate)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('每位员工引用的部门与职位必须已定义', () => {
    for (const e of RS_EMPLOYEES) {
      expect([...DEPARTMENTS]).toContain(e.department);
      expect([...POSITIONS]).toContain(e.position);
    }
  });

  it('每位员工都有登录账号（userName）且唯一，用于绑定 User 表', () => {
    expect(new Set(RS_EMPLOYEES.map((e) => e.userName)).size).toBe(RS_EMPLOYEES.length);
    for (const e of RS_EMPLOYEES) {
      expect(e.userName.trim()).not.toBe('');
    }
  });

  it('resolveEmployeeUsers：指定两位员工分别复用 admin/staff 账号，其余各自建独立登录账号', () => {
    const ctx = { adminNo: 'E001', staffNo: 'E013' };
    const resolved = resolveEmployeeUsers(RS_EMPLOYEES, ctx);
    expect(resolved).toHaveLength(RS_EMPLOYEES.length);
    const map = new Map(resolved.map((r) => [r.employee.employeeNo, r]));
    // 管理员/员工演示账号不额外创建用户（userId 复用 admin/staff）
    expect(map.get('E001')?.reuseUser).toBe('admin');
    expect(map.get('E013')?.reuseUser).toBe('staff');
    // 其余 28 人需创建独立账号
    const created = resolved.filter((r) => !r.reuseUser);
    expect(created).toHaveLength(RS_EMPLOYEES.length - 2);
    // 每个都要有独立的登录账号，且 user-name 全局唯一
    const usernames = resolved.map((r) => (r.reuseUser ? r.reuseUser : r.userName));
    expect(new Set(usernames).size).toBe(resolved.length);
  });

  it('调动记录：类型合法、员工存在、生效日期完整', () => {
    for (const t of RS_TRANSFERS as RSTransfer[]) {
      expect([...TRANSFER_TYPES]).toContain(t.type);
      expect(byNo.has(t.employeeNo)).toBe(true);
      expect(String(t.effectiveDate)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('离职记录：员工存在、离职原因与日期完整', () => {
    for (const r of RS_RESIGNATIONS as RSResignation[]) {
      expect(byNo.has(r.employeeNo)).toBe(true);
      expect(r.reason.trim()).not.toBe('');
      expect(String(r.resignDate)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('报销单：报销类型已定义、总金额等于各明细金额之和、金额为正', () => {
    const typeCodes = new Set<string>(RS_REIMBURSEMENTS.map((r) => r.typeCode));
    const allTypeCodes = new Set(REIMBURSEMENT_TYPES.map((t) => t.code));
    for (const code of typeCodes) {
      expect([...allTypeCodes]).toContain(code);
    }
    for (const r of RS_REIMBURSEMENTS as RSReimbursement[]) {
      expect(r.items.length).toBeGreaterThan(0);
      const sum = r.items.reduce((acc, i) => acc + i.amount, 0);
      expect(sum).toBeCloseTo(r.totalAmount, 2);
      expect(r.totalAmount).toBeGreaterThan(0);
      expect(byNo.has(r.applicantNo)).toBe(true);
    }
  });

  it('员工变动流水：所有记录引用已存在员工', () => {
    for (const c of RS_CHANGE_LOGS) {
      expect(byNo.has(c.employeeNo)).toBe(true);
    }
  });
});