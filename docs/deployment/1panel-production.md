# 雷犀管理系统 · 1Panel 生产部署手册

> 适用：代码已上传到 Linux 服务器，使用 1Panel 作为运维面板，域名 `www.leixidianshang.com`，  
> 数据层用阿里云 RDS MySQL + OSS，缓存用编排自带的 Redis 容器。  
> 多客户交付（每家公司一套）见第 10 章。
>
> **本文档会进入 Git 仓库，禁止写入任何真实密钥、账号或密码。** 真实值只放服务器上的  
> `.env.production`（该文件已被 `.gitignore` 排除）。

---

## 0. 从 `git clone` 到上线 · 完整操作步骤

> 按顺序做，每一步都有可复制的命令。细节原理见后续章节。  
> 本章采用 **方式 A：`git clone` + 人工补两个不入库的文件**。

> ⚠️ **不要在服务器上执行 `npm install`（也不需要 `pnpm install`）**。  
> 本项目是 **pnpm 11 workspace**（`pnpm-lock.yaml` + `pnpm-workspace.yaml` + `packageManager: pnpm@11.10.0`），  
> 而两个 Dockerfile 会在**镜像构建阶段**自己执行 `corepack enable` → `pnpm install --frozen-lockfile`。  
> 宿主机只需 Docker / Compose v2 / Git，装不装 Node.js 都无所谓。在宿主机跑 `npm install` 会：  
> ① 生成 `package-lock.json`、与 pnpm 锁文件冲突；② 破坏 workspace 的软链接布局；  
> ③ 触发 pnpm 11 的 `allowBuilds` 构建脚本策略报错；④ **对容器内的依赖毫无作用**，纯属浪费且会污染源码目录。  
> 只有"不用 Docker、直接在宿主机跑 `next dev` 做开发"时才需要装依赖，生产部署不属于这种情况。

### 步骤 1 · 确认服务器软件（一次性）

```bash
docker --version                 # Docker CE
docker compose version           # 必须 v2.x，旧版 Python compose v1 会因 BuildKit 语法失败
docker buildx version            # Dockerfile 用了 RUN --mount=type=cache，必须可用
git --version
free -h                          # 现场构建需 ≥4G 内存，2G 小机容易 OOM
```

1Panel 需已安装且「应用商店 → OpenResty」状态为运行中。服务器**不需要**装 Node.js、npm、pnpm。

### 步骤 2 · 拉取代码

```bash
sudo mkdir -p /opt/leixi && sudo chown -R "$USER" /opt/leixi && cd /opt/leixi
git clone <你的仓库地址> .        # 目标目录必须为空；已有代码则改用 git pull
```

### 步骤 3 · 人工补两个不入库的文件（**漏了必失败**）

`docker-compose.prod.yml` 被 `.gitignore` 排除，`.env.production` 被 `.env*` 排除，  
`git clone` 后**这两个文件都不会存在**。用 1Panel「主机 → 文件」上传，或从本机 `scp`：

```bash
# 本机执行（换成你的服务器地址）
scp docker-compose.prod.yml .env.production root@<服务器IP>:/opt/leixi/

# 服务器上执行
cd /opt/leixi
chmod 600 .env.production        # 含真实密钥，必须收紧权限
chmod 644 docker-compose.prod.yml
```

确认关键文件齐全：

```bash
for f in docker-compose.prod.yml .env.production docker/nginx.local.conf \
         backend/entrypoint.sh backend/Dockerfile frontend/Dockerfile \
         pnpm-workspace.yaml pnpm-lock.yaml \
         backend/prisma/migrations/0_init/migration.sql; do
  test -f "$f" && echo "OK  $f" || echo "★ 缺失  $f"
done
```

> `docker/nginx.local.conf` 已在仓库里（`git clone` 自带），生产编排会把它挂载为 nginx 的  
> `/etc/nginx/conf.d/default.conf`。**不要删**，删了全站 404。详见第 6 章。

### 步骤 4 · 核对 env（本次已填好，只需确认）

```bash
grep -E '^(SEED_ON_BOOT|SEED_DEMO|FILE_STORAGE|OSS_BUCKET|OSS_ENDPOINT|CORS_ORIGIN|WEB_PORT|STACK_NAME)=' .env.production
```

期望：`SEED_ON_BOOT=true`（首次空库）、`SEED_DEMO=false`、`FILE_STORAGE=oss`、  
`OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com`、`CORS_ORIGIN=https://www.leixidianshang.com`、`WEB_PORT=8088`。  
其余 RDS/OSS/密钥项逐项含义见第 4 章；**密码含 `%` 必须写成 `%25`**。

同时确认阿里云侧已就绪：RDS 白名单放行 ECS IP、库 `leixin_v2` 已建（utf8mb4_unicode_ci）、  
OSS RAM 具备 `PutObject` + `GetObject`、域名 A 记录指向 ECS 且已备案。见第 5 章。

### 步骤 5 · 首次启动（构建 + 迁移 + 种子）

```bash
cd /opt/leixi
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f backend
```

首次构建要跑 `pnpm install` + `next build` + `prisma generate`，**约 5–15 分钟**，期间 `logs`  
可能暂时无输出属正常。等日志出现「数据库迁移完成」+「种子数据」后按 `Ctrl+C` 退出跟踪（容器不会停）。

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
curl -fsS http://127.0.0.1:8088/api/v1/health
```

`ps` 里 4 个服务都 healthy、`curl` 返回成功，再继续下一步。

### 步骤 6 · 关掉种子开关（**必做**）

```bash
cd /opt/leixi
sed -i 's/^SEED_ON_BOOT=true/SEED_ON_BOOT=false/' .env.production
grep '^SEED_ON_BOOT=' .env.production                    # 确认已是 false
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

否则以后每次发版/重启都会重跑种子。种子本身幂等，但没必要反复执行。

### 步骤 7 · 1Panel 建反代站点 + SSL

1. 「网站 → 创建网站 → **反向代理**」，域名填 `www.leixidianshang.com`。
2. 代理目标填 **宿主机内网 IP 或 docker0 网关 `172.17.0.1` 的 8088**，  
   **不要填 `127.0.0.1:8088`** —— OpenResty 自身是容器，会指向它自己导致 502。
3. 从 OpenResty 容器内部验证（宿主机 `curl` 通不算数）：  
   `docker exec -it <openresty容器名> wget -qO- http://172.17.0.1:8088/api/v1/health`
4. 「SSL → 申请 Let's Encrypt 证书」→ 开启**强制 HTTPS**。  
   `NODE_ENV=production` 时登录 cookie 带 `; Secure`，**用 HTTP 明文访问会登录失败**。

### 步骤 8 · 外层三个必做补丁（第 6 章有完整片段）

编辑 `/opt/1panel/www/sites/<域名>/proxy/root.conf` 的 `location ^~ /` 块：

- WebSocket 升级头：`proxy_http_version 1.1` + `Upgrade` / `Connection "upgrade"`（否则 `/ws/` 通知不工作）；
- `client_max_body_size 20m;`（与内层一致，否则大附件 413）；
- 单独加 `location = /metrics { deny all; }` 与 `/iclock/` 收口（否则指标/考勤机端点暴露公网）。

改完在 1Panel 重载 OpenResty。

### 步骤 9 · 验收（第 9 章有 10 项清单）

浏览器打开 `https://www.leixidianshang.com` → 用 `admin / 123456` 登录 → **立刻改密码**。  
再上传一张报销发票：OSS 的 `uploads/reimbursement/` 出现新文件且前端能预览，  
即证明 OSS 读写链路与本次修复的 `/api/v1/files/serve` 都正常。

### 日常发版

```bash
cd /opt/leixi
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f backend
```

> `up -d --build` 不会重建配置未变的 redis 容器，在线用户不会被踢下线；  
> 只有服务器/Docker 重启或 `--force-recreate` 才会清空 Redis 缓存（可重建，业务数据在 RDS）。

**架构一句话**：每套应用栈自带 nginx 做内层按路径反代（`/api/v1`→backend、`/`→frontend、`/ws`→backend），  
1Panel 的 OpenResty 只做外层"大门"，按域名把 80/443 的流量转到内层 nginx 的 8088，并负责证书、防火墙、备份。

```
浏览器 https://www.leixidianshang.com
        │ 443
        ▼
1Panel OpenResty（外层：SSL 终止 / 域名分流 / 防火墙）
        │ http://<宿主可达地址>:8088
        ▼
leixi-nginx（内层：按路径分发）
   ├─ /api/v1/  → leixi-backend:4001 ──→ 阿里云 RDS + OSS + 本栈 Redis
   ├─ /ws/      → leixi-backend:4001
   └─ /         → leixi-frontend:4000
```

---

## 1. 前置条件清单（逐项打勾再动手）

| #  | 项目       | 要求                                                       | 检查方式                                                                |
| -- | -------- | -------------------------------------------------------- | ------------------------------------------------------------------- |
| 1  | 服务器      | Linux（Ubuntu 22.04 / CentOS 等）、**≥4G 内存**、≥20G 磁盘        | **镜像内**会跑 `pnpm install` + `next build` + `prisma generate`，2G 小机易 OOM |
| 2  | Docker   | **Docker CE + Compose v2**（不要用 Python 版 v1）              | `docker compose version`、`docker buildx version`                    |
| 2a | Node.js  | **宿主机不需要安装，也不要跑 `npm install`**                       | 依赖由 Dockerfile 装进镜像；详见第 0 章开头与第 3 章                            |
| 3  | BuildKit | 必须可用，两个 Dockerfile 用了 `RUN --mount=type=cache`           | `DOCKER_BUILDKIT=1 docker build ...` 能跑                             |
| 4  | 1Panel   | 已安装并能登录，OpenResty 应用已启动                                  | 面板「应用商店」里 OpenResty 状态为运行中                                          |
| 5  | 域名       | `www.leixidianshang.com` A 记录指向 ECS **公网 IP**            | `ping www.leixidianshang.com`                                       |
| 6  | 备案       | 中国大陆 ECS 对 80/443 提供服务必须已备案                              | 未备案会被云厂商拦截，SSL 也申请不下来                                               |
| 7  | 阿里云 RDS  | 已建库 `leixin_v2`（**utf8mb4_unicode_ci**），账号有 **DDL 权限**   | 见第 5.1 节                                                            |
| 8  | 阿里云 OSS  | Bucket 已建、RAM 子账号有 `PutObject` + `GetObject`             | 见第 5.2 节                                                            |
| 9  | 安全组      | 云控制台放通 **80 / 443**；8088、6379 **绝不放公网**                  | 见第 7 章                                                              |
| 10 | 密钥       | 每客户独立 `JWT_SECRET` / `PREVIEW_SECRET` / `REDIS_PASSWORD` | 见第 4.2 节                                                            |

> ⚠️ **多客户红线**：给 B 公司部署时若复用 A 公司的 `JWT_SECRET`，A 公司签发的 token  
> 能在 B 公司通过验签，构成直接越权登录。每客户必须重新生成，绝不整份复制 env。

---

## 2. 服务器目录准备

```bash
sudo mkdir -p /opt/leixi
sudo chown -R $USER:$USER /opt/leixi
cd /opt/leixi
```

目录规划（每客户一个独立目录，目录名同时作为 compose 项目名，网络与命名卷自动隔离）：

```
/opt/leixi/                     # 客户 A（www.leixidianshang.com）
  ├─ backend/  frontend/  shared/  docker/  docs/ ...
  ├─ docker-compose.prod.yml     # 生产编排
  ├─ docker-compose.yml          # 开发编排（生产不要用）
  ├─ .env.production             # 真实密钥，chmod 600，绝不入库
  └─ .dockerignore               # 已排除 node_modules / .env / legacy / docs
/opt/leixi-b/                   # 客户 B（另一套，端口 8089）
/opt/projx/                     # 你的另一个项目（端口 8090）
```

---

## 3. 上传代码（两种方式）

### 方式 A：Git（**本次采用**）

```bash
cd /opt/leixi
git clone <你的仓库地址> .
# 或已有代码：git pull
```

> ⚠️ **`git clone` 之后仓库里没有 `docker-compose.prod.yml`，也没有 `.env.production`。**  
> 前者被 `.gitignore` 里新增的 `docker-compose.prod.yml` 规则排除，后者被 `.env*` 排除。  
> 两个文件都必须按第 0 章「步骤 3」人工上传，`.env.production` 还要 `chmod 600`。  
> 这是刻意设计：生产编排引用变量名、描述拓扑，与真实凭据配套使用，不进仓库。  
> 若日后改主意要把它纳入版本管理，删掉 `.gitignore` 中那一行即可（env 仍不入库）。

**服务器上不要执行 `npm install` / `pnpm install`**：依赖由 Dockerfile 在镜像内安装，  
宿主机装依赖只会生成 `package-lock.json`、破坏 pnpm workspace 布局，详见第 0 章开头的说明。  
`git clone` 也不会带任何 `node_modules`，这是正确状态。

### 方式 B：1Panel 文件管理上传（备选）

左侧「主机」→「文件」→ 进入 `/opt/leixi` → 上传项目压缩包 → 右键解压。  
同样要人工补 `docker-compose.prod.yml` 与 `.env.production`。

**必须遵守**：

- **不要上传 `node_modules/`**（约 2G，且是 Windows 版依赖，打进 Linux 镜像必崩）。  
  `.dockerignore` 已经把它排除在构建上下文之外，本地盘上没有也没关系。
- **不要上传 `frontend/.next/`**、`_modal_test.log` 等构建产物。
- **`.env.production` 不要通过公开渠道传输**，建议在服务器上直接用编辑器创建（第 4 章），  
  并设置权限：`chmod 600 /opt/leixi/.env.production`。
- 上传完确认这几个关键文件在：`pnpm-workspace.yaml`、`pnpm-lock.yaml`、  
  `backend/Dockerfile`、`frontend/Dockerfile`、`docker/nginx.local.conf`、  
  `backend/entrypoint.sh`、`backend/prisma/migrations/0_init/migration.sql`，  
  外加**两个人工上传的文件**：`docker-compose.prod.yml`、`.env.production`。

### 方式 C：离线 bundle（GitHub 不可达时的备选）

若到 `github.com` 的网络不通（典型报错 `CONNECT tunnel failed, response 502`、  
`TLS connect error: unexpected eof while reading`；常见于代理只放行 `api.github.com`），  
可以完全绕过 GitHub，先把代码打包成一个文件：

```bash
# 本地执行（在已合并到 main 的仓库里）
git bundle create leixisystem-main.bundle main
git bundle verify leixisystem-main.bundle      # 应显示 "records a complete history"
```

把这个 `.bundle` 文件上传到服务器后**直接克隆**（同样不需要 npm install）：

```bash
git clone /opt/leixisystem-main.bundle /opt/leixi
cd /opt/leixi
# 然后照第 0 章「步骤 3」继续：人工补两个文件、chmod 600、启动
```

> bundle 含完整提交历史，服务器上的仓库是正常 git 仓库。等 GitHub 网络恢复、  
> 远程 `main` 也推送成功后，再 `git remote set-url origin <仓库地址>` 即可正常 pull。  
> ⚠️ bundle 只搬运代码：`.env.production` 与 `docker-compose.prod.yml` **不在任何 git 历史里**，  
> 仍必须人工上传。

---

## 4. 配置 `.env.production`

### 4.1 生成强随机密钥

在服务器「主机 → 终端」执行，把输出填进 env：

```bash
node -e "const c=require('crypto'); console.log('JWT_SECRET='+c.randomBytes(32).toString('hex')); console.log('PREVIEW_SECRET='+c.randomBytes(24).toString('hex')); console.log('REDIS_PASSWORD='+c.randomBytes(16).toString('hex'));"
```

> 若服务器还没装 Node，用 `openssl rand -hex 32` / `openssl rand -hex 24` / `openssl rand -hex 16` 代替。

### 4.2 变量模板（占位符，真实值按你自己的资源填）

```ini
NODE_ENV=production
PORT=4001

# 多客户同机时的唯一标识与端口（必须每套不同）
STACK_NAME=leixi
WEB_PORT=8088

# 首次部署空库改 true，启动成功后立刻改回 false
SEED_ON_BOOT=false
SEED_DEMO=false

JWT_SECRET=<32字节随机hex>
JWT_EXPIRES_IN=8h
PREVIEW_SECRET=<24字节随机hex>
CORS_ORIGIN=https://www.leixidianshang.com

# 阿里云 RDS：密码含 % 时必须写成 %25（例：Abc%100 → Abc%25100）
# <RDS连接地址> 用控制台「数据库连接」页给出的地址；同 VPC 优先用内网地址
DATABASE_URL=mysql://<RDS账号>:<URL编码后的密码>@<RDS连接地址>:3306/leixin_v2
MYSQL_DATABASE=leixin_v2

# 本栈自带 Redis 容器，编排已显式注入 REDIS_URL=redis://:<REDIS_PASSWORD>@redis:6379
# 只需给 REDIS_PASSWORD；--env-file 不注入容器，在这里设 REDIS_URL 无效
REDIS_PASSWORD=<16字节随机hex>
REDIS_KEY_PREFIX=leixi-prod:

FILE_STORAGE=oss
OSS_REGION=oss-cn-beijing
OSS_BUCKET=<你的bucket名>
OSS_ACCESS_KEY=<RAM子账号AK>
OSS_ACCESS_SECRET=<RAM子账号SK>
# 默认用外网 endpoint：不依赖 ECS 地域，已实测 put/get/delete 全通，上传即可用。
# 内网 oss-cn-beijing-internal.aliyuncs.com 仅 ECS 同北京 VPC 可用，可省公网流量费；
# 切换前必须先在 ECS 上验证 nc -zv oss-cn-beijing-internal.aliyuncs.com 443
OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com

API_PROXY_TARGET=http://backend:4001
```

### 4.3 三个最容易填错的地方

1. **密码里的 `%`**：`DATABASE_URL` 是 URL，`%` 必须转义成 `%25`，否则 `%10` 被按转义解析、  
   Prisma 拿到错误密码（表现为 `Access denied`）。`@`、`:`、`/` 等特殊字符同理要 URL 编码。
2. **`CORS_ORIGIN` 必须完整**：`https://www.leixidianshang.com`（含协议、不带端口、不带结尾斜杠）。  
   `NODE_ENV=production` 时登录 cookie 带 `; Secure`，**用 HTTP 明文访问会登录失败**。
3. **Redis 只填 `REDIS_PASSWORD`**：编排用它同时设置 redis 容器的 `--requirepass` 和 backend 的  
   `REDIS_URL=redis://:<REDIS_PASSWORD>@redis:6379`，两端同源必然一致。注意 `--env-file` 只提供  
   `${VAR}` 插值、**不会把 env 的键注入容器**，所以在这里单独设 `REDIS_URL` 是无效的（实测会被  
   编排里显式的 `environment.REDIS_URL` 覆盖）。日后接阿里云 Redis 要改三处：env 里设 `REDIS_URL`、  
   删掉编排中 backend 的 `REDIS_URL` 覆盖行、删掉 `redis` 服务与 `depends_on.redis`；应用代码零改动。

---

## 5. 阿里云侧配置

### 5.1 RDS MySQL

1. 控制台 → RDS 实例 → **数据库管理**：创建 `leixin_v2`，**必须显式指定**  
   `CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`。  
   ⚠️ 该 RDS 实例的**服务端默认是 utf8mb3**，若只填 `utf8mb4` 而不指定排序规则、  
   或让库继承默认值，库级对象会与迁移基线（逐表声明 `utf8mb4_unicode_ci`）不一致。  
   等价 SQL：`CREATE DATABASE IF NOT EXISTS leixin_v2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
2. **账号管理**：确认账号拥有该库的 `CREATE / ALTER / INDEX / REFERENCES / SELECT / INSERT / UPDATE / DELETE`。  
   `entrypoint.sh` 会执行 `prisma migrate deploy` 建 87 张表，权限不足会直接启动失败。
3. **白名单**：把 ECS 的**内网 IP** 加入白名单（默认拒绝所有，这是最常见的连不上原因）。  
   若 ECS 与 RDS 不在同一 VPC，需要走外网地址并把 ECS 公网 IP 加白名单。  
   ⚠️ 一个 RDS 实例上可能同时有多个项目的库，建库/授权时**别选错库**。
4. **自动备份**：开启并设置保留天数 ≥7 天。回滚依赖它，因为迁移没有 down 脚本（ADR-0017）。

### 5.2 OSS

1. Bucket 权限设为**私有**，不要公共读（文件读取统一走后端 `/api/v1/files/serve`，由后端 SDK 带凭据读）。
2. RAM 子账号最小权限：仅授权该 bucket 的 `oss:PutObject`、`oss:GetObject`。  
   注意当前代码上传和**读取**都走 SDK，只给写权限会导致附件/Logo 预览 403。
3. 开启**版本控制**（防误删）+ 生命周期规则（可选）。
4. `OSS_BUCKET` 填控制台「概览」页的 Bucket 名称，不是 Bucket 域名。
5. 确认 `OSS_ENDPOINT` 网络可达：在服务器执行  
   `nc -zv <endpoint> 443`（或 `curl -I https://<bucket>.<endpoint>`，私有 bucket 返回 403 也算通）。  
   默认外网 endpoint 已在部署前实测 put/get/delete 全链路通过；**若改用内网域名必须先在 ECS 上验通**，  
   内网域名在非北京 VPC 下会解析到 `100.x` 段并直接超时。

> OSS 目录说明：系统写入路径固定为 `uploads/<bizType>/<文件名>`，业务目录只有  
> `common / contract / reimbursement / system / knowledge`。Bucket 里若存在  
> `avatar/`、`id_cards/`、`leixi-system/` 等旧目录，**不是当前系统生成的**，  
> 删除前先确认 RDS 里是否有数据引用，建议先开版本控制再逐个清理。

---

## 6. 启动应用栈

### 6.1 推荐方式：命令行启动 + 1Panel 管外层

理由：`build.context: .` 需要源码就在编排目录、且 `${...}` 变量要正确注入；  
命令行方式最可控，1Panel 依然能直接在「容器」里看到并管理这些容器。

```bash
cd /opt/leixi

# 校验配置能被正确解析（不打印全部内容，避免泄露密钥）
docker compose -f docker-compose.prod.yml --env-file .env.production config -q && echo OK

# 首次启动：先确认 .env.production 里 SEED_ON_BOOT=true
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# 观察启动链：迁移 → 种子 → 服务
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f backend
```

启动链（`backend/entrypoint.sh`，任一步失败容器不启动）：

1. `prisma migrate deploy` —— 空库由 `0_init` 基线一次性建表；既有库走 P3005 基线标记分支。
2. `SEED_ON_BOOT=true` 时执行种子（配合 `SEED_DEMO=false` 只灌权限点/角色/admin/默认部门/13 条默认审批流程）。
3. `node --require ts-node/register src/main.ts` 启动服务（不能用 tsx，装饰器元数据会丢）。

看到「数据库迁移完成」+ 种子执行完成后：

```bash
# 把 SEED_ON_BOOT 改回 false（下次重启生效，无需立即重启）
sed -i 's/^SEED_ON_BOOT=true/SEED_ON_BOOT=false/' .env.production

# 本机验收
curl -I http://127.0.0.1:8088/api/v1/health
curl -s  http://127.0.0.1:8088/api/v1/health
```

`depends_on` 会等 redis / backend / frontend 依次 healthy，nginx 最后起，首次构建约几分钟。

### 6.2 想完全在 1Panel 里点按钮（可选）

左侧「容器」→「编排」→「创建编排」：

- 名称填 `leixi`（多客户时填对应 `STACK_NAME`）；
- 把 `docker-compose.prod.yml` 的**内容**粘贴进编辑框；
- 在「环境变量」里逐项填入 `.env.production` 的键值（或把 `.env.production` 复制成该编排  
  目录下的 `.env`，compose 会自动加载）；
- 编排目录通常在 `/opt/1panel/docker/compose/<名称>/`，**源码必须在这个目录里**，  
  否则 `build.context: .` 找不到 Dockerfile；
- 点「启动 / 重建」。

> 面板编排会重写 `docker-compose.yml`，改配置后注意在面板里同步编辑，别只改磁盘文件。

### 6.3 构建失败排查

| 现象                                        | 原因                                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `failed to solve: ... --mount=type=cache` | Docker Compose v1 或 BuildKit 未开，装 docker-ce + compose-plugin v2                    |
| 构建中途 OOM / 极慢                             | 内存 <4G；改走「本地/CI 预构建镜像 → compose 用 `image:`」                                        |
| `pnpm` 报 `ERR_PNPM_IGNORED_BUILDS`        | 构建白名单需在 `pnpm-workspace.yaml` 的 `allowBuilds`（pnpm 11 已废弃 `onlyBuiltDependencies`） |
| nginx 502 / 健康检查一直不通过                     | `PORT` 没传 4001（main.ts 兜底 3001），或 backend 迁移失败                                     |

---

## 7. 1Panel「网站」：反向代理 + HTTPS

### 7.1 创建反代站点

左侧「网站」→「创建网站」：

- **类型**：反向代理
- **主域名**：`www.leixidianshang.com`（如需裸域，额外加 `leixidianshang.com`）
- **代理地址**：见下方"⚠️ 关键" —— **不要无脑填 `127.0.0.1:8088`**
- **端口**：80，暂不勾 HTTPS

> ⚠️ **关键坑（90% 的人栽在这）**：1Panel 的 OpenResty 自己也是一个 Docker 容器，  
> 在它内部 `127.0.0.1` 指向的是 **OpenResty 容器自己**，不是宿主机，直接填会 502。  
> 按下面顺序试，用「网站 → 配置文件」保存后访问验证：
>
> 1. 宿主机**内网 IP**：`http://<ECS内网IP>:8088`（最稳，可用 `hostname -I` 查）；
> 2. Docker 默认网关：`http://172.17.0.1:8088`（`ip addr show docker0` 查看）；
> 3. 若 1Panel 用的是独立网络，用该网络网关地址。
>
> 验证方法（在 1Panel「主机 → 终端」）：
>
> ```bash
> ```

|   |   |
| - | - |

> docker ps | grep -i openresty          # 找到 OpenResty 容器名  
> docker exec -it <openresty容器名> sh -c "wget -qO- http://<候选地址>:8088/api/v1/health"
>
> ```
> 哪个能返回健康响应就用哪个。宿主机上 `curl 127.0.0.1:8088` 能通**不能**证明容器里也能通。
> ```

### 7.2 修改反代配置（**必做**，三个坑一次解决）

站点 →「配置文件」，1Panel 的反向代理配置一般在  
`/opt/1panel/www/sites/<域名>/proxy/root.conf`（也可在「文件」管理里逐层进入该目录编辑）。  
找到 `location ^~ / { ... }` 块，确保内容包含以下指令：

```nginx
location ^~ / {
    proxy_pass http://<上一步验证可用的地址>:8088;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header REMOTE-HOST $remote_addr;

    # ① Socket.IO /ws/ 的 WebSocket 升级（不加会页面能开但实时通知不工作）
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_buffering off;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;

    # ② 外层上传限制：内层 nginx 是 20m，后端 multipart 上限 200MB，
    #    外层默认值过小会导致上传附件 413
    client_max_body_size 20m;
}

# ③ 指标端点禁止公网访问。
#    内层 nginx 的 /metrics 白名单按 $remote_addr 放行私网段，套了外层反代后
#    $remote_addr 变成 OpenResty 容器 IP（正好命中 172.16.0.0/12 白名单），
#    指标会被公网读到。必须在外层单独收口。
location = /metrics {
    deny all;
}

# ④ 考勤机 Push 端点：无考勤机就直接拒绝；有则只放行考勤机网段
location ^~ /iclock/ {
    # allow <考勤机网段，如 192.168.1.0/24>;
    deny all;
}
```

确认是 `location ^~ /`（前缀匹配后不再走静态资源正则），否则带后缀的 API 路径可能被  
静态规则截走。改完重载 OpenResty（面板站点里点保存 / 「重载」）。


> 如果业务要上传 >20m 的附件，需**同时**改 `docker/nginx.local.conf` 的  
> `client_max_body_size` 和上面外层的这个值。

### 7.3 申请 SSL 并强制 HTTPS

站点 →「HTTPS」*→「Let's Encrypt」→ 选 HTTP 验证 → 申请证书* → 开启**强制 HTTPS**。

前置条件：域名 A 记录已生效、80 端口在防火墙和云安全组都已放行、备案通过。  
证书由 1Panel 自动续期。

> `NODE_ENV=production` 时登录 cookie 带 `; Secure`，**必须走 HTTPS**，  
> 用 `http://域名` 或 `IP:8088` 访问会出现"登录没反应/反复回登录页"。

### 7.4 防火墙与安全组

- 1Panel「主机」→「防火墙」：放行 **80、443**。
- 云厂商控制台「安全组」：同样放行 80、443。
- **不要**放行 8088（内层 nginx）、6379（Redis）、3306；  
  Redis 未授权访问是经典入侵入口，6379 绝不能暴露公网。
- 可选加固：把编排的端口映射改成 `127.0.0.1:${WEB_PORT:-8088}:80`。  
  ⚠️ 但这样 OpenResty 容器就访问不到了，需先确认 7.1 选的是宿主机可达地址；  
  两者要一起调整，改完务必重新验证。
- 若启用了 `ufw`，注意它会默认拒绝其他入站端口，别把已有服务一起挡掉。

---

## 8. 验收清单（逐项实测）

| #  | 检查                                            | 期望                                                      |
| -- | --------------------------------------------- | ------------------------------------------------------- |
| 1  | `curl -s http://127.0.0.1:8088/api/v1/health` | 健康响应                                                    |
| 2  | 浏览器打开 `https://www.leixidianshang.com`        | 登录页，证书有效，地址栏是锁                                          |
| 3  | 用 `admin / 123456` 登录                         | 登录成功进首页（**立刻改掉默认密码**）                                   |
| 4  | 浏览器 F12 → Application → Cookies               | `access_token` 带 `HttpOnly` + `Secure` + `SameSite=Lax` |
| 5  | 实时通知 / WebSocket                              | 控制台 `wss://www.leixidianshang.com/ws/` 连接成功（验证 7.2 ①）   |
| 6  | 上传一张报销发票附件                                    | OSS 的 `uploads/reimbursement/` 出现新文件，前端能预览/下载           |
| 7  | 系统设置上传 Logo                                   | 登录页正常显示（后端走 OSS SDK 读取）                                 |
| 8  | 上传一个 15MB 文件                                  | 不报 413（验证 7.2 ②）                                        |
| 9  | 外网访问 `https://域名/metrics`                     | **403**（验证 7.2 ③）                                       |
| 10 | `docker compose ... ps`                       | 4 个容器 healthy                                           |

---

## 9. 备份与日常运维

### 9.1 备份（不可重建的数据才是重点）

| 对象       | 方式                                                                                |
| -------- | --------------------------------------------------------------------------------- |
| RDS 业务数据 | 阿里云 RDS 自动备份（≥7 天），重大变更前手动 `mysqldump` 一份                                         |
| OSS 附件   | Bucket 版本控制；重要客户可开跨区域复制                                                           |
| 部署配置     | 1Panel「计划任务」定期打包 `/opt/leixi/docker-compose.prod.yml`、`.env.production`、站点配置到异地存储 |
| 服务器      | ECS 云盘快照                                                                          |

> Redis 里只有可重建的 session/缓存/限流计数，代码有进程内兜底，不必单独备份。  
> 迁移没有 down 脚本，**回滚依赖事前 mysqldump**（ADR-0017）。

### 9.2 发版

```bash
cd /opt/leixi
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f backend
```

`up -d --build` 会自动执行 `migrate deploy`。redis 服务配置未变时 compose 不会重建它，  
不会把在线用户的登录态清掉。

### 9.3 改了 env 之后

改 `.env.production` 不会自动作用于已运行的容器，需要重建受影响服务：

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --force-recreate backend
```

### 9.4 看日志 / 状态

- 命令行：`docker compose -f docker-compose.prod.yml --env-file .env.production logs -f backend`
- 1Panel：「容器」→ 选中容器 →「日志」；「主机」→「监控」看资源曲线。

---

## 10. 复制部署下一家公司（多客户）

每客户一套**完整独立栈**：独立 redis 容器、独立 RDS 库、独立 OSS bucket、独立密钥、独立端口。  
不共享 Redis、不共享 `JWT_SECRET`（物理隔离，不靠配置约定）。

```bash
cp -a /opt/leixi /opt/leixi-b       # 或用 git clone 新目录
cd /opt/leixi-b
# 编辑 .env.production，逐项重填（见下）
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

**每客户必改 8 项**：

| 变量                                                    | 客户 A                             | 客户 B             |
| ----------------------------------------------------- | -------------------------------- | ---------------- |
| `STACK_NAME`                                          | `leixi`                          | `leixi-b`        |
| `WEB_PORT`                                            | `8088`                           | `8089`           |
| `DATABASE_URL`                                        | A 的 RDS 库                        | B 的 RDS 库        |
| `JWT_SECRET`                                          | 独立随机                             | **必须重新生成**       |
| `PREVIEW_SECRET`                                      | 独立随机                             | **必须重新生成**       |
| `REDIS_PASSWORD`                                      | 独立随机                             | 重新生成             |
| `REDIS_KEY_PREFIX`                                    | `leixi-prod:`                    | `leixi-b-prod:`  |
| `CORS_ORIGIN`                                         | `https://www.leixidianshang.com` | B 的域名            |
| `OSS_BUCKET` / `OSS_ACCESS_KEY` / `OSS_ACCESS_SECRET` | A 的 bucket + RAM                 | B 的 bucket + RAM |

然后：1Panel「网站」再建一个反向代理站点，指向 `http://<宿主可达地址>:8089`，  
按第 7.2 节同样补 WebSocket / 上传大小 / `/metrics` 收口，再申请该域名的 SSL。

容器名已用 `${STACK_NAME}` 参数化（`leixi-b-backend` 等），命名卷和网络随 compose  
项目名自动隔离，不会互相覆盖。

| 实例    | STACK_NAME | WEB_PORT | 1Panel 反代目标   |
| ----- | ---------- | -------- | ------------- |
| 雷犀 A  | `leixi`    | 8088     | `<宿主地址>:8088` |
| 雷犀 B  | `leixi-b`  | 8089     | `<宿主地址>:8089` |
| 另一个项目 | `projx`    | 8090     | `<宿主地址>:8090` |

> 客户数超过 ~10 家时，应转向真正的 SaaS 化（单实例 + `tenant_id` 行级隔离），  
> 那时才考虑把缓存层集中到阿里云托管 Redis。属产品架构改造，不在本手册范围。

---

## 11. 故障排查速查表

| 现象                                 | 最可能原因                                           | 处理                                                                                               |
| ---------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 站点 502                             | 代理地址填了 `127.0.0.1` 但 OpenResty 在容器里             | 按 7.1 换宿主机内网 IP / docker0 网关                                                                     |
| 登录没反应、反复回登录页                       | 用了 HTTP；`NODE_ENV=production` cookie 带 `Secure` | 强制 HTTPS，检查 `CORS_ORIGIN` 协议                                                                     |
| `Access denied for user`           | RDS 密码里的 `%` 没写成 `%25`，或白名单没放 ECS IP            | 修 `DATABASE_URL` + RDS 白名单                                                                       |
| `migrate deploy` 建表失败              | RDS 账号缺 DDL 权限 / 库不存在                           | 授权 + 建 `leixin_v2`                                                                               |
| 启动日志出现 P3005 后退出                   | 非空库但无迁移历史                                       | `entrypoint.sh` 会自动 `migrate resolve --applied 0_init` 后重试；`_prisma_migrations` 已存在时不要手工 resolve |
| 附件上传成功但预览 404/403                  | RAM 子账号缺 `GetObject`；或 `OSS_ENDPOINT` 内网不通      | 补权限 / 改外网 endpoint                                                                               |
| 页面能开、实时通知不工作                       | 外层缺 WebSocket 升级头                               | 7.2 ①                                                                                            |
| 上传大文件 413                          | 外层/内层 `client_max_body_size` 过小                 | 7.2 ② 两处一起改                                                                                      |
| `/metrics` 公网能访问                   | 外层没单独 deny                                      | 7.2 ③                                                                                            |
| 前台 502、backend 起不来                 | `PORT` 不是 4001                                  | 编排已显式传 4001，检查是否被 env 覆盖                                                                         |
| 登录 IP 限流"一个人试错全公司被锁"               | 反代后后端 `req.ip` 是代理容器 IP                         | 见 11.1 已知限制                                                                                      |
| OSS 里出现 `test-connection.txt` 等旧目录 | 历史遗留，非当前系统生成                                    | 先开版本控制，核对 RDS 引用后再清                                                                              |

### 11.1 已知限制（上线后建议修复）

|   |   |   |
| - | - | - |

- **IP 维度限流 / 操作日志 IP**：`auth.controller.ts` 取 `req.ip || x-forwarded-for`，  
  而 `main.ts` 用 `new FastifyAdapter()` **未开启 `trustProxy`**。套了两层反代后  
  `req.ip` 是内层 nginx 容器 IP，所有用户被算成同一 IP，20 次/15 分钟的 IP 阈值由全体共享。  
  **用户名维度限流（5 次/15 分钟）不受影响，仍有效**，登录功能不受影响。  
  建议后续改动：`FastifyAdapter({ trustProxy: 2 })`（跳过两跳代理取真实客户端 IP），  
  并补一条单测断言从 `X-Forwarded-For` 解析出的 IP 正确。改前请确认外层反代的  
  `X-Forwarded-For` 是 `$proxy_add_x_forwarded_for`（追加而非覆盖），避免伪造绕过。
- **`/iclock/` 考勤机端点**：内层 nginx 注释里预留了 IP 白名单但未启用，本文档 7.2 ④  
  在外层收口；若考勤机走公网访问，需按实际网段精确放行。

---

## 12. 回滚与应急

1. **变更前备份**：`mysqldump` 一份 RDS 库 + OSS 开版本控制 + ECS 快照。
2. **应用回滚**：`git checkout <上一个提交>` 后重新 `up -d --build`；  
   注意迁移是单向的，**代码回退不等于数据库结构回退**，必要时用备份恢复库。
3. **站点回滚**：1Panel「网站」停用该反代站点，或把代理地址临时指回旧栈端口。
4. **紧急只读**：先把 `/api/v1/files/upload`、`/iclock/` 在外层 deny，保留查询能力再排查。

---

## 附录 A：环境变量全表

| 变量                                                                                    | 必填 | 说明                                        |
| ------------------------------------------------------------------------------------- | -- | ----------------------------------------- |
| `NODE_ENV`                                                                            | 是  | `production`（决定 cookie Secure、关闭 Swagger） |
| `PORT`                                                                                | 是  | `4001`，编排已显式传入                            |
| `STACK_NAME`                                                                          | 是  | 容器名前缀，同机多套必须唯一                            |
| `WEB_PORT`                                                                            | 是  | nginx 宿主端口，同机多套必须唯一                       |
| `SEED_ON_BOOT`                                                                        | 是  | 首次 `true`，之后恒 `false`                     |
| `SEED_DEMO`                                                                           | 是  | 生产恒 `false`                               |
| `JWT_SECRET`                                                                          | 是  | ≥32 位，每客户唯一（Zod 强制 ≥32 位）                 |
| `JWT_EXPIRES_IN`                                                                      | 否  | 默认 `8h`                                   |
| `PREVIEW_SECRET`                                                                      | 是  | ≥16 位，每客户唯一                               |
| `CORS_ORIGIN`                                                                         | 是  | 完整 https 域名，逗号分隔多个                        |
| `DATABASE_URL`                                                                        | 是  | `mysql://`，特殊字符需 URL 编码                   |
| `REDIS_PASSWORD`                                                                      | 是  | 本栈 Redis 容器密码                             |
| `REDIS_KEY_PREFIX`                                                                    | 否  | 默认 `leixi:`，共享 Redis 时必须每客户唯一             |
| `FILE_STORAGE`                                                                        | 是  | 生产 `oss`                                  |
| `OSS_REGION` / `OSS_BUCKET` / `OSS_ACCESS_KEY` / `OSS_ACCESS_SECRET` / `OSS_ENDPOINT` | 是  | OSS 五项                                    |
| `API_PROXY_TARGET`                                                                    | 否  | 编排内固定 `http://backend:4001`               |

## 附录 B：端口与路径对照

| 端口                 | 位置               | 是否对公网         |
| ------------------ | ---------------- | ------------- |
| 80 / 443           | 1Panel OpenResty | **是**（唯一对外入口） |
| 8088（或 `WEB_PORT`） | 内层 leixi-nginx   | 否，仅宿主/容器网络可达  |
| 4001               | backend          | 否             |
| 4000               | frontend         | 否             |
| 6379               | redis            | 否，**绝不**暴露公网  |
| 3306               | 阿里云 RDS          | 仅 ECS 内网白名单   |

| 路径         | 内层 nginx 转发                                  |
| ---------- | -------------------------------------------- |
| `/api/v1/` | `backend:4001`（带限流 `burst=20`）               |
| `/ws/`     | `backend:4001`（WebSocket 升级）                 |
| `/iclock/` | `backend:4001`（考勤机 Push，外层需收口）               |
| `/metrics` | `backend:4001/api/v1/metrics`（外层必须 deny all） |
| `/`        | `frontend:4000`                              |

---

## 附录 C：相关决策与配置来源

- `docker-compose.prod.yml` —— 生产编排（不启本地 mysql、直连 RDS、FILE_STORAGE=oss）
- `docker/nginx.local.conf` —— 内层按路径反代 + 安全头 + 限流
- `backend/entrypoint.sh` —— 启动链（migrate deploy → 可选种子 → 服务）
- `.env.production.example` —— 变量模板（真实值只在服务器 `.env.production`）
- `docs/adr/0017-migration-baseline-and-boot-chain.md` —— 迁移基线与回滚约定
- `docs/adr/0020-workflow-business-binding.md` —— 审批流程业务绑定
