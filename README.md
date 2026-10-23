# 学径

一个基于 Marble 开放知识图谱的学习工作台。探索多个学科的真实知识点，通过目标路线、AI 讲解、练习证据和复习记录，形成完整学习流程。

官网：<https://learnpath.guygubaby.top>；学习工作台：<https://learnpath.guygubaby.top/app>。前端、API、账号与学习数据部署在 Cloudflare Workers / D1 / R2。

## 已实现

- 独立的中英双语产品官网；点击“开始使用”进入学习工作台。官网采用 Cuberto 风格的留白、遮罩文字、错落作品列与白色页面转场，使用本项目自己的图形和演示素材。

- 初始内置 1,591 个知识点、3,225 条先修关系；运行时按上游持续同步，官网、地图与数据说明显示当前激活版本的实际数量。按学科、年龄、中英文关键词搜索，支持局部图、学科全景与可访问列表。
- 简体中文 / English 切换，语言偏好持久保存；内置知识点有完整中文翻译，同步时补齐新增或变更知识点的名称、说明、掌握标准和检查问题，英文原文保留。支持地理在内的九个学科。所有下拉框统一使用 Radix Select，支持键盘操作。
- Cloudflare Cron 每日北京时间 00:00 同步上游；通过 SHA-256、数据结构与无环校验后再激活 R2 快照，失败保留旧版本。
- Better Auth 邮箱密码注册、登录、退出、修改密码；D1 Cookie Session；家长管理多个学习档案。
- 根据必要先修关系生成目标路线；建议先修不阻止学习；掌握状态不会自动传递到其他知识点。
- AI SDK 接入自定义 OpenAI Chat Completions / Anthropic Messages 兼容接口，支持公网 HTTP / HTTPS Base URL、自定义密钥和模型名；支持流式对话、连接测试、跟随界面语言生成练习。输出预算为 128 × 1024（131,072）tokens，不再限制回答为 16,000 字符；长请求不设固定生成时长。模型达到自身输出上限时会显示续答提示。
- 设置页可获取或刷新服务商模型列表：沿配置的 Base URL 请求 `/models`（例如 `/v1/models`），支持已保存密钥、新密钥和 Anthropic 分页。选择模型后点击“保存配置”生效，列表不可用时仍能手动填写。
- 服务端判题，答案提交前不返回正确选项；幂等提交；家长观察记录；按证据更新掌握状态。
- 1、3、7、14、30 天复习安排、错题回顾、每日计划、真实学习报告和私有 R2 导出。
- API Key 通过 AES-GCM 加密且绑定账号；权限检查、同源请求校验、请求体限制、原生短时限流与日志脱敏。应用不设每日 AI 调用次数上限。

## 技术栈

React 19、TypeScript、TanStack Start / Router、TanStack Query v5、Vite 8、Tailwind CSS v4、source-owned shadcn/ui 组件、Lucide、Cytoscape.js、Zustand、React Hook Form、Zod、ky、ufo、dayjs、i18next / react-i18next。

Cloudflare Workers + Static Assets、D1 原生参数化 SQL、R2、Rate Limiting bindings。认证由 Better Auth 统一负责。没有 Prisma、PostgreSQL、Redis或独立 Hono 服务。

## 本地运行

需要 Node.js 24.11+ 和 pnpm。推荐使用 `.node-version` 中指定的版本。

1. 安装并创建本地密钥：

   ```sh
   pnpm install
   pnpm init:local
   ```

2. 启动 Workers 本地环境：

   ```sh
   pnpm dev
   ```

3. 在另一个终端应用本地迁移，然后打开 <http://127.0.0.1:3000>：

   ```sh
   pnpm db:local
   ```

`.dev.vars`、本地数据库、测试账号均被 Git 忽略。`init:local` 不会覆盖已有密钥。注册自己的家长账号后创建档案，在“AI 与账号设置”配置 API。未配置 AI 时，部分数学和科学知识点可使用内置入门练习；AI 讲解和其他知识点的出题需要有效接口。

对于 `opencode.ai` 接口，服务端会按其[客户端要求](https://opencode.ai/v2/docs/console/go/#where-can-i-use-it)发送应用标识和稳定的 `x-opencode-session`，覆盖模型列表、连接测试、导师对话和出题。模型会话标识按账号与对话范围生成摘要。

## 校验

```sh
pnpm check
# 以下命令需要 pnpm dev 已运行；只允许连接本机地址。
pnpm test:integration
```

领域测试遍历真实图谱的全部目标，检查先修顺序、重复题目不能误判掌握、复习间隔、API 地址和密钥隔离。协议测试使用模拟响应验证 AI SDK 的实际请求与流式解析，不消耗模型费用。

模型请求参数还会在本地 workerd 运行时校验，覆盖 Workers 与 Node 的 redirect 行为差异；重定向不会自动携带 API Key 跳转。

集成测试会在本地创建独立测试账号，验证账号隔离、会话、档案、目标、密钥隐藏、判题、重复提交、CSRF 与私有 R2 报告导出。它不会连接生产数据库。浏览器测试账号仅保存在被忽略的 `.data/` 中。

## Cloudflare 自动部署

代码仓库：[guygubaby/learnpath](https://github.com/guygubaby/learnpath)。现有 Worker 使用 Cloudflare Workers Builds 原生连接 GitHub；推送 `main` 会自动构建和发布，不依赖本机运行命令。

- 构建命令：`pnpm run build:ci`，包含绑定类型生成、TypeScript、全部测试与生产构建。
- 部署命令：`pnpm run deploy:ci`，先应用未执行的 D1 迁移，再上传已构建 Worker，沿用已存在的运行时 secrets。
- Node 版本由 `.node-version` 固定，pnpm 版本由 `packageManager` 固定。
- Build 变量：`APP_URL`、`CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_D1_DATABASE_ID`、`TAXONOMY_OWNER_ID`。这些是部署目标配置；不要把生产会话密钥或加密密钥放入仓库。
- `BETTER_AUTH_SECRET` 与 `APP_ENCRYPTION_KEY` 保留在 Worker 的 Runtime variables and secrets 中，CI 不复制或重建它们。当前只监听 `main`，未启用分支预览。

首次在其他 Cloudflare 账户初始化，或需要手动恢复部署时，可使用以下流程。项目继续使用锁定版本的 Cloudflare CLI `cf` 与 `cloudflare.config.ts`。

1. 完成 Cloudflare 登录：

   ```sh
   pnpm exec cf auth login
   pnpm exec cf auth whoami
   ```

2. 创建 D1 数据库并记下返回的 UUID：

   ```sh
   pnpm exec cf d1 create --name learnpath-db --primary-location-hint apac
   ```

3. 运行 `pnpm init:production`，在被忽略的 `.env.production` 填写：
   - `APP_URL`：实际公开域名；当前为 `https://learnpath.guygubaby.top`。
   - `CLOUDFLARE_D1_DATABASE_ID`：刚创建的数据库 UUID。
   - `TAXONOMY_OWNER_ID`：执行同步翻译的站点所有者账号 ID。定时任务复用此账号在设置中保存的加密模型配置，只发送公开知识点资料；没有变化时不会调用模型。
   - 另外两个密钥由初始化脚本自动生成，不会显示在终端。后续部署保留它们，尤其是加密密钥；替换它会使已有 API Key 无法解密。

4. 部署：

   ```sh
   pnpm run deploy
   ```

部署脚本先检查配置、运行类型检查/测试/生产构建、应用远程版本化迁移，再上传 Worker 和两个生产 secret。报告与知识图谱使用独立的私有 R2 bucket，由 cf 的 binding provisioning 创建或绑定。Cron 由同一次部署注册，不依赖本机或自建服务器。`APP_URL` 用于 Cookie、可信来源和服务端资源地址，必须与实际访问域名一致。远程迁移只会执行尚未应用的 SQL 文件；已应用文件的校验和变化会中止部署。

`cloudflare.config.ts` 的 `domains` 保存正式自定义域名，后续部署会保留绑定。迁移到其他域名时，同时更新这里和 `.env.production` 的 `APP_URL`；新域名需要在同一 Cloudflare 账户托管。生产密钥保存在被忽略的 `.env.production`，请妥善备份并在后续部署中保留。

这是托管应用；模型推理由你配置的 API 服务商提供。Cloudflare 与模型服务可能产生按量费用。本项目没有自动升级付费套餐。

## 数据来源与内容边界

- 上游：[withmarbleapp/os-taxonomy](https://github.com/withmarbleapp/os-taxonomy)。内置初始提交见 `src/data/source.json`；当前在线版本与同步状态见应用“数据与使用说明”及 `/api/taxonomy/status`。
- `/api/catalog` 提供当前激活的双语节点与先修关系；客户端定期刷新。`public/data/catalog.json` 是初始节点、边投影；教学研究分为 1,051 个独立文件，按知识点加载。`public/data/manifest.json` 是上游原始文件的清单，不是投影文件的校验和。
- 初始导入核对所有原始文件 SHA-256，运行上游完整校验与先修图无环校验。每日 Cron 将上游 main 解析为固定提交，校验文件字节数、SHA-256、结构、引用和无环性；教学研究流式处理。新增或变化知识点通过所配置模型补齐中文，并按原文指纹缓存。完整成功后才原子切换快照；失败可在次日复用已完成翻译。上游移除的知识点保留为历史项，学习记录不删除。
- 初始数据重建命令为 `pnpm data:sync`；不要在未同步更新对应中文资源时手动更换初始版本，完整性测试会阻止发布不匹配的数据。
- 原始资料为英语。`public/data/locales/zh-CN.json` 包含全部知识点元数据的 AI 辅助中文翻译和原文指纹；`src/locales/en.json` 包含界面英文资源。教学研究保留英文原文；历史对话、练习、昵称与家长记录保留生成或填写时的语言。未做全量人工翻译审校，也未对齐中国教材。
- 数学和科学有原始教学研究；研究由 Agent 编写，活动尚未经实证验证。AI 生成练习可能有错误，界面会标注来源，家长应复核有疑问的内容。
- “已掌握”是产品规则：最近 5 次作答至少覆盖 3 道不同题目，平均分不低于 80%，或有家长的具体观察记录；它不等同于标准化测验结论。

Marble Skill Taxonomy (v1) · © Generative Spark, Inc. (Marble) · <https://withmarble.com>。
数据库采用 ODbL 1.0，Marble 原创文本采用 CC BY-SA 4.0；第三方课程标准遵循各自上游条款。对应许可、引用与来源说明保留在 `public/licenses/`，应用“数据与使用说明”也提供入口。中文翻译遵循相应的署名和相同方式共享要求，数据许可不意味着应用代码自动采用同一许可。
