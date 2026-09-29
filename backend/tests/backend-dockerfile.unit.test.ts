/**
 * 后端镜像构建约束测试
 *
 * 这几条都是「改错了本地 `pnpm dev` 完全无感、只在容器里炸/变胖」的坑，
 * 且都看着像多余的讲究，极易被后人顺手「简化」掉。故用静态断言钉死。
 * 背景见 docs/adr/0017-migration-baseline-and-boot-chain.md 增补章节。
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const BACKEND_DIR = join(__dirname, '..');
const DOCKERFILE = join(BACKEND_DIR, 'Dockerfile');

/** 按 FROM ... AS <stage> 切分多阶段，返回 阶段名 → 该阶段正文 */
function splitStages(content: string): Record<string, string> {
  const stages: Record<string, string> = {};
  let current: string | null = null;
  for (const line of content.split('\n')) {
    const m = line.match(/^FROM\s+\S+\s+AS\s+(\S+)/i);
    if (m) {
      current = m[1];
      stages[current] = '';
      continue;
    }
    if (current) stages[current] += `${line}\n`;
  }
  return stages;
}

/** 去掉整行注释：注释里会写反模式字样（如「绝不能写成 chown -R node:node /app」），
 *  断言必须只针对真实指令，否则会被自己的说明文字误伤 */
function stripComments(content: string): string {
  return content
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
}

describe('后端 Dockerfile 构建约束', () => {
  const content = readFileSync(DOCKERFILE, 'utf-8');
  const instructions = stripComments(content);
  const stages = splitStages(instructions);

  it('声明 builder / runner 两阶段', () => {
    expect(Object.keys(stages)).toEqual(expect.arrayContaining(['builder', 'runner']));
  });

  it('两阶段都安装 openssl（Prisma 靠它探测 libssl 版本，缺失则回落到 openssl-1.1.x 引擎）', () => {
    expect(stages.builder).toMatch(/apt-get install -y --no-install-recommends openssl/);
    expect(stages.runner).toMatch(/apt-get install -y --no-install-recommends openssl/);
  });

  it('两阶段都先把 Debian 源换到国内镜像再 apt-get update', () => {
    // 实测本机到 deb.debian.org:80 是 connect refused，apt 索引拉不下来只留 W: 警告，
    // 随后 install 报 `E: Unable to locate package openssl` —— 看着像包名写错，实为网络不通。
    for (const stage of ['builder', 'runner']) {
      const sedIdx = stages[stage].indexOf('mirrors.aliyun.com');
      const updateIdx = stages[stage].indexOf('apt-get update');
      expect(sedIdx).toBeGreaterThan(-1);
      expect(updateIdx).toBeGreaterThan(-1);
      expect(sedIdx).toBeLessThan(updateIdx);
    }
  });

  it('不得对整个 /app 递归 chown', () => {
    // overlayfs 下递归改属主触发 copy-up，会把整个 node_modules（约 1.5G）
    // 复制进新层，镜像体积直接翻倍（实测 4.26GB）。
    expect(instructions).not.toMatch(/chown\s+-R\s+node:node\s+\/app\b/);
  });

  it('uploads 目录单独归属 node（运行期唯一写入点）', () => {
    expect(instructions).toMatch(/chown\s+node:node\s+\/app\/backend\/uploads/);
  });

  it('runner 只装 @lei/backend 依赖树，不把 frontend 的 Next/React/Arco 拖进后端镜像', () => {
    expect(stages.runner).toMatch(/pnpm install --frozen-lockfile --filter @lei\/backend\.\.\./);
  });

  it('运行期以非 root 用户启动', () => {
    expect(stages.runner).toMatch(/^USER node$/m);
  });

  it('把 prisma.config.ts 带进 runner（否则运行期读不到配置）', () => {
    expect(stages.runner).toMatch(/COPY --from=builder \/app\/backend\/prisma\.config\.ts/);
  });
});

describe('Prisma 配置存放位置', () => {
  const pkg = JSON.parse(readFileSync(join(BACKEND_DIR, 'package.json'), 'utf-8')) as {
    prisma?: unknown;
  };
  const config = readFileSync(join(BACKEND_DIR, 'prisma.config.ts'), 'utf-8');

  it('package.json 不再保留已被弃用的 prisma 字段', () => {
    // 留着它每次跑 prisma CLI 都会打印
    //   warn The configuration property `package.json#prisma` is deprecated ...
    // Prisma 7 会直接移除该字段，届时容器启动即失败。
    expect(pkg.prisma).toBeUndefined();
  });

  it('seed 命令迁到 prisma.config.ts 的 migrations.seed', () => {
    expect(config).toMatch(/migrations:\s*\{/);
    expect(config).toMatch(/seed:\s*'node --env-file=\.\.\/\.env --import tsx prisma\/seed\.ts'/);
  });

  it('schema 路径显式声明（config 内相对路径按文件所在目录解析，不随 cwd 漂移）', () => {
    expect(config).toMatch(/schema:\s*'prisma\/schema\.prisma'/);
  });
});