# myAgent 开发文档

仓库地址：https://github.com/reaishijie/myAgent

## 1. 项目目标

myAgent 的目标是建设一个多渠道、多模型、多能力的 AI 后端服务。系统通过统一的配置、调用、记录和扩展机制，支持聊天、TTS 语音播放、图片生成、视频生成等能力。

第一阶段不直接追求完整 AI 产品形态，而是先完成后端基础底座：

- 管理模型渠道，例如 OpenAI 兼容接口、第三方中转接口、自建模型服务。
- 管理模型配置，例如展示名称、真实模型 ID、可用渠道、启用状态、token 统计。
- 管理技能和插件，为后续 Agent 能力编排提供数据基础。
- 管理系统配置，通过 K-V 配置向前端返回公开配置、登录后配置或管理员配置。
- 记录图片、音频、视频、文件等资源元数据，支持后续生成类能力复用。
- 记录对话和调用结果，为上下文、审计、统计、计费、失败重试做准备。
- 提供双 token 鉴权基础，区分普通用户接口和管理员配置接口。
- 支持登录会话和设备限制，为后续多设备管理、踢下线和安全审计做准备。
- 预留 Redis，用于 token 黑名单、会话缓存、限流、短期任务状态和热点配置缓存。
- 保持 Bun + Hono + Prisma + PostgreSQL 的轻量后端架构，可部署到 Bun 服务、阿里云函数计算 FC 和 Cloudflare Workers。

## 2. 当前项目现状

已具备：

- Bun + Hono TypeScript 后端基础结构。
- Prisma + PostgreSQL 数据访问。
- 用户注册和用户查询接口。
- 统一响应格式和业务异常。
- Bun 本地服务入口、Cloudflare Workers 入口、阿里云 FC 构建配置。

当前缺口：

- 还没有模型渠道、模型、技能、插件、模型调用记录等核心业务表。
- 还没有系统配置 K-V 表，前端运行配置缺少统一来源。
- 还没有 AI 能力调用的统一抽象。
- 还没有 `accessToken + refreshToken` 的双 token 鉴权。
- 还没有用户登录会话、设备限制和聊天会话模型。
- 还没有 Redis 缓存与限流基础设施。
- 还没有后台配置类 API。
- 还没有对 token、调用状态、失败原因等数据的沉淀。

## 3. 开发原则

- 先搭底座，再接能力：先完成配置和记录能力，再实现真实聊天、TTS、画图、视频生成。
- 路由保持轻量：参数校验和 HTTP 适配放在 `src/routes/`，业务规则放在 `src/services/`。
- 数据库字段显式：所有核心表都保留 `created_at`、`updated_at`、`deleted_at`，删除默认使用软删除。
- 密钥加密入库：渠道密钥必须加密保存，接口返回时只允许返回脱敏值。
- 状态可控：模型、渠道、技能、插件都必须支持启用和停用。
- 协议可适配：优先支持 OpenAI-compatible API，但调用层必须预留非 OpenAI 协议适配层。
- 权限边界明确：配置类接口仅管理员可用，普通用户只能调用面向用户的能力接口并访问自己的调用记录。
- 配置分级返回：系统配置按 `PUBLIC`、`AUTHENTICATED`、`ADMIN` 控制读取权限。
- 会话概念分离：登录设备会话使用 `user_sessions`，聊天窗口会话使用 `conversations`，不能混用。
- Redis 只保存短期状态和缓存，PostgreSQL 仍是核心业务数据的唯一持久来源。
- 测试优先覆盖核心逻辑：服务层、工具函数、导入安全和关键错误路径需要测试。

## 4. 阶段规划

### 4.1 第一阶段：AI 配置底座

目标：让系统可以配置模型渠道、模型、技能、插件，并记录单次模型能力调用。

范围：

- 新增数据库表：`model_channels`、`models`、`model_channel_bindings`、`model_prices`、`skills`、`user_skills`、`user_default_skills`、`conversation_skills`、`plugins`、`configs`、`generation_jobs`、`assets`、`model_invocations`、`billing_records`、`user_sessions`、`conversation_groups`、`conversations`、`conversation_messages`。
- 新增双 token 鉴权：`accessToken + refreshToken`。
- refresh token 绑定 `user_sessions`，支持设备识别、设备数量限制和主动失效。
- 新增基础 CRUD API。
- 支持启用、停用和软删除。
- 配置类 CRUD API 仅管理员可用。
- 系统技能由 `skills` 管理，用户技能库由 `user_skills` 管理，对话启用技能由 `conversation_skills` 管理。
- 用户可以通过 `user_default_skills` 设置新对话默认启用的技能。
- 系统配置支持 K-V 存储，并按权限级别返回给前端。
- OSS、S3、SMTP 等系统连接配置放入 `configs`，通过 `group` 区分配置域。
- 异步生成任务放入 `generation_jobs`，用于记录 TTS、图片、视频生成过程。
- 资源文件元数据放入 `assets`，不在资源表保存 OSS/S3 密钥。
- 模型通过关联表绑定多个渠道，渠道优先级代表主备顺序。
- 模型价格通过 `model_prices` 管理，支持按模型、渠道和生效时间定价。
- 模型调用记录可以保存请求内容、响应内容、模型、渠道、token、状态和错误信息。
- 模型调用产生的费用通过 `billing_records` 记录，第一阶段可以只记录不实际扣费。
- 聊天分组由 `conversation_groups` 管理，聊天会话由 `conversations` 管理，聊天消息由 `conversation_messages` 管理，模型调用由 `model_invocations` 管理。
- 普通用户只能访问自己的调用记录。
- 引入 Redis 连接配置，但第一阶段只用于鉴权会话缓存、限流预留和热点配置缓存，不把核心数据只写入 Redis。
- 完善 `develop.md` 和 README 中的开发方向说明。

不包含：

- 不直接调用真实 AI 模型，但需要预留协议适配接口边界。
- 不实现流式响应。
- 不实现真实扣费和余额变更，但会预留价格表和计费流水表。
- 不实现后台管理前端。
- 不实现复杂 Redis 队列和分布式锁。

### 4.2 第二阶段：聊天调用能力

目标：基于第一阶段配置，实现统一聊天接口。

范围：

- 新增 `/api/chat/completions`。
- 新增聊天会话和消息接口，例如 `/api/conversations`。
- 根据模型配置选择可用渠道。
- 支持主渠道失败后切换备用渠道。
- 支持保存单次调用的请求、模型响应、token 用量和失败原因。
- 支持把一次模型调用关联到 `conversation`，并将用户消息和助手消息保存到 `conversation_messages`。
- 支持基础上下文传入。
- 兼容 OpenAI Chat Completions 请求结构的核心字段。
- 调用层通过 adapter 适配不同协议，不能把 OpenAI 请求结构硬编码到业务服务里。

不包含：

- 复杂 Agent 规划。
- 长期记忆。
- 多用户团队或租户隔离。

### 4.3 第三阶段：多模态能力

目标：扩展 TTS、图片生成、视频生成。

范围：

- TTS：提交文本，返回语音文件 URL 或二进制结果引用。
- 图片生成：提交提示词，返回图片任务和结果。
- 视频生成：提交提示词或图片，返回异步任务状态和结果。
- 模型能力类型用于区分 `CHAT`、`TTS`、`IMAGE`、`VIDEO`。
- 一个模型第一阶段只绑定一个能力类型；后续如果模型支持多个能力，再拆能力关联表。

### 4.4 第四阶段：Agent、插件和技能编排

目标：让技能和插件从静态配置变成可编排能力。

边界定义：

- `skills` 表示模型或 Agent 可理解的能力描述，例如网页搜索、总结文章、查询天气。
- `plugins` 表示真实可执行的外部工具配置，例如搜索 HTTP API、天气 API、Webhook。
- 第一阶段只保存二者元信息，不执行技能，不调用插件，也不建立技能和插件的关联表。

范围：

- 技能可以声明名称、描述、输入 schema、输出 schema、可调用模型。
- 插件可以声明调用地址、鉴权方式、参数 schema。
- Agent 可以根据用户输入选择技能或插件。
- 记录每次技能和插件调用过程。

### 4.5 第五阶段：运营、安全和计费

目标：补齐生产环境需要的运营能力。

范围：

- 用户 API Key。
- 请求限流。
- Redis 限流策略、设备在线状态和 token 黑名单清理策略。
- token 统计、价格管理和用量报表。
- 余额和套餐扣费。
- 正式余额扣费前新增 `wallet_transactions`，记录充值、扣费、退款、赠送和人工调整等余额流水。
- 审计日志。
- 更细粒度的 RBAC 权限。
- 密钥轮换和密钥版本管理。

## 5. Enum 设计

枚举统一由 Prisma schema 定义，TypeScript 和 Zod 校验应复用同一组语义。命名使用英文大写枚举值，避免混用数字状态。

### 5.1 通用状态

#### `RecordStatus`

用于大多数可启停资源，例如模型、渠道、技能、插件、配置。

| 值 | 说明 |
| --- | --- |
| ENABLED | 启用 |
| DISABLED | 停用 |

#### `LifecycleStatus`

用于需要归档或软删除语义的用户内容，例如聊天会话。

| 值 | 说明 |
| --- | --- |
| ACTIVE | 正常 |
| ARCHIVED | 已归档，不允许继续对话 |
| DELETED | 已删除 |

### 5.2 用户与鉴权

#### `UserSessionStatus`

用于 `user_sessions.status`。

| 值 | 说明 |
| --- | --- |
| ACTIVE | 有效登录会话 |
| REVOKED | 已主动撤销 |
| EXPIRED | 已过期 |

### 5.3 模型与渠道

#### `ModelCapability`

用于模型、调用记录、任务和技能适用能力。

| 值 | 说明 |
| --- | --- |
| CHAT | 聊天 |
| TTS | 文本转语音 |
| IMAGE | 图片生成或图片能力 |
| VIDEO | 视频生成 |

#### `ChannelProtocol`

用于 `model_channels.protocol`。

| 值 | 说明 |
| --- | --- |
| OPENAI_COMPATIBLE | OpenAI 兼容协议 |
| CUSTOM | 自定义协议，需 adapter 适配 |

#### `PriceUnit`

用于 `model_prices.unit`。

| 值 | 说明 |
| --- | --- |
| ONE_K_TOKENS | 每 1K tokens |
| ONE_M_TOKENS | 每 1M tokens |
| REQUEST | 每次请求 |
| SECOND | 每秒，适合音视频 |

### 5.4 技能与插件

#### `UserSkillSource`

用于 `user_skills.source`。

| 值 | 说明 |
| --- | --- |
| SYSTEM | 来自系统技能 |
| CUSTOM | 用户自定义技能 |

#### `PluginAuthType`

用于 `plugins.auth_type`。

| 值 | 说明 |
| --- | --- |
| NONE | 无鉴权 |
| API_KEY | API Key |
| BEARER | Bearer Token |

### 5.5 配置

#### `ConfigAccessLevel`

用于 `configs.access_level`。

| 值 | 说明 |
| --- | --- |
| PUBLIC | 免登录可读 |
| AUTHENTICATED | 登录后可读 |
| ADMIN | 仅管理员可读 |

### 5.6 对话与消息

#### `ConversationGroupType`

用于 `conversation_groups.type`。

| 值 | 说明 |
| --- | --- |
| NORMAL | 普通分组 |
| ARCHIVE | 归档分组 |

#### `MessageRole`

用于 `conversation_messages.role`。

| 值 | 说明 |
| --- | --- |
| SYSTEM | 系统消息 |
| USER | 用户消息 |
| ASSISTANT | 助手消息 |
| TOOL | 工具消息 |

#### `MessageContentType`

用于 `conversation_messages.content_type`。

| 值 | 说明 |
| --- | --- |
| TEXT | 文本 |
| IMAGE | 图片 |
| AUDIO | 音频 |
| VIDEO | 视频 |
| JSON | 结构化 JSON |

### 5.7 任务、资源和计费

#### `GenerationJobStatus`

用于 `generation_jobs.status`。

| 值 | 说明 |
| --- | --- |
| PENDING | 等待执行 |
| RUNNING | 执行中 |
| SUCCESS | 成功 |
| FAILED | 失败 |
| CANCELED | 已取消 |

#### `AssetType`

用于 `assets.type`。

| 值 | 说明 |
| --- | --- |
| IMAGE | 图片 |
| AUDIO | 音频 |
| VIDEO | 视频 |
| FILE | 普通文件 |

#### `AssetStatus`

用于 `assets.status`。

| 值 | 说明 |
| --- | --- |
| PENDING | 等待生成或上传 |
| READY | 可用 |
| FAILED | 失败 |
| DELETED | 已删除 |

#### `InvocationStatus`

用于 `model_invocations.status`。

| 值 | 说明 |
| --- | --- |
| PENDING | 等待调用 |
| SUCCESS | 调用成功 |
| FAILED | 调用失败 |

#### `BillingStatus`

用于 `billing_records.status`。

| 值 | 说明 |
| --- | --- |
| PENDING | 待计费 |
| CHARGED | 已计费 |
| REFUNDED | 已退款 |
| FAILED | 计费失败 |

## 6. 数据库设计

### 6.1 通用约定

- 主键使用自增 `Int`。
- 时间字段使用 `created_at`、`updated_at`、`deleted_at`。
- `deleted_at` 不为空表示已软删除。
- 状态字段优先使用 Prisma enum，而不是裸数字。
- 所有列表查询默认过滤 `deleted_at IS NULL`。
- 业务字段使用 TypeScript 侧 camelCase，数据库字段使用 snake_case，并通过 Prisma `@map` 映射。

### 6.2 模型渠道表：`model_channels`

用途：保存模型供应商或中转渠道的请求配置。

| 字段 | 类型 | 解释 | 作用 |
| --- | --- | --- | --- |
| id | Int | 唯一自增 ID | 被模型引用 |
| name | String | 渠道名称 | 用于后台展示 |
| base_url | String | 请求地址 | 例如 `https://api.openai.com/v1` |
| api_key_encrypted | String | 加密后的请求密钥 | 调用供应商接口 |
| provider | String | 渠道供应商 | 例如 `openai`、`azure`、`custom` |
| protocol | enum | 协议类型 | `OPENAI_COMPATIBLE`、`CUSTOM` |
| status | enum | 状态 | `ENABLED` 启用，`DISABLED` 停用 |
| remark | String? | 备注 | 运维说明 |
| created_at | DateTime | 创建时间 | 审计 |
| updated_at | DateTime | 更新时间 | 审计 |
| deleted_at | DateTime? | 删除时间 | 软删除 |

索引建议：

- `status`
- `provider`
- `protocol`
- `created_at`

接口返回约束：

- `api_key_encrypted` 不允许返回。
- 可返回 `apiKeyMasked`，例如 `sk-****abcd`。
- 创建和更新时接收明文 `apiKey`，服务层负责加密后保存。

### 6.3 模型表：`models`

用途：保存用户可选择的模型配置，并定义模型和渠道的关系。

| 字段 | 类型 | 解释 | 作用 |
| --- | --- | --- | --- |
| id | Int | 唯一自增 ID | 模型配置 ID |
| name | String | 模型展示名 | 展示给用户 |
| description | String? | 模型描述 | 说明模型特点、用途和适用场景 |
| model | String | 真实模型 ID | 对接供应商的模型名 |
| capability | enum | 能力类型 | `CHAT`、`TTS`、`IMAGE`、`VIDEO` |
| tokens | BigInt | 总消耗 token | 统计 |
| status | enum | 状态 | `ENABLED` 启用，`DISABLED` 停用 |
| remark | String? | 备注 | 运维说明 |
| created_at | DateTime | 创建时间 | 审计 |
| updated_at | DateTime | 更新时间 | 审计 |
| deleted_at | DateTime? | 删除时间 | 软删除 |

说明：

- 模型和渠道的绑定关系由 `model_channel_bindings` 表维护。
- 模型能力归属于模型本身，渠道只负责请求协议和供应商配置。
- 模型价格不直接放在 `models` 表，统一由 `model_prices` 管理。
- `tokens` 是累计统计字段，后续聊天调用成功后递增。

### 6.4 模型渠道关联表：`model_channel_bindings`

用途：保存模型可以通过哪些渠道调用，以及主备优先级。

| 字段 | 类型 | 解释 | 作用 |
| --- | --- | --- | --- |
| id | Int | 唯一自增 ID | 绑定 ID |
| model_id | Int | 模型 ID | 关联 `models.id` |
| channel_id | Int | 渠道 ID | 关联 `model_channels.id` |
| priority | Int | 优先级 | 数字越小优先级越高 |
| status | enum | 状态 | `ENABLED` 启用，`DISABLED` 停用 |
| created_at | DateTime | 创建时间 | 审计 |
| updated_at | DateTime | 更新时间 | 审计 |

约束建议：

- `model_id + channel_id` 唯一。
- 查询可用渠道时按 `priority ASC` 排序。

### 6.5 模型价格表：`model_prices`

用途：保存模型价格。价格可能随时间、渠道、供应商或运营策略变化，因此不直接写在 `models` 表里。

| 字段 | 类型 | 解释 | 作用 |
| --- | --- | --- | --- |
| id | Int | 唯一自增 ID | 价格记录 ID |
| model_id | Int | 模型 ID | 关联 `models.id` |
| channel_id | Int? | 渠道 ID | 为空表示模型默认价格，不为空表示渠道特价 |
| input_price | Decimal | 输入单价 | 输入 token 或输入任务计价 |
| output_price | Decimal | 输出单价 | 输出 token 或输出结果计价 |
| currency | String | 币种 | 例如 `CNY`、`USD` |
| unit | enum | 计价单位 | `ONE_K_TOKENS`、`ONE_M_TOKENS`、`REQUEST`、`SECOND` |
| effective_from | DateTime | 生效时间 | 价格开始生效 |
| effective_to | DateTime? | 失效时间 | 为空表示长期有效 |
| status | enum | 状态 | `ENABLED` 启用，`DISABLED` 停用 |
| created_at | DateTime | 创建时间 | 审计 |
| updated_at | DateTime | 更新时间 | 审计 |

约束建议：

- 同一模型、同一渠道、同一时间范围内只能有一条启用价格。
- 查询价格时优先匹配 `model_id + channel_id`，没有渠道价格时回退到 `model_id` 默认价格。
- 第一阶段可只维护价格记录，不实际扣余额。

### 6.6 技能表：`skills`

用途：保存系统级技能定义。它是平台提供的技能模板，不直接表示某个用户是否拥有或某个对话是否启用。

第一阶段只保存元信息，不执行技能，不做 Agent 自动选择。

| 字段 | 类型 | 解释 | 作用 |
| --- | --- | --- | --- |
| id | Int | 唯一自增 ID | 技能 ID |
| name | String | 技能名称 | 展示和选择 |
| description | String | 技能描述 | 帮助模型理解技能用途 |
| code | String | 技能编码 | 程序内部引用 |
| capability | enum? | 关联能力 | 可选，限定技能适用场景 |
| config | Json? | 技能配置 | 保存 schema、提示词、参数等 |
| status | enum | 状态 | `ENABLED` 启用，`DISABLED` 停用 |
| created_at | DateTime | 创建时间 | 审计 |
| updated_at | DateTime | 更新时间 | 审计 |
| deleted_at | DateTime? | 删除时间 | 软删除 |

约束建议：

- `code` 唯一。

### 6.7 用户技能库表：`user_skills`

用途：保存用户自己的技能库。用户可以从系统技能库启用某个技能，也可以后续扩展为自定义技能。

| 字段 | 类型 | 解释 | 作用 |
| --- | --- | --- | --- |
| id | Int | 唯一自增 ID | 用户技能 ID |
| user_id | Int | 用户 ID | 技能归属 |
| skill_id | Int? | 系统技能 ID | 关联 `skills.id`，自定义技能可为空 |
| name | String | 展示名称 | 可覆盖系统技能名称 |
| description | String? | 描述 | 可覆盖系统技能描述 |
| config | Json? | 用户级配置 | 用户自己的参数、提示词、开关 |
| source | enum | 来源 | `SYSTEM`、`CUSTOM` |
| status | enum | 状态 | `ENABLED`、`DISABLED` |
| created_at | DateTime | 创建时间 | 审计 |
| updated_at | DateTime | 更新时间 | 审计 |
| deleted_at | DateTime? | 删除时间 | 软删除 |

约束建议：

- 同一用户对同一个系统技能只能启用一次，即 `user_id + skill_id` 唯一，其中 `skill_id` 不为空时生效。
- 普通用户只能管理自己的 `user_skills`。

### 6.8 用户默认技能表：`user_default_skills`

用途：保存用户创建新对话时默认启用的技能。创建 `conversations` 时，可按此表初始化 `conversation_skills`。

| 字段 | 类型 | 解释 | 作用 |
| --- | --- | --- | --- |
| id | Int | 唯一自增 ID | 默认技能 ID |
| user_id | Int | 用户 ID | 配置归属 |
| user_skill_id | Int | 用户技能 ID | 关联 `user_skills.id` |
| sort | Int | 排序值 | 新对话技能展示顺序 |
| status | enum | 状态 | `ENABLED`、`DISABLED` |
| created_at | DateTime | 创建时间 | 审计 |
| updated_at | DateTime | 更新时间 | 审计 |

约束建议：

- `user_id + user_skill_id` 唯一。
- 只允许引用当前用户自己的 `user_skills`。

### 6.9 对话技能绑定表：`conversation_skills`

用途：保存某个对话当前启用了哪些技能，以及这些技能在该对话中的配置。

| 字段 | 类型 | 解释 | 作用 |
| --- | --- | --- | --- |
| id | Int | 唯一自增 ID | 对话技能绑定 ID |
| conversation_id | Int | 聊天会话 ID | 关联 `conversations.id` |
| user_id | Int | 用户 ID | 冗余字段，便于隔离和查询 |
| user_skill_id | Int | 用户技能 ID | 关联 `user_skills.id` |
| config | Json? | 对话级配置 | 覆盖用户技能默认配置 |
| sort | Int | 排序值 | 对话内展示和执行顺序 |
| status | enum | 状态 | `ENABLED`、`DISABLED` |
| created_at | DateTime | 创建时间 | 审计 |
| updated_at | DateTime | 更新时间 | 审计 |

约束建议：

- `conversation_id + user_skill_id` 唯一。
- 只允许给自己的对话绑定自己的 `user_skills`。
- `conversations.status = ARCHIVED` 时不能修改 `conversation_skills`。

### 6.10 插件表：`plugins`

用途：保存外部工具、HTTP 服务或第三方插件配置。

第一阶段只保存元信息，不执行插件调用，不保存插件密钥。后续如插件需要密钥，也必须采用加密入库。

| 字段 | 类型 | 解释 | 作用 |
| --- | --- | --- | --- |
| id | Int | 唯一自增 ID | 插件 ID |
| name | String | 插件名称 | 展示 |
| description | String | 插件描述 | 说明用途 |
| code | String | 插件编码 | 程序内部引用 |
| endpoint | String? | 插件地址 | HTTP 插件调用地址 |
| auth_type | enum | 鉴权方式 | `NONE`、`API_KEY`、`BEARER` |
| config | Json? | 插件配置 | 参数 schema、header、超时等 |
| status | enum | 状态 | `ENABLED` 启用，`DISABLED` 停用 |
| created_at | DateTime | 创建时间 | 审计 |
| updated_at | DateTime | 更新时间 | 审计 |
| deleted_at | DateTime? | 删除时间 | 软删除 |

约束建议：

- `code` 唯一。

### 6.11 系统配置表：`configs`

用途：通过 K-V 形式保存系统配置，并按权限级别返回给前端。适合保存站点名称、公告、默认模型、功能开关、上传限制、前端展示开关等低频配置。

| 字段 | 类型 | 解释 | 作用 |
| --- | --- | --- | --- |
| key | String | 配置键 | 主键，程序读取配置的唯一标识 |
| group | String | 配置分组 | 例如 `site`、`feature`、`email`、`oss`、`auth` |
| value | Json | 配置值 | 支持字符串、数字、布尔、数组、对象 |
| access_level | enum | 读取权限 | `PUBLIC`、`AUTHENTICATED`、`ADMIN` |
| description | String | 字段含义说明 | 解释该配置的用途和影响 |
| sort | Int | 排序值 | 前端展示或后台管理排序 |
| status | enum | 状态 | `ENABLED` 启用，`DISABLED` 停用 |

权限说明：

- `PUBLIC`：免授权可读取，适合站点名称、备案信息、公开公告、登录页配置。
- `AUTHENTICATED`：登录后可读取，适合用户侧功能开关、默认模型、上传限制。
- `ADMIN`：仅管理员可读取，适合后台配置和运维开关。

约束建议：

- `key` 作为主键，不再额外使用自增 `id`。
- `group` 不使用 enum，避免新增配置域时频繁迁移；统一使用小写命名。
- 列表查询默认只返回 `status = ENABLED` 的配置，并按 `group ASC`、`sort ASC`、`key ASC` 排序。
- 普通前端读取配置时不能越权返回更高权限配置。
- 第一阶段允许保存 SMTP 密码等管理员级配置，但必须设置 `access_level = ADMIN`。
- OSS/S3 配置也放入 `configs`，例如 `oss.endpoint`、`oss.bucket`、`oss.accessKey`、`oss.secretKey`，并设置 `group = oss`、`access_level = ADMIN`。
- `ADMIN` 只代表接口读取权限，不代表数据库加密；生产环境如需更高安全性，再引入加密字段或独立 secrets 表。
- 日志中禁止打印 `configs.value`，避免 SMTP 密码等配置泄漏。

示例：

```json
{
  "key": "site.name",
  "group": "site",
  "value": "myAgent",
  "accessLevel": "PUBLIC",
  "description": "前端展示的站点名称",
  "sort": 10,
  "status": "ENABLED"
}
```

### 6.12 异步生成任务表：`generation_jobs`

用途：保存 TTS、图片、视频等异步生成任务的过程状态。`generation_jobs` 记录任务过程，`assets` 记录生成后的资源文件元数据。

| 字段 | 类型 | 解释 | 作用 |
| --- | --- | --- | --- |
| id | Int | 唯一自增 ID | 任务 ID |
| user_id | Int | 用户 ID | 任务归属和数据隔离 |
| model_id | Int? | 模型 ID | 使用的模型 |
| channel_id | Int? | 渠道 ID | 实际使用的渠道 |
| model_invocation_id | Int? | 模型调用 ID | 关联底层调用记录 |
| conversation_id | Int? | 聊天会话 ID | 关联聊天上下文 |
| capability | enum | 能力类型 | `TTS`、`IMAGE`、`VIDEO` |
| request | Json | 任务请求 | 提示词、文本、输入资源等 |
| result | Json? | 任务结果 | 供应商任务 ID、结果摘要等 |
| result_asset_id | Int? | 主结果资源 ID | 关联主要产物 |
| status | enum | 任务状态 | `PENDING`、`RUNNING`、`SUCCESS`、`FAILED`、`CANCELED` |
| progress | Int | 进度 | 0-100 |
| error_message | String? | 错误信息 | 失败排查 |
| started_at | DateTime? | 开始时间 | 任务执行时间 |
| completed_at | DateTime? | 完成时间 | 任务执行时间 |
| created_at | DateTime | 创建时间 | 审计 |
| updated_at | DateTime | 更新时间 | 审计 |
| deleted_at | DateTime? | 删除时间 | 软删除 |

索引建议：

- `user_id`
- `model_id`
- `model_invocation_id`
- `conversation_id`
- `capability`
- `status`
- `created_at`

说明：

- 第一阶段只设计表和基础查询，暂不实现队列执行器。
- 一个任务可能生成多个资源，多个结果资源通过 `assets.generation_job_id` 关联。
- `result_asset_id` 只保存主结果资源，例如一段 TTS 音频或一张主图。

### 6.13 资源表：`assets`

用途：保存图片、音频、视频、普通文件等资源元数据。资源真实文件存储在 OSS/S3/R2/MinIO 等对象存储中，存储连接配置放在 `configs`，资源表只保存对象信息和业务归属。

| 字段 | 类型 | 解释 | 作用 |
| --- | --- | --- | --- |
| id | Int | 唯一自增 ID | 资源 ID |
| user_id | Int | 用户 ID | 资源归属和数据隔离 |
| generation_job_id | Int? | 生成任务 ID | 关联生成该资源的异步任务 |
| model_invocation_id | Int? | 模型调用 ID | 关联生成该资源的调用 |
| conversation_id | Int? | 聊天会话 ID | 关联聊天上下文 |
| conversation_message_id | Int? | 聊天消息 ID | 关联展示该资源的消息 |
| type | enum | 资源类型 | `IMAGE`、`AUDIO`、`VIDEO`、`FILE` |
| storage_group | String | 存储配置分组 | 例如 `oss`，对应 `configs.group` |
| bucket | String? | Bucket 名称 | 资源所在 bucket，可从配置冗余 |
| object_key | String | 对象 key | 对象存储中的文件路径 |
| url | String? | 访问 URL | 可为公开 URL 或签名 URL |
| mime_type | String? | MIME 类型 | 例如 `image/png`、`audio/mpeg` |
| size | BigInt? | 文件大小 | 字节数 |
| checksum | String? | 文件校验值 | 去重或完整性校验 |
| metadata | Json? | 扩展信息 | 宽高、时长、生成参数、封面等 |
| status | enum | 状态 | `PENDING`、`READY`、`FAILED`、`DELETED` |
| created_at | DateTime | 创建时间 | 审计 |
| updated_at | DateTime | 更新时间 | 审计 |
| deleted_at | DateTime? | 删除时间 | 软删除 |

索引建议：

- `user_id`
- `generation_job_id`
- `model_invocation_id`
- `conversation_id`
- `conversation_message_id`
- `type`
- `status`
- `created_at`

访问规则：

- 普通用户只能访问自己的资源。
- 管理员可以按用户、类型、状态和时间筛选资源。
- 聊天消息展示图片、音频、视频时，可以通过 `assets.conversation_message_id` 关联到具体消息。
- 删除资源第一阶段只软删除 `assets` 记录；是否删除对象存储中的真实文件放到后续资源清理任务处理。

### 6.14 模型调用记录表：`model_invocations`

用途：保存一次模型能力调用记录。该表不是“会话表”，一行表示一次聊天、TTS、图片或视频调用。

| 字段 | 类型 | 解释 | 作用 |
| --- | --- | --- | --- |
| id | Int | 唯一自增 ID | 调用记录 ID |
| user_id | Int | 用户 ID | 关联用户，用于数据隔离 |
| conversation_id | Int? | 聊天会话 ID | 关联 `conversations.id` |
| model_id | Int? | 模型配置 ID | 记录使用的模型 |
| channel_id | Int? | 渠道 ID | 记录实际命中的渠道 |
| capability | enum | 能力类型 | `CHAT`、`TTS`、`IMAGE`、`VIDEO` |
| request | Json | 请求内容 | 保存输入消息、提示词或任务参数 |
| response | Json? | 响应内容 | 保存模型输出或任务结果 |
| prompt_tokens | Int | 输入 token | 统计 |
| completion_tokens | Int | 输出 token | 统计 |
| total_tokens | Int | 总 token | 统计 |
| estimated_amount | Decimal? | 预估费用 | 调用完成时根据价格计算 |
| status | enum | 调用状态 | `PENDING`、`SUCCESS`、`FAILED` |
| error_message | String? | 错误信息 | 失败排查 |
| created_at | DateTime | 创建时间 | 审计 |
| updated_at | DateTime | 更新时间 | 审计 |
| deleted_at | DateTime? | 删除时间 | 软删除 |

索引建议：

- `user_id`
- `conversation_id`
- `model_id`
- `channel_id`
- `capability`
- `status`
- `created_at`

访问规则：

- 普通用户只能查询自己的调用记录。
- 管理员可以按用户、模型、渠道、状态和时间筛选调用记录。

### 6.15 计费流水表：`billing_records`

用途：保存一次模型调用产生的费用流水。`model_invocations` 是技术调用明细，`billing_records` 是费用账本，二者不能混用。

| 字段 | 类型 | 解释 | 作用 |
| --- | --- | --- | --- |
| id | Int | 唯一自增 ID | 计费流水 ID |
| user_id | Int | 用户 ID | 费用归属 |
| model_invocation_id | Int | 模型调用 ID | 关联 `model_invocations.id` |
| model_id | Int? | 模型 ID | 冗余字段，便于查询 |
| channel_id | Int? | 渠道 ID | 冗余字段，便于查询 |
| model_price_id | Int? | 价格 ID | 关联命中的价格记录 |
| capability | enum | 能力类型 | `CHAT`、`TTS`、`IMAGE`、`VIDEO` |
| prompt_tokens | Int | 输入 token | 计费依据 |
| completion_tokens | Int | 输出 token | 计费依据 |
| total_tokens | Int | 总 token | 计费依据 |
| input_amount | Decimal | 输入费用 | 按输入单价计算 |
| output_amount | Decimal | 输出费用 | 按输出单价计算 |
| total_amount | Decimal | 总费用 | 输入费用 + 输出费用 |
| currency | String | 币种 | 与价格记录一致 |
| status | enum | 计费状态 | `PENDING`、`CHARGED`、`REFUNDED`、`FAILED` |
| description | String? | 说明 | 失败原因、退款原因或人工备注 |
| created_at | DateTime | 创建时间 | 审计 |

约束建议：

- `model_invocation_id` 唯一，避免同一次调用重复计费。
- 第一阶段可以只生成 `PENDING` 或 `CHARGED` 记录，不实际扣减用户余额。
- 后续涉及余额变动时，需要新增 `wallet_transactions` 作为余额账本，不要只更新 `users.balance`。

索引建议：

- `user_id`
- `model_invocation_id`
- `model_id`
- `status`
- `created_at`

### 6.16 鉴权相关表

第一阶段需要支持 `accessToken + refreshToken`。

实现方式：

- `accessToken` 使用短期 JWT，不入库。
- `refreshToken` 使用随机字符串或 JWT，服务端只保存哈希值。
- `refreshToken` 绑定 `user_sessions`，一个登录设备对应一条 `user_sessions`。
- Redis 可以缓存活跃 session、token 黑名单和用户设备数量，但数据库仍保留最终状态。

建议新增表：`user_sessions`。

| 字段 | 类型 | 解释 | 作用 |
| --- | --- | --- | --- |
| id | Int | 唯一自增 ID | 登录会话 ID |
| user_id | Int | 用户 ID | 关联用户 |
| refresh_token_hash | String | refreshToken 哈希 | 不保存明文 token |
| device_id | String? | 设备 ID | 前端生成或服务端识别 |
| device_name | String? | 设备名称 | 展示给用户 |
| user_agent | String? | User-Agent | 安全审计 |
| ip | String? | 登录 IP | 安全审计 |
| status | enum | 会话状态 | `ACTIVE`、`REVOKED`、`EXPIRED` |
| last_active_at | DateTime? | 最近活跃时间 | 设备管理 |
| expires_at | DateTime | 过期时间 | 控制有效期 |
| revoked_at | DateTime? | 失效时间 | 退出登录或风控 |
| created_at | DateTime | 创建时间 | 审计 |
| updated_at | DateTime | 更新时间 | 审计 |

约束建议：

- `refresh_token_hash` 唯一。
- `user_id + device_id` 可加组合索引，用于设备数量限制和设备踢下线。
- 同一用户最大设备数先做配置项，超过限制时可拒绝登录或踢掉最早活跃设备。

### 6.17 聊天分组表：`conversation_groups`

用途：保存用户自定义的聊天分组。用户可以将会话放入不同分组，也可以将归档会话移动到其他分组。

| 字段 | 类型 | 解释 | 作用 |
| --- | --- | --- | --- |
| id | Int | 唯一自增 ID | 分组 ID |
| user_id | Int | 用户 ID | 分组归属和数据隔离 |
| name | String | 分组名称 | 用户自定义展示名称 |
| type | enum | 分组类型 | `NORMAL`、`ARCHIVE` |
| sort | Int | 排序值 | 前端展示排序 |
| status | enum | 状态 | `ENABLED`、`DISABLED` |
| created_at | DateTime | 创建时间 | 审计 |
| updated_at | DateTime | 更新时间 | 审计 |
| deleted_at | DateTime? | 删除时间 | 软删除 |

索引建议：

- `user_id`
- `type`
- `sort`

约束建议：

- 同一用户下分组名称建议唯一。
- 每个用户最多有一个 `type = ARCHIVE` 的归档分组。
- `ARCHIVE` 是分组类型，`ARCHIVED` 是会话状态，二者含义不同。
- 归档分组可以由系统自动创建，用户可以重命名普通分组，但不建议删除归档分组。

### 6.18 聊天会话表：`conversations`

用途：表示一个聊天窗口或一个多轮聊天主题。它不是登录会话，也不是单次模型调用。

| 字段 | 类型 | 解释 | 作用 |
| --- | --- | --- | --- |
| id | Int | 唯一自增 ID | 聊天会话 ID |
| user_id | Int | 用户 ID | 数据隔离 |
| group_id | Int? | 分组 ID | 关联 `conversation_groups.id` |
| title | String? | 会话标题 | 前端展示 |
| default_model_id | Int? | 默认模型 ID | 新消息默认使用的模型 |
| status | enum | 会话状态 | `ACTIVE`、`ARCHIVED`、`DELETED` |
| metadata | Json? | 扩展信息 | 保存摘要、标签等 |
| created_at | DateTime | 创建时间 | 审计 |
| updated_at | DateTime | 更新时间 | 审计 |
| deleted_at | DateTime? | 删除时间 | 软删除 |

索引建议：

- `user_id`
- `group_id`
- `status`
- `updated_at`

访问规则：

- 普通用户只能访问自己的 `conversations`。
- 管理员可以按用户查询。
- `status = ARCHIVED` 的会话不能继续发送新消息或发起模型调用。
- 归档会话可以移动到其他普通分组；移动后如果恢复为 `ACTIVE`，才允许继续对话。

### 6.19 聊天消息表：`conversation_messages`

用途：保存聊天会话中的每条消息。用户消息、助手消息、system 消息和 tool 消息都放在这里。

| 字段 | 类型 | 解释 | 作用 |
| --- | --- | --- | --- |
| id | Int | 唯一自增 ID | 消息 ID |
| conversation_id | Int | 聊天会话 ID | 关联 `conversations.id` |
| user_id | Int | 用户 ID | 冗余字段，便于隔离和查询 |
| model_invocation_id | Int? | 模型调用 ID | 关联生成该消息的调用 |
| role | enum | 消息角色 | `SYSTEM`、`USER`、`ASSISTANT`、`TOOL` |
| content_type | enum | 内容类型 | `TEXT`、`IMAGE`、`AUDIO`、`VIDEO`、`JSON` |
| content | String? | 文本内容 | 文本消息主体 |
| content_json | Json? | 结构化内容 | 多模态或工具消息 |
| metadata | Json? | 扩展信息 | token、引用、前端展示信息 |
| created_at | DateTime | 创建时间 | 审计 |
| deleted_at | DateTime? | 删除时间 | 软删除 |

索引建议：

- `conversation_id`
- `user_id`
- `model_invocation_id`
- `created_at`

关系说明：

- 一条用户消息通常没有 `model_invocation_id`。
- 一次 `model_invocation` 可以生成一条或多条 assistant/tool 消息。
- `model_invocations.conversation_id` 和 `conversation_messages.model_invocation_id` 共同建立“聊天上下文”和“模型调用”的双向关联。

### 6.20 Redis 规划

Redis 不作为核心业务数据表，而是作为短期状态和性能组件。

第一阶段预留用途：

- 活跃登录会话缓存：缓存 `user_sessions` 的常用校验信息。
- token 黑名单：保存已退出或已吊销但尚未过期的 access token 标识。
- 设备限制辅助：缓存用户当前活跃设备数，数据库作为最终依据。
- 配置缓存：缓存启用的模型、渠道和绑定关系，减少高频读取数据库。
- 限流预留：按用户、IP、接口维度保存短期计数器。

后续用途：

- 流式聊天过程中的短期状态。
- 异步生成任务状态缓存。
- 分布式锁，例如避免同一任务重复执行。
- 热点统计临时聚合。

约束：

- Redis 中的数据必须可重建。
- 涉及账务、调用记录、聊天消息、渠道密钥的核心数据必须落 PostgreSQL。
- Redis key 需要统一前缀，例如 `myagent:session:*`、`myagent:ratelimit:*`、`myagent:model-config:*`。

## 7. RESTful API 详细设计

所有业务接口默认挂载在 `/api` 下，响应使用现有 `ApiResponse` 格式：

```json
{
  "success": true,
  "code": 200,
  "message": "success",
  "data": {}
}
```

### 7.0.1 路径约定

- 用户侧接口使用 `/api/...`。
- 管理员接口使用 `/api/admin/...`。
- 配置类资源，例如模型、渠道、价格、技能、插件，默认只提供管理员接口。
- 用户拥有的数据，例如聊天会话、消息、调用记录、计费流水，默认按当前登录用户过滤。
- 资源 ID 使用路径参数，例如 `/api/admin/models/:id`。
- `configs` 使用 `key` 作为主键，例如 `/api/admin/configs/:key`。

### 7.0.2 HTTP 方法约定

| 方法 | 语义 |
| --- | --- |
| GET | 查询列表或详情 |
| POST | 创建资源或执行登录、刷新等动作 |
| PATCH | 局部更新资源 |
| DELETE | 删除、软删除、停用或撤销资源 |

删除规则：

- 大部分业务表使用软删除，即写入 `deleted_at`。
- `configs` 没有 `deleted_at`，删除接口建议将 `status` 改为 `DISABLED`，必要时管理员可在数据库层物理删除。
- `user_sessions` 删除表示撤销登录会话，即写入 `revoked_at` 并使 refresh token 失效。

### 7.0.3 分页、排序和筛选

列表接口默认支持：

```http
GET /api/resource?page=1&pageSize=20&keyword=xxx
```

分页参数：

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| page | number | 1 | 页码，从 1 开始 |
| pageSize | number | 20 | 每页数量，建议最大 100 |
| keyword | string? | - | 关键词搜索 |

分页响应：

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "pageSize": 20
}
```

排序约定：

- 配置类资源默认按 `created_at DESC`。
- `configs` 默认按 `sort ASC, key ASC`。
- 聊天会话默认按 `updated_at DESC`。
- 聊天消息默认按 `created_at ASC`。
- 调用记录和计费流水默认按 `created_at DESC`。

### 7.0.4 错误码约定

| HTTP 状态码 | 场景 |
| --- | --- |
| 400 | 请求参数错误、状态不允许、配置不完整 |
| 401 | 未登录或 access token 无效 |
| 403 | 已登录但权限不足 |
| 404 | 资源不存在或无权访问该资源 |
| 409 | 唯一键冲突或重复提交 |
| 422 | 请求结构正确但业务校验失败 |
| 500 | 服务端未知错误 |
| 502 | 上游模型渠道调用失败 |

业务错误响应沿用 `BusinessException`：

```json
{
  "success": false,
  "code": 403,
  "message": "Permission denied",
  "data": null,
  "errorCode": "FORBIDDEN"
}
```

鉴权约定：

- 普通用户接口需要有效 `accessToken`。
- 配置类接口需要有效 `accessToken`，且当前用户 `role === ADMIN`。
- `refreshToken` 只用于刷新 `accessToken`，不能直接访问业务接口。
- 用户只能访问自己的 `model_invocations`，管理员可以访问全部记录。
- Redis 可用于加速鉴权和限流，但接口权限判断必须能回落到 PostgreSQL 数据。

### 7.0.5 权限矩阵

| 资源 | 未登录 | 普通用户 | 管理员 |
| --- | --- | --- | --- |
| `/api/configs` | 读取 `PUBLIC` | 读取 `PUBLIC`、`AUTHENTICATED` | 读取全部 |
| `/api/admin/configs` | 禁止 | 禁止 | 管理全部 |
| `/api/admin/model-channels` | 禁止 | 禁止 | 管理全部 |
| `/api/admin/models` | 禁止 | 禁止 | 管理全部 |
| `/api/admin/models/:modelId/channels` | 禁止 | 禁止 | 管理全部 |
| `/api/admin/models/:modelId/prices` | 禁止 | 禁止 | 管理全部 |
| `/api/admin/skills` | 禁止 | 禁止 | 管理全部 |
| `/api/user-skills` | 禁止 | 管理自己的 | 管理自己的 |
| `/api/user-default-skills` | 禁止 | 管理自己的 | 管理自己的 |
| `/api/admin/plugins` | 禁止 | 禁止 | 管理全部 |
| `/api/auth/sessions` | 禁止 | 管理自己的 | 管理自己的 |
| `/api/conversations` | 禁止 | 管理自己的 | 管理全部或按用户查询 |
| `/api/generation-jobs` | 禁止 | 管理自己的 | 查询全部 |
| `/api/assets` | 禁止 | 查询自己的 | 查询全部 |
| `/api/conversation-groups` | 禁止 | 管理自己的 | 管理全部或按用户查询 |
| `/api/conversations/:id/skills` | 禁止 | 管理自己的 | 管理全部或按用户查询 |
| `/api/model-invocations` | 禁止 | 查询自己的 | 查询全部 |
| `/api/billing-records` | 禁止 | 查询自己的 | 查询全部 |

### 7.1 鉴权 API

```http
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET /api/auth/sessions
DELETE /api/auth/sessions/:sessionId
```

登录响应示例：

```json
{
  "accessToken": "短期访问 token",
  "refreshToken": "长期刷新 token",
  "expiresIn": 900
}
```

### 7.2 用户登录会话 API

```http
GET /api/auth/sessions
DELETE /api/auth/sessions/:sessionId
```

权限：

- 普通用户只能查看和撤销自己的登录会话。
- 管理员后续可以增加按用户查看登录会话的能力。
- 删除登录会话表示踢出对应设备，并使对应 refresh token 失效。

### 7.3 模型渠道 API

```http
GET /api/admin/model-channels
GET /api/admin/model-channels/:id
POST /api/admin/model-channels
PATCH /api/admin/model-channels/:id
DELETE /api/admin/model-channels/:id
```

权限：仅管理员。

列表筛选：

| 参数 | 说明 |
| --- | --- |
| keyword | 按名称、provider 搜索 |
| provider | 按供应商过滤 |
| protocol | 按协议过滤 |
| status | 按状态过滤 |

创建请求示例：

```json
{
  "name": "OpenAI 官方",
  "provider": "openai",
  "protocol": "OPENAI_COMPATIBLE",
  "baseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-xxx",
  "status": "ENABLED",
  "remark": "默认聊天渠道"
}
```

### 7.4 模型 API

```http
GET /api/admin/models
GET /api/admin/models/:id
POST /api/admin/models
PATCH /api/admin/models/:id
DELETE /api/admin/models/:id
```

权限：仅管理员。

列表筛选：

| 参数 | 说明 |
| --- | --- |
| keyword | 按展示名、真实模型 ID 搜索 |
| capability | 按能力过滤 |
| status | 按状态过滤 |

创建请求示例：

```json
{
  "name": "GPT-4.1 Mini",
  "description": "适合日常聊天、轻量推理和低成本任务",
  "model": "gpt-4.1-mini",
  "capability": "CHAT",
  "status": "ENABLED",
  "remark": "默认聊天模型"
}
```

### 7.5 模型渠道绑定 API

```http
GET /api/admin/models/:modelId/channels
POST /api/admin/models/:modelId/channels
PATCH /api/admin/models/:modelId/channels/:bindingId
DELETE /api/admin/models/:modelId/channels/:bindingId
```

权限：仅管理员。

创建请求示例：

```json
{
  "channelId": 1,
  "priority": 10,
  "status": "ENABLED"
}
```

### 7.6 模型价格 API

```http
GET /api/admin/models/:modelId/prices
POST /api/admin/models/:modelId/prices
PATCH /api/admin/models/:modelId/prices/:priceId
DELETE /api/admin/models/:modelId/prices/:priceId
```

权限：仅管理员。

列表筛选：

| 参数 | 说明 |
| --- | --- |
| channelId | 按渠道过滤 |
| status | 按状态过滤 |
| currency | 按币种过滤 |

创建请求示例：

```json
{
  "channelId": 1,
  "inputPrice": "0.001",
  "outputPrice": "0.002",
  "currency": "CNY",
  "unit": "ONE_K_TOKENS",
  "effectiveFrom": "2026-06-10T00:00:00.000Z",
  "effectiveTo": null,
  "status": "ENABLED"
}
```

### 7.7 技能 API

```http
GET /api/admin/skills
GET /api/admin/skills/:id
POST /api/admin/skills
PATCH /api/admin/skills/:id
DELETE /api/admin/skills/:id
```

权限：仅管理员。

列表筛选：

| 参数 | 说明 |
| --- | --- |
| keyword | 按名称、编码、描述搜索 |
| capability | 按能力过滤 |
| status | 按状态过滤 |

创建请求示例：

```json
{
  "name": "网页搜索",
  "code": "web_search",
  "description": "根据用户问题搜索公开网页并总结答案",
  "capability": "CHAT",
  "config": {
    "maxResults": 5
  },
  "status": "ENABLED"
}
```

### 7.8 用户技能库 API

```http
GET /api/user-skills
GET /api/user-skills/:id
POST /api/user-skills
PATCH /api/user-skills/:id
DELETE /api/user-skills/:id
```

权限：

- 普通用户只能管理自己的技能库。
- 管理员后续可以增加按用户查询的管理接口。

创建请求示例：

```json
{
  "skillId": 1,
  "name": "我的网页搜索",
  "description": "搜索网页并总结",
  "source": "SYSTEM",
  "config": {
    "maxResults": 5
  },
  "status": "ENABLED"
}
```

### 7.9 用户默认技能 API

```http
GET /api/user-default-skills
POST /api/user-default-skills
PATCH /api/user-default-skills/:id
DELETE /api/user-default-skills/:id
```

权限：

- 普通用户只能管理自己的新对话默认技能。
- 创建新对话时，系统按 `user_default_skills` 初始化 `conversation_skills`。

创建请求示例：

```json
{
  "userSkillId": 1,
  "sort": 10,
  "status": "ENABLED"
}
```

### 7.10 插件 API

```http
GET /api/admin/plugins
GET /api/admin/plugins/:id
POST /api/admin/plugins
PATCH /api/admin/plugins/:id
DELETE /api/admin/plugins/:id
```

权限：仅管理员。

列表筛选：

| 参数 | 说明 |
| --- | --- |
| keyword | 按名称、编码、描述搜索 |
| authType | 按鉴权方式过滤 |
| status | 按状态过滤 |

创建请求示例：

```json
{
  "name": "天气查询",
  "code": "weather",
  "description": "根据城市查询天气",
  "endpoint": "https://example.com/weather",
  "authType": "API_KEY",
  "config": {
    "timeoutMs": 10000
  },
  "status": "ENABLED"
}
```

### 7.11 系统配置 API

前端读取接口：

```http
GET /api/configs
GET /api/configs/:key
```

管理员管理接口：

```http
GET /api/admin/configs
GET /api/admin/configs/:key
POST /api/admin/configs
PATCH /api/admin/configs/:key
DELETE /api/admin/configs/:key
```

权限：

- 未登录用户只能读取 `PUBLIC` 配置。
- 登录用户可以读取 `PUBLIC` 和 `AUTHENTICATED` 配置。
- 管理员可以读取和管理全部配置。

前端读取参数：

| 参数 | 说明 |
| --- | --- |
| group | 按配置分组过滤，例如 `site`、`feature`、`email`、`oss` |
| prefix | 按 key 前缀过滤，例如 `site.`、`feature.` |

读取响应示例：

```json
{
  "site.name": "myAgent",
  "feature.imageGeneration.enabled": true
}
```

创建请求示例：

```json
{
  "key": "feature.imageGeneration.enabled",
  "group": "feature",
  "value": true,
  "accessLevel": "AUTHENTICATED",
  "description": "是否向登录用户开放图片生成功能",
  "sort": 100,
  "status": "ENABLED"
}
```

### 7.12 异步生成任务 API

用户侧任务接口：

```http
GET /api/generation-jobs
GET /api/generation-jobs/:id
POST /api/generation-jobs
```

管理员任务接口：

```http
GET /api/admin/generation-jobs
GET /api/admin/generation-jobs/:id
PATCH /api/admin/generation-jobs/:id
DELETE /api/admin/generation-jobs/:id
```

权限：

- 普通用户只能创建和查询自己的任务。
- 管理员可以查询全部任务，并可修正任务状态或软删除任务记录。
- 第一阶段只记录任务，不实现队列执行器和供应商轮询。

列表筛选：

| 参数 | 说明 |
| --- | --- |
| capability | 按能力类型过滤 |
| status | 按任务状态过滤 |
| conversationId | 按聊天会话过滤 |
| modelInvocationId | 按模型调用过滤 |
| userId | 管理员可用，按用户过滤 |
| startAt | 按创建时间起点过滤 |
| endAt | 按创建时间终点过滤 |

创建请求示例：

```json
{
  "modelId": 1,
  "conversationId": 1,
  "capability": "IMAGE",
  "request": {
    "prompt": "一只坐在月球上的机器人",
    "size": "1024x1024"
  }
}
```

### 7.13 资源 API

用户侧资源接口：

```http
GET /api/assets
GET /api/assets/:id
```

管理员资源接口：

```http
GET /api/admin/assets
GET /api/admin/assets/:id
PATCH /api/admin/assets/:id
DELETE /api/admin/assets/:id
```

权限：

- 普通用户只能查询自己的资源。
- 管理员可以查询全部资源，并可修正资源状态或软删除资源记录。
- 第一阶段不实现真实上传、对象存储删除和签名 URL 生成。

列表筛选：

| 参数 | 说明 |
| --- | --- |
| type | 按资源类型过滤 |
| status | 按状态过滤 |
| generationJobId | 按异步生成任务过滤 |
| conversationId | 按聊天会话过滤 |
| modelInvocationId | 按模型调用过滤 |
| userId | 管理员可用，按用户过滤 |
| startAt | 按创建时间起点过滤 |
| endAt | 按创建时间终点过滤 |

### 7.14 聊天分组 API

```http
GET /api/conversation-groups
GET /api/conversation-groups/:id
POST /api/conversation-groups
PATCH /api/conversation-groups/:id
DELETE /api/conversation-groups/:id
```

权限：

- 普通用户只能管理自己的聊天分组。
- 管理员可以按用户查询。
- `type = ARCHIVE` 的系统归档分组不建议删除。

列表筛选：

| 参数 | 说明 |
| --- | --- |
| type | 按分组类型过滤 |
| status | 按状态过滤 |
| userId | 管理员可用，按用户过滤 |

创建请求示例：

```json
{
  "name": "工作",
  "type": "NORMAL",
  "sort": 10,
  "status": "ENABLED"
}
```

### 7.15 聊天会话 API

```http
GET /api/conversations
GET /api/conversations/:id
POST /api/conversations
PATCH /api/conversations/:id
DELETE /api/conversations/:id
PATCH /api/conversations/:id/archive
PATCH /api/conversations/:id/restore
PATCH /api/conversations/:id/move
GET /api/conversations/:id/messages
POST /api/conversations/:id/messages
DELETE /api/conversations/:id/messages/:messageId
GET /api/conversations/:id/skills
POST /api/conversations/:id/skills
PATCH /api/conversations/:id/skills/:conversationSkillId
DELETE /api/conversations/:id/skills/:conversationSkillId
```

权限：

- 普通用户只能访问自己的聊天会话和消息。
- 管理员可以按用户查询。

会话列表筛选：

| 参数 | 说明 |
| --- | --- |
| keyword | 按标题搜索 |
| groupId | 按分组过滤 |
| status | 按状态过滤 |
| userId | 管理员可用，按用户过滤 |

消息列表筛选：

| 参数 | 说明 |
| --- | --- |
| beforeId | 查询某条消息之前的历史消息 |
| afterId | 查询某条消息之后的新消息 |
| pageSize | 每次加载数量 |

创建会话请求示例：

```json
{
  "title": "新的聊天",
  "groupId": 1,
  "defaultModelId": 1
}
```

移动会话请求示例：

```json
{
  "groupId": 2,
  "restore": true
}
```

规则：

- 归档会话不能继续创建消息，也不能继续发起模型调用。
- `PATCH /api/conversations/:id/archive` 将会话状态改为 `ARCHIVED`，并可移动到归档分组。
- `PATCH /api/conversations/:id/restore` 将会话状态恢复为 `ACTIVE`。
- `PATCH /api/conversations/:id/move` 用于移动分组；如果会话已归档，只有传入 `restore = true` 后才恢复继续对话。
- 创建新会话时，系统会读取 `user_default_skills`，初始化该会话的 `conversation_skills`。
- `ARCHIVED` 会话不能新增、修改或删除 `conversation_skills`。

创建消息请求示例：

```json
{
  "role": "USER",
  "contentType": "TEXT",
  "content": "你好"
}
```

对话启用技能请求示例：

```json
{
  "userSkillId": 1,
  "config": {
    "maxResults": 3
  },
  "sort": 10,
  "status": "ENABLED"
}
```

### 7.16 模型调用记录 API

第一阶段只做记录管理，不做真实模型调用。

```http
GET /api/model-invocations
GET /api/model-invocations/:id
POST /api/model-invocations
PATCH /api/model-invocations/:id
DELETE /api/model-invocations/:id
```

权限：

- 普通用户可以创建和查询自己的记录。
- 管理员可以查询全部记录。
- 普通用户创建记录时，`userId` 以后端鉴权身份为准，不能由请求体指定其他用户。

列表筛选：

| 参数 | 说明 |
| --- | --- |
| conversationId | 按聊天会话过滤 |
| modelId | 按模型过滤 |
| channelId | 按渠道过滤 |
| capability | 按能力过滤 |
| status | 按调用状态过滤 |
| userId | 管理员可用，按用户过滤 |
| startAt | 按创建时间起点过滤 |
| endAt | 按创建时间终点过滤 |

创建请求示例：

```json
{
  "userId": 1,
  "conversationId": 1,
  "modelId": 1,
  "channelId": 1,
  "capability": "CHAT",
  "request": {
    "messages": [
      {
        "role": "user",
        "content": "你好"
      }
    ]
  },
  "response": {
    "content": "你好，有什么可以帮你？"
  },
  "promptTokens": 10,
  "completionTokens": 12,
  "totalTokens": 22,
  "status": "SUCCESS"
}
```

### 7.17 计费流水 API

```http
GET /api/billing-records
GET /api/billing-records/:id
```

权限：

- 普通用户只能查询自己的计费流水。
- 管理员可以按用户、模型、状态和时间范围查询全部计费流水。
- 第一阶段不开放普通用户手动创建计费流水，流水由模型调用流程生成。

列表筛选：

| 参数 | 说明 |
| --- | --- |
| modelInvocationId | 按模型调用过滤 |
| modelId | 按模型过滤 |
| channelId | 按渠道过滤 |
| capability | 按能力过滤 |
| status | 按计费状态过滤 |
| userId | 管理员可用，按用户过滤 |
| startAt | 按创建时间起点过滤 |
| endAt | 按创建时间终点过滤 |

## 8. 后续聊天调用流程

第二阶段聊天接口可以按以下流程实现：

1. 用户请求聊天接口，传入 `modelId` 和 `messages`。
2. 后端读取 `models`，确认模型存在、未删除、已启用、能力为 `CHAT`。
3. 后端读取 `model_channel_bindings`，按优先级查找启用的渠道。
4. 根据渠道 `protocol` 选择对应 adapter。
5. 查询 `model_prices`，优先匹配模型 + 渠道价格，没有渠道价格时回退到模型默认价格。
6. 使用第一个可用渠道发起模型请求。
7. 如果主渠道失败，根据错误类型决定是否切换备用渠道。
8. 请求成功后保存 `model_invocations` 记录，写入响应内容、token 用量和预估费用。
9. 根据调用记录和命中的价格生成 `billing_records`。
10. 更新 `models.tokens` 累计值。
11. 返回统一响应给前端。

失败处理：

- 模型不存在：返回 404。
- 模型停用：返回 400。
- 没有可用渠道：返回 400。
- 所有渠道调用失败：返回 502，并保存失败记录。
- 供应商返回鉴权失败：返回 502，不暴露真实密钥。
- 不支持的协议：返回 400 或 501，具体根据配置错误或未实现能力决定。
- 没有可用价格：第一阶段可允许调用但不生成扣费流水，正式计费阶段应阻止调用或按免费价格处理。

## 9. 目录规划

新增后端模块时遵循现有目录结构：

```text
src/routes/modelChannel.route.ts
src/routes/model.route.ts
src/routes/modelChannelBinding.route.ts
src/routes/modelPrice.route.ts
src/routes/skill.route.ts
src/routes/userSkill.route.ts
src/routes/userDefaultSkill.route.ts
src/routes/conversationSkill.route.ts
src/routes/plugin.route.ts
src/routes/config.route.ts
src/routes/generationJob.route.ts
src/routes/asset.route.ts
src/routes/conversationGroup.route.ts
src/routes/modelInvocation.route.ts
src/routes/billingRecord.route.ts
src/routes/auth.route.ts

src/services/modelChannel.service.ts
src/services/model.service.ts
src/services/modelChannelBinding.service.ts
src/services/modelPrice.service.ts
src/services/skill.service.ts
src/services/userSkill.service.ts
src/services/userDefaultSkill.service.ts
src/services/conversationSkill.service.ts
src/services/plugin.service.ts
src/services/config.service.ts
src/services/generationJob.service.ts
src/services/asset.service.ts
src/services/conversationGroup.service.ts
src/services/modelInvocation.service.ts
src/services/billingRecord.service.ts
src/services/auth.service.ts

src/utils/maskSecret.ts
src/utils/cryptoSecret.ts
src/services/modelAdapters/
```

路由聚合仍放在：

```text
src/routes/index.ts
```

## 10. 验收标准

第一阶段完成后应满足：

- Prisma schema 包含第一阶段所需核心表和 enum。
- `bun run db:generate` 可以成功生成 Prisma Client。
- 支持 `accessToken + refreshToken` 登录、刷新和退出。
- 支持 `user_sessions` 记录登录设备，并可以撤销单个设备会话。
- 配置类接口只有管理员可以访问。
- 新增 CRUD API 可以正常创建、查询、更新、软删除资源。
- `configs` 支持 K-V 存储，前端读取时按 `PUBLIC`、`AUTHENTICATED`、`ADMIN` 过滤权限。
- `configs` 支持 `group`，SMTP、OSS/S3 等连接配置可以按 `email`、`oss` 分组管理。
- `generation_jobs` 记录 TTS、图片、视频等异步生成任务过程，第一阶段不实现队列执行器。
- `assets` 记录资源元数据，普通用户只能访问自己的资源。
- `user_skills` 记录用户自己的技能库。
- `user_default_skills` 记录用户新对话默认启用技能。
- `conversation_skills` 记录每个对话启用的技能，归档对话不能修改启用技能。
- `conversation_groups` 支持用户自定义分组和归档分组。
- `ARCHIVED` 会话不能继续创建消息或发起模型调用，移动到其他分组后需要恢复为 `ACTIVE` 才能继续。
- 列表接口默认不返回软删除数据。
- 渠道密钥加密入库，查询接口只返回脱敏值。
- 模型和渠道通过 `model_channel_bindings` 关联。
- 模型价格通过 `model_prices` 管理，支持模型默认价格和渠道特价。
- 普通用户只能访问自己的 `model_invocations`。
- 模型调用费用通过 `billing_records` 记录，普通用户只能查询自己的流水。
- 聊天分组、聊天会话、聊天消息和模型调用记录分别由 `conversation_groups`、`conversations`、`conversation_messages`、`model_invocations` 承担，关系明确。
- Redis 连接和 key 命名规范有预留，核心数据仍落 PostgreSQL。
- 关键 service 有测试覆盖。
- `bun test` 通过。
- README 或开发文档说明新增接口和数据库变更。

## 11. 第一阶段实施计划

第一阶段目标是完成 AI 平台后端底座，不接真实模型调用、不做真实扣费、不做真实对象存储上传。

### 11.1 开发批次

#### 批次 1：Prisma Schema 和基础枚举

目标：

- 按 `Enum 设计` 创建所有 Prisma enum。
- 按 `数据库设计` 创建第一阶段所有表。
- 建立必要的外键、唯一约束和索引。
- 执行 `bun run db:generate`，确保 Prisma Client 可生成。

验收：

- Prisma schema 能通过格式化和生成。
- 不写业务接口也能先完成数据结构验证。

#### 批次 2：Auth、用户会话和权限中间件

目标：

- 实现 `accessToken + refreshToken`。
- refresh token 绑定 `user_sessions`。
- 支持登录、刷新、退出、查看登录设备、撤销设备。
- 实现普通用户鉴权中间件和管理员鉴权中间件。

验收：

- 普通接口能获取当前用户。
- 管理员接口能限制 `role === ADMIN`。
- 撤销 session 后 refresh token 不再可用。

#### 批次 3：管理员配置底座

目标：

- 实现 `configs` 管理和前端读取。
- 实现 `model_channels`、`models`、`model_channel_bindings`、`model_prices` CRUD。
- 渠道密钥加密入库，接口只返回脱敏值。

验收：

- 管理员可维护模型、渠道、绑定和价格。
- 普通用户不能访问管理接口。
- `/api/configs` 能按 `PUBLIC`、`AUTHENTICATED`、`ADMIN` 过滤。

#### 批次 4：技能库和对话基础

目标：

- 实现系统技能 `skills` 管理。
- 实现用户技能库 `user_skills`。
- 实现用户默认技能 `user_default_skills`。
- 实现聊天分组 `conversation_groups`。
- 实现聊天会话 `conversations` 和聊天消息 `conversation_messages`。
- 创建新会话时按 `user_default_skills` 初始化 `conversation_skills`。

验收：

- 用户能维护自己的技能库和默认技能。
- 用户能创建分组和会话。
- 会话能启用或禁用技能。
- `ARCHIVED` 会话不能新增消息、修改技能或发起模型调用。

#### 批次 5：调用记录、任务、资源和计费流水

目标：

- 实现 `model_invocations` 基础记录和查询。
- 实现 `generation_jobs` 基础记录和查询。
- 实现 `assets` 元数据记录和查询。
- 实现 `billing_records` 查询和由调用流程生成的基础流水。

验收：

- 普通用户只能查询自己的记录、任务、资源和计费流水。
- 管理员可以按用户和状态筛选。
- 第一阶段只记录任务和资源元数据，不执行真实任务队列，不上传对象存储。
- 第一阶段只记录费用流水，不扣减余额。

#### 批次 6：Redis 预留和缓存边界

目标：

- 增加 Redis 配置读取和连接封装。
- 预留 session 缓存、token 黑名单、限流 key 规范。
- 不把核心业务数据只写入 Redis。

验收：

- Redis 不可用时，核心权限判断能回落 PostgreSQL。
- Redis key 前缀遵循 `myagent:*` 规范。

### 11.2 第一阶段必须完整实现

- Prisma schema、enum、索引和关联关系。
- 双 token 登录、刷新、退出。
- `user_sessions` 设备会话管理。
- 用户鉴权和管理员鉴权中间件。
- `configs` 前端读取和管理员管理。
- 模型、渠道、绑定、价格的管理员 CRUD。
- 用户技能库、默认技能、对话启用技能。
- 聊天分组、会话、消息基础 CRUD。
- 用户数据隔离。
- 关键 service 测试。

### 11.3 第一阶段只做基础能力

这些模块第一阶段只做建表、基础 CRUD 或基础查询，不实现完整业务闭环：

- `generation_jobs`：只记录任务，不执行队列。
- `assets`：只记录元数据，不上传 OSS/S3，不生成签名 URL。
- `billing_records`：只记录费用流水，不扣余额。
- Redis：只封装连接和 key 规范，不依赖 Redis 保存核心状态。
- `modelAdapters`：只定义接口边界，不接真实模型调用。

### 11.4 初始化规则

建议初始化：

- 创建第一个管理员账号，或提供脚本将指定用户提升为 `ADMIN`。
- 初始化基础 `configs`，例如 `site.name`、`feature.chat.enabled`、`oss.endpoint` 示例项。
- 新用户注册后自动创建一个 `conversation_groups.type = ARCHIVE` 的归档分组。
- 新用户注册后默认不启用任何技能，用户自行添加到 `user_skills`。
- 模型、渠道和价格不自动创建，由管理员在后台配置。

### 11.5 开发顺序建议

实际开发时按以下顺序提交更稳：

1. Prisma schema 和生成验证。
2. Auth 和权限中间件。
3. Admin configs/models/channels/prices。
4. Skills 和 conversations。
5. Invocations/jobs/assets/billing records。
6. Redis 预留。
7. README 和接口示例更新。

## 12. 暂不处理事项

以下事项不放在第一阶段：

- OAuth 登录。
- 多租户。
- 管理后台前端。
- 真实 AI 流式调用。
- TTS、图片、视频等资源的真实上传和对象存储 SDK 接入。
- 图片和视频生成任务队列执行器。
- 复杂 Agent 自动规划。
- 计费扣费。
- 渠道健康检查定时任务。
- skill-plugin 编排和执行。

这些能力需要在底座稳定后再逐步拆分设计和实现。
