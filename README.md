# hono-bun

基于 `Bun + Hono + Drizzle ORM + PostgreSQL` 的后端服务。

当前已实现：
- 用户注册接口
- 用户查询接口
- PostgreSQL 表结构管理
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
AUTO_MIGRATE='true'
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

生成 Drizzle SQL：

```bash
bun db:generate
```

直接将 schema 推送到数据库：

```bash
bun db:push
```

执行迁移脚本：

```bash
bun db:migrate
```

说明：
- `db:push` 已固定为 `bun --bun drizzle-kit push`
- 这样可以避免 `node` 与 `bun` 架构不一致导致的 `esbuild` 报错
- 程序启动时默认会自动执行数据库迁移
- 如果你不希望启动时自动迁移，可以设置：

```env
AUTO_MIGRATE='false'
```

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
src/
  core/           响应格式和业务异常
  db/             数据库连接、schema、迁移
  middleware/     中间件
  routes/         路由定义
  services/       业务逻辑
  utils/          日志工具
bootstrap         FC 自定义运行时启动脚本
s.yaml            Serverless Devs 部署配置
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

产物：

```text
dist/index.js
```

### 2. 打包 Bun Layer

给打包脚本增加执行权限：

```bash
chmod +x ./scripts/build-bun-layer.sh
```

执行打包：

```bash
./scripts/build-bun-layer.sh 1.3.2 bun-layer.zip
```

产物：

```text
./bun-layer.zip
```

说明：
- 脚本会优先复用本机 Bun 缓存
- 缓存不存在时才会从 Bun 官方发布地址下载 Linux x64 版本
- 如果你在项目根目录执行命令，最终文件会生成到项目根目录：

```text
./bun-layer.zip
```

### 3. 创建 FC Layer

在阿里云函数计算控制台创建 Layer：

- 地域：`cn-shanghai`
- 上传文件：`bun-layer.zip`
- 兼容运行时：`custom.debian11`

注意：
- Layer 的兼容运行时必须与函数运行时一致
- 如果 Layer 不是按 `custom.debian11` 创建，部署时会报：

```text
runtime: custom.debian11 is not supported by layer
```

### 4. 配置部署环境变量

```bash
export BUN_LAYER_ARN='你的 Layer ARN'
export DATABASE_URL='postgres://用户名:密码@数据库地址:5432/库名'
export AUTO_MIGRATE='true'
```

说明：
- `s deploy` 不会自动读取项目中的 `.env`
- 部署时需要通过 `export` 把变量注入当前 shell
- 如果你不希望函数启动时自动执行迁移，可以改成：

```bash
export AUTO_MIGRATE='false'
```

### 5. 配置阿里云凭证

```bash
s config add
```

### 6. 部署

```bash
s deploy -y
```

### 7. 查看日志

当前 `s.yaml` 已配置 FC 日志自动投递到你的 SLS：

- Project：`myjs`
- Logstore：`hono`

说明：
- 项目中的 [logger.ts](/Users/fine/Desktop/project/hono-bun/src/utils/logger.ts) 使用的是 `console.log / console.error`
- FC 会采集这些标准输出日志并投递到 SLS
- `myjs` 和 `hono` 需要提前在 `cn-shanghai` 创建好，并与函数地域一致

## 部署相关文件

- [s.yaml](/Users/fine/Desktop/project/hono-bun/s.yaml)
- [bootstrap](/Users/fine/Desktop/project/hono-bun/bootstrap)
- [scripts/build-bun-layer.sh](/Users/fine/Desktop/project/hono-bun/scripts/build-bun-layer.sh)
- [.fcignore](/Users/fine/Desktop/project/hono-bun/.fcignore)

`bootstrap` 的作用：
- 从 Layer 中找到 `bun`
- 读取 FC 注入的 `PORT`
- 启动 `dist/index.js`

## 常见问题

### 1. `esbuild` 平台不匹配

表现：

```text
You installed esbuild for another platform than the one you're currently using
```

原因：
- `drizzle-kit` 被 `node` 执行
- 依赖却是用 `bun` 按另一种架构安装的

处理：
- 使用 `bun --bun drizzle-kit ...`

### 2. 注册接口卡在用户查重

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
