import 'reflect-metadata';
import { readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * DI 注入完整性守卫（对应 ADR-0013 第 3 条「跨模块走注入 token」的另一半）。
 *
 * 背景：跨模块协作的消费方注入的是**纯 TS interface**（ApprovalClientInterface /
 * NotificationClientInterface）。接口在 `design:paramtypes` 元数据里只会被转译成
 * `Object`，Nest 无法按类型 token 解析 —— 必须由 `@Inject('XXX_CLIENT')` 显式声明。
 * 一旦漏写，Nest 会在**应用启动**时抛 UnknownDependenciesException：
 * 整个后端起不来（不是某一个接口 500），而单元测试用 mock 手工 new 服务，
 * 恰好绕过容器装配，永远测不出来。
 *
 * 本用例用反射扫全部生产 Service：凡构造参数的设计类型为 `Object`
 * （即接口/any，无法按类型注入），都必须存在对应的自声明 token。
 */

const SRC_DIR = join(__dirname, '..');

/** 收集 src 下所有 *.service.ts 生产源码（排除测试文件） */
function collectServiceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectServiceFiles(full));
      continue;
    }
    if (!entry.endsWith('.service.ts')) continue;
    files.push(full);
  }
  return files;
}

/** Nest 存放「显式声明 token」的元数据键（SELF_DECLARED_DEPS_METADATA） */
const SELF_DECLARED_DEPS = 'self:paramtypes';

describe('DI 注入完整性（接口类型必须显式声明 token）', () => {
  it('所有 Service 的接口型构造参数都声明了 @Inject(token)', () => {
    const violations: string[] = [];

    for (const file of collectServiceFiles(SRC_DIR)) {
      const rel = relative(SRC_DIR, file).split('\\').join('/');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const moduleExports = require(file);

      for (const [exportName, exported] of Object.entries<any>(moduleExports)) {
        if (typeof exported !== 'function') continue;

        const paramTypes: any[] = Reflect.getMetadata('design:paramtypes', exported) ?? [];
        const selfDeclared: { index: number }[] = Reflect.getMetadata(SELF_DECLARED_DEPS, exported) ?? [];

        paramTypes.forEach((paramType, index) => {
          // Object = 接口 / any：Nest 无法按类型解析，必须显式给 token
          if (paramType === Object && !selfDeclared.some((d) => d.index === index)) {
            violations.push(`${rel} → ${exportName} 第 ${index + 1} 个构造参数`);
          }
        });
      }
    }

    expect(violations).toEqual([]);
  });
});