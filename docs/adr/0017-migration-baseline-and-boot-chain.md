# ADR-0017: 数据库迁移基线化与生产启动链

- 状态：已接受（Accepted）
- 日期：2026-09-25
- 关联：ADR-0008（数据迁移范围与映射策略，主题为 legacy → 新库的一次性数据搬运，本记录管的是 schema 演进链）

## 背景

生产启动链存在两处必须修的问题，且已在真实库（`leixin_v2`）上取证：

1. **迁移链从未生效且本身断裂**：真实库有 87 张表，但 `_prisma_migrations` 表根本不存在 —— `prisma migrate status` 显示全部 21 个历史迁移未应用。表结构实际由 `prisma db push` 直接落库。同时迁移链本身不闭合：`20260827000000_add_contract_enhance_fields` 对 `contracts` 表做 ALTER，而该表从未被任何迁移创建，导致 `prisma migrate deploy` 在空库上必定失败（P3018）。
2. **启动链危险**：`backend/Dockerfile` 的 CMD 每次启动执行 `prisma db push` + `tsx prisma/seed.ts`。`db push` 会绕过迁移直接对齐 schema，可能静默改结构；`seed` 每次启动无条件执行，对真实数据库是持续性风险。

## 决策

1. **基线化（squash）**：21 个历史迁移压缩为单一基线迁移 `backend/prisma/migrations/0_init/`，内容 = `prisma migrate diff --from-empty --to-schema-datamodel --script` 产出的全量 87 表 DDL，另附幂等种子（`system_setting` 7 条默认值 + `system:setting:update` 权限及 admin 角色绑定）。历史迁移目录全部删除。
2. **既有库走基线标记**：由 `db push` 建成、无迁移历史的库，在 `migrate deploy` 时会报 **P3005**（数据库非空但无迁移历史）。此时执行 `prisma migrate resolve --applied 0_init` 标记基线，再 `migrate deploy` 即空转通过，历史数据不受影响。
3. **启动链收敛到 `backend/entrypoint.sh`**：`migrate deploy` 必跑（含上述 P3005 分支）；种子仅在显式设置 `SEED_ON_BOOT=true` 时执行，默认跳过。
4. **移除 `prisma db push`**：Dockerfile CMD、`backend/package.json` 的 `db:push`、根 `package.json` 的 `dev:full`/`dev:seed` 全部改走 `prisma migrate`。架构变更一律经迁移文件，不再有绕过迁移的入口。

## 后果

- 正向：schema 演进链闭合、可追踪；新库 `migrate deploy` 一条命令建全表；既有库首启自动完成基线标记；真实库不再被启动逻辑改动结构或重复灌种子。
- 成本：迁移无 down 脚本，回滚依赖事前 `mysqldump` 备份（沿用 ADR-0005/0008 的备份纪律）。
- 运维注意：
  - 新库：`migrate deploy` 即可（已在空库验证：全量建表，随后结构快照与真实库逐表一致）。
  - 既有库：首次启动会自动打基线标记；`_prisma_migrations` 一旦存在，**不得再手工 `migrate resolve`**。
  - 已知噪音：`prisma migrate diff` 对 `@db.DateTime`（精度 0）列会永久报告 `MODIFY ... DATETIME`，应用其建议后仍复现，属 Prisma 比对伪差，不代表真实结构差异。结构一致性验收以 `mysqldump --no-data` 快照比对为准（归一化 `AUTO_INCREMENT` 后应仅差 `_prisma_migrations` 表）。

## 增补（2026-09-25 生产构建验收）

首次全栈容器冒烟（`docker compose -p leixi-smoke up -d`，入口 `http://localhost:8088`）暴露出 4 处**只在部署时暴露、本地 `pnpm dev` 完全正常**的运行期缺陷（第 1–4 项）；后续复核镜像构建层又补记 2 项（第 5、6 项）；再复核运行期弃用告警与配置存放位置补记 2 项（第 7、8 项）。以下逐项记录根因与定案，避免后人凭直觉改回去。

### 1. 前端运行期形态：不用 `output: 'standalone'`

- **现象**：容器 CrashLoop，先报 `Cannot find module '/app/frontend/server.js'`，改对路径后转为 `Cannot find module 'next'`。
- **根因**：本仓库是 pnpm workspace，Next 的文件追踪把 `next` / `react` 写成相对符号链接 `../../node_modules/.pnpm/<pkg>@<ver>_<peer哈希>/node_modules/<pkg>`，其参照基准是 tracing root（`next.config.mjs` 所在目录 `/app/frontend`），即假定 store 在 `/app/node_modules/.pnpm`。而 standalone 产物既不含该 store、也不含包本体 —— 无论把 standalone 拷到 `/app` 还是 `/app/frontend`，链接都是悬空的。补齐 store 需要猜含 peer 哈希的目录名，不可靠。
- **定案**：`frontend/Dockerfile` 改为 **`next start`**：runner 侧 `pnpm install --frozen-lockfile --prod --filter @lei/frontend` 自解析模块；builder 侧构建后 `rm -rf .next/standalone .next/cache`，不把无用产物带进运行镜像（镜像 383MB → 518MB，换来的是不再依赖链接推算）。
- **两个必须记住的坑**：
  - 静态资源落位是 `<standalone 根>/.next/static` 与 `<standalone 根>/public`，**不是** `frontend/` 子目录 —— 子目录只是 `COPY` 时被顺带创建的空壳。
  - 入口必须写 `node_modules/next/dist/bin/next`。pnpm 生成的 `node_modules/.bin/next` 是 sh 包装脚本，`node node_modules/.bin/next` 会报 `SyntaxError: missing ) after argument list`。

### 2. 上传目录卷路径错位（数据丢失级）

- **现象**：`leixi-uploads` 卷挂在 `/app/uploads`，但文件实际落在容器可写层。
- **根因**：`local-storage.driver` 用 `resolve(process.cwd(), 'uploads')`，而镜像 `WORKDIR /app/backend` → 真实写入路径是 `/app/backend/uploads`。
- **定案**：卷改为 `leixi-uploads:/app/backend/uploads`；同时 compose 补传 `FILE_STORAGE`（默认 `local`）—— 否则 `.env.production` 的 `FILE_STORAGE=oss` 不会生效，生产仍会落到本地磁盘。nginx 侧原先那个 `leixi-uploads:/usr/share/nginx/uploads:ro` 是空转死配置（`nginx.local.conf` 并无 `/uploads/` location，文件访问统一走后端接口），已删除。

### 3. nginx `/metrics` 缺后端全局前缀

- **现象**：`http://localhost:8088/metrics` 从白名单来源访问返回 `{"code":4000,"message":"参数校验失败"}`。
- **根因**：后端 `main.ts` 是 `setGlobalPrefix('api/v1', { exclude: ['iclock/cdata'] })`，`MetricsController` 的真实路径是 `/api/v1/metrics`；而该 location 的 `proxy_pass http://backend:4001`（无 URI）会把 `/metrics` 原样透传，匹配不到任何路由。**IP 白名单本身是生效的**（请求确实到达了后端，否则会是 403）。
- **定案**：改为 `location = /metrics`（精确匹配，收窄白名单面）+ `proxy_pass http://backend:4001/api/v1/metrics;`。实测 200 / 14694 字节 Prometheus 文本。
- **对照**：`/iclock/` 的 `proxy_pass` 不带前缀是**正确**的，因为 `iclock/cdata` 正是被 `exclude` 掉的那条路由。

### 4. nginx 健康检查永远 unhealthy

- **现象**：容器内 `wget --spider -q http://localhost/` → `Connection refused`，`FailingStreak` 持续增长；但宿主经 8088 访问一切正常。
- **根因**：busybox wget 解析 `localhost` 会优先取 `::1`，而 `nginx.local.conf` 的 `listen 80` 只监听 IPv4 `0.0.0.0:80`。
- **定案**：健康检查改 `http://127.0.0.1/`。注意 backend / frontend 的健康检查用 Node `http.get`，Node 20+ 的 `autoSelectFamily` 会自动回退 IPv4，故不受此坑影响，无需改动。

### 5. 镜像缺 openssl，Prisma 探测不到 libssl 版本（C3）

- **现象**：`docker logs leixi-backend` 打印 `prisma:warn Prisma failed to detect the libssl/openssl version to use, and may not work as expected. Defaulting to "openssl-1.1.x"`。
- **根因**：Prisma 靠 `openssl` 命令探测宿主 libssl 版本，而 `node:22-slim` 是 Debian bookworm，只有 `libssl3` 运行库、没有 CLI，于是回落到 `openssl-1.1.x` 引擎 —— 引擎与运行库大版本对不上，属「能跑但选错引擎」的隐患。
- **定案**：builder 与 runner 两阶段都 `apt-get install -y --no-install-recommends openssl`。实测 `prisma -v` 现在报 `Computed binaryTarget: debian-openssl-3.0.x`，加载 `libquery_engine-debian-openssl-3.0.x.so.node`。
- **踩坑**：首次加该行时构建直接失败在 `E: Unable to locate package openssl`。该报错**看着像包名写错，实际是网络不通** —— 本机到 `deb.debian.org:80` 是 `connect (111: Connection refused)`，`apt-get update` 只留下 `W: Some index files failed to download` 的警告，包索引为空故「找不到包」。定案是在 `apt-get update` 之前先把 `/etc/apt/sources.list.d/debian.sources` 的 `deb.debian.org` / `security.debian.org` 替换为 `mirrors.aliyun.com`（与仓库已有的 npmmirror 取 pnpm 同理）。

### 6. 后端镜像 4.26GB → 1.24GB（C4）

两处相互独立的浪费，叠加才导致体积异常：

- **换层复制（主因）**：原 `RUN mkdir -p /app/backend/uploads && chown -R node:node /app`。overlayfs 下递归改属主会触发 **copy-up**，把已在下层、由 root 持有的整个 `node_modules`（约 1.5G）复制进新层，镜像体积近乎翻倍。定案：只 `chown node:node /app/backend/uploads`（运行期唯一写入点，即 `local-storage.driver` 的 `resolve(process.cwd(), 'uploads')`）；其余文件由 root 持有但都是 644/755，`USER node` 读取无需属主权限 —— 实测容器仍以 `uid=1000(node)` 正常运行且 5/5 healthy。
- **装了无关依赖树**：runner 侧 `pnpm install --frozen-lockfile`（无 filter）会把 frontend 的 Next/React/Arco 整棵树装进后端镜像。定案：改为 `--filter @lei/backend...`。注意**不能改用 `--prod`** —— 后端运行期用 `ts-node` 直跑 TS 源码，`ts-node`/`typescript`/`prisma` CLI/`tsx` 全在 backend 的 `devDependencies` 里（见 `entrypoint.sh`）。
- **结果**：`leixi-smoke-backend` 4.26GB → **1.24GB**（-71%）；容器 healthy、`/api/v1/health` 200、`/` 200。

### 7. Prisma 配置从 `package.json#prisma` 迁到 `prisma.config.ts`

- **现象**：每跑一次 prisma CLI（`prisma validate` / `generate` / `migrate deploy`）都会多打一条
  `warn The configuration property \`package.json#prisma\` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., \`prisma.config.ts\`).`
- **根因**：`@prisma/config` 的 `loadConfigFromFile` 只要在 `configRoot` 的 `package.json` 里读到 `prisma` 字段就会推这条 diagnostics。字段来源是 `backend/package.json` 的 `prisma.seed`。
- **定案**：新建 `backend/prisma.config.ts` 承载 `migrations.seed`（命令串与原值逐字一致，只换存放位置、不改行为）；删除 `backend/package.json` 的 `prisma` 块；`backend/Dockerfile` runner 段补 `COPY --from=builder /app/backend/prisma.config.ts`，让镜像内配置与仓库一致。
- **注意（行为变化）**：一旦存在 Prisma 配置文件，CLI 会打印 `Prisma config detected, skipping environment variable loading.` —— **不再自动加载 `.env`**。已核验所有调用点均自行提供环境变量：`package.json` 的 `migrate` / `migrate:dev` / `db:seed` / `db:reset` 走 `dotenv -e ../.env --`；`entrypoint.sh` 与 Dockerfile 的 `prisma generate` 则依赖 compose `environment` 注入的 `DATABASE_URL`（无需 env 文件）。后续新增 prisma 调用点时必须显式带上环境变量来源。
- **路径语义**：config 内的相对路径（`schema`、`migrations.path` 等）由 `transformPathsInConfigToAbsolute` 统一按**配置文件所在目录**解析，与 cwd 无关。故 `schema: 'prisma/schema.prisma'` 在宿主与容器（`/app/backend/prisma.config.ts`）下都指向同一文件；`migrations.seed` 是命令串、不做路径变换，保持原样。
- **未纳入 tsc**：`backend/tsconfig.json` 的 `include` 仅 `src/**` 与 `tests/**`，`prisma.config.ts` 不在其中，故该文件的类型正确性靠 `prisma validate` 与容器启动实跑保证，而非 `tsc`。

### 8. Fastify 弃用告警 FSTDEP016 / FSTDEP017 溯源

首次冒烟时容器日志出现两条 DeprecationWarning（Fastify 4.28 起加入，声明于 fastify@5 移除）：

- **FSTDEP017（自有代码，已修）**：`backend/src/common/metrics.interceptor.ts` 读 `req.routerPath` 取路由模板以打标签。定案改为 `req.routeOptions?.url` —— Fastify 4.28 的 `types/request.d.ts` 已声明 `readonly routeOptions: Readonly<RequestRouteOptions<...>>`，类型安全，且语义同为「匹配到的路由模板」。全仓 grep 确认 `routerPath` 无其他自有引用、无测试断言依赖。新增 `backend/src/common/metrics.interceptor.spec.ts` 钉死：其中「读取 `routerPath` 即抛错」的用例使任何回退到旧写法的改动直接红，无需等容器日志冒告警。
- **FSTDEP016（上游插件，不补丁化）**：全量扫描 `node_modules/.pnpm` 后，命中 `@fastify/helmet`、`@fastify/static`、`@fastify/swagger`、`@nestjs/platform-fastify`。逐一核对后确认 **不是** `@nestjs/platform-fastify` 的 `fastify-adapter.js` —— 其中 `injectRouteOptions()` 里的 `routeConfig` 是取自 `Reflect.getMetadata(FASTIFY_ROUTE_CONFIG_METADATA, handlerRef)` 的局部变量，并非读取被弃用的 `request.routeConfig`。即告警来自某个上游插件对其自身依赖的调用。**定案：不 patch 第三方产物**（改 node_modules 会在下次安装时被冲掉，且属越界）。等上游升级 fastify@5 后自然消除。
- **验证方式**：容器日志中不再出现 FSTDEP017；FSTDEP016 仍会出现，属已知上游噪音，读到即可忽略。

### 验收基线（本轮实测）

- 后端 `tsc --noEmit` = 0；前端 `tsc --noEmit` = 0。
- 后端 Jest **85 suites / 1123 tests** 全通过（含本轮新增 `helpdesk.service.spec`、`metrics.interceptor.spec`，`backend-dockerfile.unit.test.ts` 扩至 11 条）。
- 前端 attendance + knowledge Jest **14 suites / 131 tests** 全通过。
- 容器 5/5 healthy；`/`、`/_next/static/css/*`、`/api/v1/health`、`/metrics` 均 200；`POST /iclock/cdata` → 401（路由存在，需设备鉴权）。
- schema 漂移核验：`prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script` 输出**仅** 11 组 `MODIFY ... DATETIME`，即第 28 行已记录的 `@db.DateTime`（精度 0）比对伪差，无缺表缺列；schema 87 个 model 与基线迁移 87 条 `CREATE TABLE` 数量一致。
- 上述各项均有静态断言钉死：`backend/tests/entrypoint-boot-chain.unit.test.ts`（45 条）、`backend/tests/nginx-metrics-whitelist.unit.test.ts`（8 条）、`backend/tests/backend-dockerfile.unit.test.ts`（11 条，覆盖第 5、6、7 项）。改 Dockerfile / compose / nginx / prisma 配置前先看这三个文件。

## 增补（2026-10-29 种子写入范围开关 `SEED_DEMO`）

`SEED_ON_BOOT` 只能控制「跑不跑种子」，而种子本身把基础配置与演示数据绑在一起：权限点/角色/admin/默认部门/13 条默认审批流程（`BUSINESS_WORKFLOWS`，ADR-0020）是**任何环境都必须有**的，演示员工/工资条/知识库/公告/staff 演示账号则只该出现在试用环境。初次部署若不开种子，系统无人可登录；开了种子又会把演示数据灌进生产库。

定案：新增 `SEED_DEMO` 二级开关，`prisma/seed.ts` 内 `isDemoSeedEnabled()` 判定，**未设置时默认开启**（开发/试用行为不变）：

| 变量 | 默认 | 语义 |
| --- | --- | --- |
| `SEED_ON_BOOT` | `false` | 是否执行种子脚本（不变） |
| `SEED_DEMO` | `true` | 是否写入演示数据；`false` 时只写权限点/角色/admin 账号/默认部门/13 条默认审批流程，另保证「总部」部门存在以便挂员工 |

- 实现：`seedPermissions(prisma, { demo })` 仅创建 admin 账号，staff 演示账号按 `demo` 跳过；`seedBusiness(prisma, { demo })` 的 `seedRealData` 调用、审批演示单、知识库/公告全部包裹在 `if (demo)` 内，非演示分支改走 `ensureBaseDepartment`。
- 部署：生产首次初始化设 `SEED_ON_BOOT=true` + `SEED_DEMO=false`，灌完把 `SEED_ON_BOOT` 改回 `false`（种子幂等，重复执行不会重复插入，但没必要每次重启都跑）。`admin/123456` 首次登录必须立即改密。
- 测试：`backend/prisma/__tests__/seed-demo-switch.spec.ts` 钉死开关语义（默认 true、`false` 时不建 staff/不调 `seedRealData`/不写知识库与公告、基础配置仍写入）。
