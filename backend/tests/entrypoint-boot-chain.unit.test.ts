/**
 * 生产启动链测试（ADR-0017）
 *
 * 覆盖 backend/entrypoint.sh + backend/Dockerfile + docker-compose.yml 的协同约定。
 * 这些都是"容器一启动就跑"的东西：一旦写错，后果是生产库结构半截、或种子数据覆盖真实数据，
 * 且只在部署时暴露 —— 因此以静态断言把约定钉死（范式同 tests/frontend-proxy.unit.test.ts）。
 *
 * 背景：历史上 Dockerfile CMD 里是 `prisma db push && tsx prisma/seed.ts`，
 * 导致迁移链与 schema 长期脱节、真实库连 _prisma_migrations 都不存在。
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(__dirname, '..', '..');
const ENTRYPOINT = join(REPO_ROOT, 'backend', 'entrypoint.sh');
const BACKEND_DOCKERFILE = join(REPO_ROOT, 'backend', 'Dockerfile');
const FRONTEND_DOCKERFILE = join(REPO_ROOT, 'frontend', 'Dockerfile');
const COMPOSE = join(REPO_ROOT, 'docker-compose.yml');
const MIGRATIONS_DIR = join(REPO_ROOT, 'backend', 'prisma', 'migrations');

const entrypoint = () => readFileSync(ENTRYPOINT, 'utf-8');

/**
 * 去掉整行注释（`#` 开头）。
 * 断言"顺序"与"不得出现某命令"时必须基于剥离注释后的代码：
 * 本脚本与 Dockerfile 的注释里会主动提到 `db push`、`prisma migrate deploy` 等字样用于说明背景，
 * 直接对全文断言会把注释当成代码。
 */
const stripComments = (text: string) =>
  text
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');

describe('entrypoint.sh —— 迁移分支', () => {
  const content = entrypoint();
  const code = stripComments(content);

  it('使用 LF 换行（CRLF 会让 sh 报 ": not found" 直接启动失败）', () => {
    expect(content).not.toMatch(/\r/);
  });

  it('shebang 为 /bin/sh 并开启 set -e（任一步失败即终止容器）', () => {
    expect(content.split('\n')[0]).toBe('#!/bin/sh');
    expect(content).toMatch(/^set -e$/m);
  });

  it('先切到 /app/backend 再执行迁移', () => {
    const cdIdx = code.indexOf('cd /app/backend');
    const deployIdx = code.indexOf('prisma migrate deploy');
    expect(cdIdx).toBeGreaterThanOrEqual(0);
    expect(cdIdx).toBeLessThan(deployIdx);
  });

  it('迁移唯一入口是 prisma migrate deploy', () => {
    expect(code).toMatch(/pnpm --filter @lei\/backend exec prisma migrate deploy/);
  });

  it('捕获迁移输出以判定错误码（2>&1 重定向）', () => {
    expect(code).toMatch(/migrate_out=\$\(pnpm[^)]*prisma migrate deploy 2>&1\)/);
  });

  it('检测到 P3005 时自动基线标记，且标记后重试一次 deploy', () => {
    expect(code).toMatch(/grep -q "P3005"/);
    expect(code).toMatch(/migrate resolve --applied "\$\{BASELINE_MIGRATION\}"/);

    // resolve 之后必须再 deploy 一次，否则空跑一场
    const resolveIdx = code.indexOf('migrate resolve --applied');
    const retryIdx = code.indexOf('prisma migrate deploy', resolveIdx);
    expect(retryIdx).toBeGreaterThan(resolveIdx);
  });

  it('基线迁移名 0_init 指向真实存在的迁移目录', () => {
    const m = code.match(/BASELINE_MIGRATION="([^"]+)"/);
    expect(m).toBeTruthy();
    const name = m![1];
    expect(existsSync(join(MIGRATIONS_DIR, name, 'migration.sql'))).toBe(true);
  });

  it('非 P3005 的迁移失败必须 exit 1，不带半截结构启动', () => {
    expect(code).toMatch(/迁移失败且非 P3005[\s\S]{0,120}?\n\s*exit 1/);
  });

  it('整个脚本不出现 db push / migrate dev / migrate reset（会绕过迁移历史）', () => {
    expect(code).not.toMatch(/db push/);
    expect(code).not.toMatch(/migrate dev/);
    expect(code).not.toMatch(/migrate reset/);
  });
});

describe('entrypoint.sh —— 种子数据开关', () => {
  const content = entrypoint();
  const code = stripComments(content);

  it('种子仅在 SEED_ON_BOOT 精确等于 true 时执行，默认跳过', () => {
    expect(code).toMatch(/if \[ "\$SEED_ON_BOOT" = "true" \]; then/);
    // 必须有 else 分支明确跳过，避免"静默什么都不做"被误读成已执行
    const seedIdx = code.indexOf('prisma/seed.ts');
    expect(seedIdx).toBeGreaterThan(0);
    expect(code.slice(seedIdx)).toMatch(/else[\s\S]*?跳过种子数据/);
  });

  it('种子在迁移之后、启动服务之前执行', () => {
    const deployIdx = code.indexOf('prisma migrate deploy');
    const seedIdx = code.indexOf('prisma/seed.ts');
    const mainIdx = code.indexOf('src/main.ts');
    expect(deployIdx).toBeGreaterThanOrEqual(0);
    expect(deployIdx).toBeLessThan(seedIdx);
    expect(seedIdx).toBeLessThan(mainIdx);
  });

  it('用 exec 启动服务，保证容器信号能传到进程', () => {
    expect(code).toMatch(/^exec node --require ts-node\/register src\/main\.ts$/m);
  });

  it('运行期不得改用 tsx（esbuild 不产 emitDecoratorMetadata，DI 全失效）', () => {
    expect(code).not.toMatch(/tsx src\/main\.ts/);
    // 种子脚本是普通脚本、无 DI，仍可用 tsx，故只对启动行做断言
  });
});

describe('Dockerfile —— 启动链接线', () => {
  const code = stripComments(readFileSync(BACKEND_DOCKERFILE, 'utf-8'));

  it('CMD 交给 entrypoint.sh', () => {
    expect(code).toMatch(/CMD \["sh", "\.\/entrypoint\.sh"\]/);
  });

  it('拷贝 entrypoint.sh 并赋予可执行权限', () => {
    expect(code).toMatch(/COPY backend\/entrypoint\.sh/);
    expect(code).toMatch(/chmod \+x \.\/backend\/entrypoint\.sh/);
  });

  it('chmod 在切换非 root 用户之前，否则 node 用户无法执行', () => {
    const chmodIdx = code.indexOf('chmod +x ./backend/entrypoint.sh');
    const userIdx = code.indexOf('USER node');
    expect(chmodIdx).toBeGreaterThan(0);
    expect(userIdx).toBeGreaterThan(chmodIdx);
  });

  it('镜像内不存在 db push 入口', () => {
    expect(code).not.toMatch(/db push/);
  });

  it('prisma generate 早于 tsc，否则类型检查只能拿到桩 Client', () => {
    const generateIdx = code.indexOf('prisma generate');
    const tscIdx = code.indexOf('tsc -p tsconfig.json');
    expect(generateIdx).toBeGreaterThan(0);
    expect(tscIdx).toBeGreaterThan(generateIdx);
  });
});

describe('Dockerfile —— 构建可复现性（慢网/国内镜像源）', () => {
  const dockerfiles = [
    { name: 'backend', content: readFileSync(BACKEND_DOCKERFILE, 'utf-8') },
    { name: 'frontend', content: readFileSync(FRONTEND_DOCKERFILE, 'utf-8') },
  ];

  it.each(dockerfiles)('$name：corepack 取 pnpm 走 npmmirror（默认源在国内易超时）', ({ content }) => {
    expect(content).toMatch(/ENV COREPACK_NPM_REGISTRY=https:\/\/registry\.npmmirror\.com/);
  });

  it.each(dockerfiles)('$name：.npmrc 在 pnpm install 之前拷入', ({ content }) => {
    const npmrcIdx = content.indexOf('.npmrc');
    const installIdx = content.indexOf('pnpm install');
    expect(npmrcIdx).toBeGreaterThan(0);
    expect(npmrcIdx).toBeLessThan(installIdx);
  });

  it.each(dockerfiles)('$name：pnpm store/cache 走 BuildKit 缓存挂载', ({ content }) => {
    expect(content).toMatch(/--mount=type=cache,id=pnpm-store,target=\/pnpm-store/);
    expect(content).toMatch(/--mount=type=cache,id=pnpm-cache,target=\/pnpm-cache/);
  });

  it.each(dockerfiles)('$name：慢网调优走 pnpm CLI 参数（ENV npm_config_* 在 pnpm 11 全部失效）', ({
    content,
  }) => {
    const code = stripComments(content);
    // 必须压低并发：pnpm 11 默认 min(96, max(cpu*3, 64))，慢链路上会把连接全部拖死
    expect(code).toMatch(/--network-concurrency=\d+/);
    // 必须放宽单请求超时并重试：大二进制包（next/prisma/swc）在慢网下必被 60s 默认超时掐断
    expect(code).toMatch(/--fetch-timeout=\d+/);
    expect(code).toMatch(/--fetch-retries=\d+/);
    expect(code).toMatch(/--fetch-retry-maxtimeout=\d+/);
    // 且不得回退到 ENV 形式（实测 store 缓存命中 0，构建全量重下）
    expect(code).not.toMatch(/npm_config_/);
  });
});

describe('pnpm-workspace.yaml —— pnpm 11 构建脚本放行', () => {
  const content = readFileSync(join(REPO_ROOT, 'pnpm-workspace.yaml'), 'utf-8');
  const code = stripComments(content);

  it('用 allowBuilds 声明放行（v10 的 onlyBuiltDependencies 在 v11 被移除且静默忽略）', () => {
    expect(code).toMatch(/^allowBuilds:$/m);
    // pnpm 11 的 strictDepBuilds 默认为 true：一旦放行声明失效，
    // install 会以 ERR_PNPM_IGNORED_BUILDS 退出 1，镜像构建直接失败。
    expect(code).not.toMatch(/onlyBuiltDependencies/);
  });

  it('放行了会执行 postinstall 的原生/需构建依赖', () => {
    for (const name of ['esbuild', 'prisma', '@prisma/client', '@swc/core']) {
      // YAML 键带不带引号都算合法，这里只校验「键 → true」的映射存在
      expect(code).toMatch(new RegExp(`^\\s*"?${name}"?\\s*:\\s*true\\s*$`, 'm'));
    }
  });
});

describe('frontend/Dockerfile —— 运行期形态', () => {
  const content = readFileSync(FRONTEND_DOCKERFILE, 'utf-8');
  const code = stripComments(content);

  it('运行期用 next start，且显式指定 4000（与 nginx 反代、compose 健康检查一致）', () => {
    expect(code).toMatch(/next", "start", "-p", "4000"/);
  });

  it('入口用 Next 的 JS 入口，不得用 .bin 下的 sh 包装脚本', () => {
    // pnpm 生成的 node_modules/.bin/next 是 sh 脚本，`node .bin/next` 必然报
    // SyntaxError: missing ) after argument list（已实测）。
    expect(code).toMatch(/CMD \["node", "node_modules\/next\/dist\/bin\/next"/);
    expect(code).not.toMatch(/CMD \["node", "node_modules\/\.bin\/next"/);
  });

  it('不依赖 standalone 产物', () => {
    // 本仓库 pnpm 布局下 Next 追踪产出的 standalone/node_modules/{next,react}
    // 是指向 tracing root 之外（/app/node_modules/.pnpm）的悬空符号链接，
    // 直接跑 server.js 必然 MODULE_NOT_FOUND（已实测）。故运行期改用 next start。
    expect(code).not.toMatch(/COPY --from=builder \/app\/frontend\/\.next\/standalone/);
    expect(code).not.toMatch(/CMD \["node", "server\.js"\]/);
  });

  it('builder 阶段清掉 standalone 与 build cache，避免无用产物进运行镜像', () => {
    expect(code).toMatch(/rm -rf \.next\/standalone \.next\/cache/);
  });

  it('运行镜像内安装生产依赖（含 next 可执行文件）', () => {
    expect(code).toMatch(/pnpm install --frozen-lockfile --prod/);
  });

  it('拷贝 next start 所需的构建产物与配置到 frontend/', () => {
    expect(code).toMatch(/COPY --from=builder \/app\/frontend\/\.next \.\/frontend\/\.next/);
    expect(code).toMatch(/COPY --from=builder \/app\/frontend\/public \.\/frontend\/public/);
    expect(code).toMatch(/COPY --from=builder \/app\/frontend\/next\.config\.mjs \.\/frontend\/next\.config\.mjs/);
  });

  it('监听 4000，与 nginx 反代和 compose 端口映射一致', () => {
    expect(code).toMatch(/ENV PORT=4000/);
    expect(code).toMatch(/EXPOSE 4000/);
  });

  it('以非 root 用户 node 运行', () => {
    expect(code).toMatch(/^USER node$/m);
  });
});

describe('docker-compose.yml —— 启动链接线', () => {
  const content = readFileSync(COMPOSE, 'utf-8');

  it('backend 传入 SEED_ON_BOOT，默认 false', () => {
    expect(content).toMatch(/SEED_ON_BOOT: \$\{SEED_ON_BOOT:-false\}/);
  });

  it('backend 显式传入 PORT，与 nginx / 健康检查 / 前端代理的 4001 对齐', () => {
    // main.ts 兜底端口是 3001；不显式传入会让容器 4001 无监听，
    // 健康检查永不通过 → frontend/nginx 永不启动。
    expect(content).toMatch(/PORT: \$\{PORT:-4001\}/);
  });

  it('compose 内不存在 db push 入口', () => {
    expect(content).not.toMatch(/db push/);
  });

  it('backend 传入 FILE_STORAGE，默认 local（可经 .env.production 切 OSS）', () => {
    // 不传则容器内取默认 local，与根 .env 的 FILE_STORAGE=local 行为一致；
    // 但显式传入才能让 .env.production 的 FILE_STORAGE=oss 真正生效。
    expect(content).toMatch(/FILE_STORAGE: \$\{FILE_STORAGE:-local\}/);
  });

  it('上传目录卷挂载到后端实际写入路径 /app/backend/uploads', () => {
    // local-storage.driver 用 resolve(process.cwd(), 'uploads')，而容器 cwd=/app/backend。
    // 挂到 /app/uploads 会让文件落在容器可写层，容器重建即丢数据。
    expect(content).toMatch(/leixi-uploads:\/app\/backend\/uploads/);
    expect(content).not.toMatch(/leixi-uploads:\/app\/uploads/);
  });

  it('nginx 不再挂载 uploads（文件统一走后端接口，nginx 无 /uploads/ location）', () => {
    expect(content).not.toMatch(/leixi-uploads:\/usr\/share\/nginx\/uploads/);
  });

  it('nginx 健康检查写 127.0.0.1 而非 localhost', () => {
    // busybox wget 解析 localhost 会先取 ::1，而 nginx 的 `listen 80` 只监听 IPv4
    // 0.0.0.0:80 → 容器永远 unhealthy（实测 Connection refused）。
    expect(content).toMatch(/wget", "--spider", "-q", "http:\/\/127\.0\.0\.1\/"/);
    expect(content).not.toMatch(/spider[^\n]*http:\/\/localhost\//);
  });
});

describe('迁移目录 —— 基线唯一性', () => {
  it('只保留 0_init 一个基线迁移（历史迁移已被压缩）', () => {
    const dirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    expect(dirs).toEqual(['0_init']);
  });

  it('基线含全量 DDL 与默认种子（system_setting 默认值 + system:setting:update 权限）', () => {
    const sql = readFileSync(join(MIGRATIONS_DIR, '0_init', 'migration.sql'), 'utf-8');
    expect(sql).toMatch(/CREATE TABLE `users`/);
    expect(sql).toMatch(/CREATE TABLE `employees`/);
    expect(sql).toMatch(/INSERT INTO `system_setting`/);
    expect(sql).toMatch(/system:setting:update/);
  });
});