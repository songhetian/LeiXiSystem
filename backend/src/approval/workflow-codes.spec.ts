import * as fs from 'fs';
import * as path from 'path';
import { BUSINESS_WORKFLOWS, businessModuleOf, isBusinessWorkflowCode } from './workflow-codes';

/**
 * 业务流程登记表契约（ADR-0020）。
 *
 * 业务侧发起审批时硬编码 workflowCode；若某业务的编码没登记，
 * 流程设置页就无法创建出「会被该业务使用」的流程（只能生成孤立流程）。
 * 因此这里反向扫描源码，确认业务侧出现的每个 workflowCode 都已登记。
 */
function collectWorkflowCodeLiterals(): Set<string> {
  const found = new Set<string>();

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        walk(full);
        continue;
      }
      // 跳过测试文件：测试里的字面量不构成业务契约
      if (!entry.name.endsWith('.ts')) continue;
      if (/\.(spec|test)\.ts$/.test(entry.name)) continue;

      const text = fs.readFileSync(full, 'utf8');
      // workflowCode: 'leave' —— 发起审批时传入的编码
      for (const m of text.matchAll(/workflowCode\s*:\s*'([a-z_]+)'/g)) found.add(m[1]);
      // workflowCode === 'leave' —— 审批回调里的业务分支
      for (const m of text.matchAll(/workflowCode\s*===\s*'([a-z_]+)'/g)) found.add(m[1]);
    }
  };

  walk(path.join(__dirname, '..'));
  return found;
}

describe('业务流程登记表（ADR-0020）', () => {
  it('业务侧代码里出现的每个 workflowCode 都必须已登记，否则设置页配置的流程不会生效', () => {
    const used = [...collectWorkflowCodeLiterals()].sort();
    const missing = used.filter((code) => !isBusinessWorkflowCode(code));

    expect(missing).toEqual([]);
  });

  it('请假/加班/补卡/报销 等已接入审批的业务都已登记', () => {
    const registered = BUSINESS_WORKFLOWS.map((w) => w.code);
    expect(registered).toEqual(
      expect.arrayContaining([
        'leave',
        'overtime',
        'punch_makeup',
        'reimbursement',
        'onboarding',
        'probation',
        'resignation',
        'transfer',
        'reward_punishment',
        'cert_request',
        'attendance_appeal',
      ]),
    );
  });

  it('业务编码唯一，且每条都归属一个分组 module', () => {
    const codes = BUSINESS_WORKFLOWS.map((w) => w.code);
    expect(new Set(codes).size).toBe(codes.length);

    for (const w of BUSINESS_WORKFLOWS) {
      expect(w.module).toMatch(/^[a-z]+$/);
      expect(businessModuleOf(w.code)).toBe(w.module);
    }
    expect(businessModuleOf('not_registered')).toBeUndefined();
  });
});
