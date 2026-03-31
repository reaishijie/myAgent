# hono-bun

基于 `Bun + Hono + Prisma + PostgreSQL` 的后端服务，部署目标为阿里云函数计算 FC 自定义运行时。

当前已实现：
- 用户注册接口
- 用户查询接口
- Prisma Schema 管理
- 阿里云函数计算 FC 自定义运行时部署配置

## 环境要求

- Bun `>= 1.3`
- PostgreSQL `>= 14`
- Serverless Devs `s >= 3`

## 本地开发

安装依赖：

```bash
bun install
```

创建环境变量文件：

```bash
cp .env.example .env
```

示例配置：

```env
PORT='9889'
DATABASE_URL='postgres://postgres:root123456@127.0.0.1:5432/hono'
```

生成 Prisma Client：

```bash
bun run db:generate
```

将 schema 推送到数据库：

```bash
bun run db:push
```

启动开发服务：

```bash
bun run dev
```

默认访问地址：

```text
http://localhost:9889
```

健康检查：

```bash
curl http://localhost:9889/
```

## 数据库操作

生成 Prisma Client：

```bash
bun run db:generate
```

开发环境创建迁移：

```bash
bun run db:migrate:dev
```

直接同步 schema 到数据库：

```bash
bun run db:push
```

生产环境执行迁移：

```bash
bun run db:migrate:deploy
```

说明：
- Prisma 7 的数据库连接地址通过 [prisma.config.ts](/Users/fine/Desktop/project/hono_prisma/prisma.config.ts) 管理
- 应用启动时只做数据库连通性检查，不再在运行时自动执行迁移
- 对于阿里云 FC，推荐在部署前手动执行 `db:push` 或 `db:migrate:deploy`

## 主要接口

根路径：

```http
GET /
```

返回示例：

```json
{
  "code": 200,
  "status": "ok",
  "message": "后端服务正常运行！"
}
```

注册用户：

```http
POST /api/users/register
Content-Type: application/json
```

请求示例：

```json
{
  "username": "xiaohui",
  "password": "123456",
  "email": "xiaohui@example.com",
  "nickname": "小灰"
}
```

查询用户：

```http
GET /api/users/:username
```

## 项目结构

```text
prisma/          Prisma schema 与 migrations
src/
  core/          响应格式和业务异常
  db/            Prisma Client 和数据库启动检查
  middleware/    中间件
  routes/        路由定义
  services/      业务逻辑
  utils/         日志工具
bootstrap        FC 自定义运行时启动脚本
s.yaml           Serverless Devs 部署配置
```

## 部署到阿里云函数计算 FC

当前项目使用：
- `custom.debian11`
- `HTTP Trigger`
- `Bun Layer + dist/index.js`
- FC 日志自动投递到 SLS `Project: myjs`、`Logstore: hono`

### 1. 构建业务代码

```bash
bun run build:fc
```

### 2. 打包 Bun Layer

```bash
chmod +x ./scripts/build-bun-layer.sh
./scripts/build-bun-layer.sh 1.3.2 bun-layer.zip
```

### 3. 创建 FC Layer

在阿里云函数计算控制台创建 Layer：

- 地域：`cn-shanghai`
- 上传文件：`bun-layer.zip`
- 兼容运行时：`custom.debian11`

### 4. 在部署前执行数据库变更

如果你只是同步当前 schema：

```bash
export DATABASE_URL='postgres://用户名:密码@数据库地址:5432/库名'
bun run db:push
```

如果你走 Prisma migration：

```bash
export DATABASE_URL='postgres://用户名:密码@数据库地址:5432/库名'
bun run db:migrate:deploy
```

### 5. 配置部署环境变量

```bash
export BUN_LAYER_ARN='你的 Layer ARN'
export DATABASE_URL='postgres://用户名:密码@数据库地址:5432/库名'
```

说明：
- `s deploy` 不会自动读取项目中的 `.env`
- 部署时需要通过 `export` 把变量注入当前 shell

### 6. 配置阿里云凭证

```bash
s config add
```

### 7. 部署

```bash
s deploy -y
```

### 8. 查看日志

当前 `s.yaml` 已配置 FC 日志自动投递到你的 SLS：

- Project：`myjs`
- Logstore：`hono`

项目中的 [logger.ts](/Users/fine/Desktop/project/hono_prisma/src/utils/logger.ts) 使用 `console.log / console.error` 输出日志，FC 会自动采集并投递到 SLS。

## 部署相关文件

- [s.yaml](/Users/fine/Desktop/project/hono_prisma/s.yaml)
- [bootstrap](/Users/fine/Desktop/project/hono_prisma/bootstrap)
- [scripts/build-bun-layer.sh](/Users/fine/Desktop/project/hono_prisma/scripts/build-bun-layer.sh)
- [.fcignore](/Users/fine/Desktop/project/hono_prisma/.fcignore)

## 常见问题

### 1. 注册接口卡在用户查重

表现：
- 日志停在“开始检查用户是否已存在”

原因通常是：
- PostgreSQL 不可达
- `DATABASE_URL` 写错
- 本地 `localhost` 解析或 Docker 端口问题

建议：
- 优先使用 `127.0.0.1`
- 确保数据库允许当前运行环境访问

### 3. `s deploy` 报环境变量不存在

确保 `s.yaml` 中使用的是：

```yaml
${env(BUN_LAYER_ARN)}
${env(DATABASE_URL)}
```

不要写成：

```yaml
${env.BUN_LAYER_ARN}
${env.DATABASE_URL}
```

### 4. Layer 与函数运行时不兼容

如果报：

```text
runtime: custom.debian11 is not supported by layer
```

说明：
- Layer 创建时选错了兼容运行时

处理：
- 重新创建 Layer
- 兼容运行时选择 `custom.debian11`
