import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

/**
 * ADR-0013 第 3 条：禁止跨模块调用对方 Service（写操作必须走自身模块）。
 * 业务模块之间协作必须「消费方注入 token → 提供方实现接口」，
 * 先例：APPROVAL_CLIENT（approval-client.interface.ts）、NOTIFICATION_CLIENT。
 *
 * 本用例扫描生产源码的 import 语句做静态校验：
 *   除「服务所属模块目录」外的任何文件，都不得 import 该服务类。
 * 仅扫描生产源码（排除 *.spec.ts / *.test.ts），测试里的 mock 类型引用不受限。
 */

/** 禁止被跨模块直接 import 的服务类 → 其所属模块目录名 */
const BOUNDARY_SERVICES: Record<string, string> = {
  ApprovalService: 'approval',
  NotificationService: 'notification',
};

const SRC_DIR = join(__dirname, '..');

/** 收集 src 下所有生产源码（.ts，排除测试文件） */
function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectSourceFiles(full));
      continue;
    }
    if (!entry.endsWith('.ts')) continue;
    if (/\.(spec|test)\.ts$/.test(entry)) continue;
    files.push(full);
  }
  return files;
}

/** 取 import 模块路径中的目录段：'../notification/notification.service' → 'notification'；'./approval.service' → null */
function importedModuleDir(specifier: string): string | null {
  const match = specifier.match(/(?:^|\/)([a-z0-9-]+)\/[a-z0-9.-]+$/);
  return match ? match[1] : null;
}

describe('ADR-0013 模块边界', () => {
  it('业务模块不得直接 import 其他模块的 Service 类（须走注入 token + 接口）', () => {
    const violations: string[] = [];
    const importRe = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'/g;

    for (const file of collectSourceFiles(SRC_DIR)) {
      const rel = relative(SRC_DIR, file).split(sep).join('/');
      const ownModule = rel.split('/')[0];
      const content = readFileSync(file, 'utf8');

      for (const m of content.matchAll(importRe)) {
        const [, namedImports, specifier] = m;
        // 只校验 Service 类；.module / .interface 等结构性引用不受限
        if (!specifier.endsWith('.service')) continue;
        const dir = importedModuleDir(specifier);
        if (!dir || dir === ownModule) continue;

        const names = namedImports
          .split(',')
          .map((n) => n.trim().split(/\s+as\s+/)[0].trim());
        for (const [service, owner] of Object.entries(BOUNDARY_SERVICES)) {
          if (dir === owner && names.includes(service)) {
            violations.push(`${rel} → ${specifier}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});