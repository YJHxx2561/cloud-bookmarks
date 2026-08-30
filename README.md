# CloudFav · 云收藏夹

基于 **Cloudflare Pages + D1 + Workers AI + Passkey** 的多用户云书签收藏夹，功能与 Edge / Chrome 收藏夹类似，但数据保存在云端，可在任意设备上访问。

## ✨ 功能特性

- 🔖 **书签管理**：新建 / 编辑 / 删除书签，支持无限层级文件夹，拖拽排序、拖拽移动
- 📝 **简介自动获取**：新建书签时自动抓取网页标题与描述，可随时手动修改
- 🤖 **AI 生成介绍**：可一键调用 Cloudflare Workers AI 为书签撰写简介，并自由选择是否在卡片上展示（替代手动简介）
- 📁 **文件夹层级**：树形侧栏 + 面包屑导航，轻松整理收藏
- 🔍 **全局搜索**：按标题、链接、简介快速搜索
- 👥 **多用户**：每位用户拥有完全独立的数据空间
- 🔐 **Passkey 免密登录**：基于 WebAuthn，支持指纹 / 面容 / 安全密钥 / 系统密码，服务器不存储任何密码
- 📥 **导入收藏夹**：直接导入 Chrome / Edge 导出的书签 HTML 文件，自动保留原有文件夹层级
- 🌓 **精美界面**：响应式设计，适配移动端与桌面端，支持明暗主题

## 🧱 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS |
| 后端 | Cloudflare Pages Functions（serverless 函数） |
| 数据库 | Cloudflare D1（SQLite） |
| AI | Cloudflare Workers AI（默认 `@cf/meta/llama-3.1-8b-instruct`） |
| 认证 | WebAuthn / Passkey（`@simplewebauthn`） |

## 📁 项目结构

```
cloud-fav/
├── functions/              # Pages Functions（后端 API）
│   ├── _lib/               # 会话、WebAuthn 挑战、通用工具
│   └── api/                # 认证 / 书签 / 文件夹 / 抓取 / AI / 导入
├── migrations/             # D1 数据库迁移 SQL
├── src/                    # 前端源码
│   ├── components/         # UI 组件
│   ├── api.ts              # API 客户端
│   ├── webauthn.ts         # Passkey 封装
│   └── import.ts           # Chrome/Edge 书签 HTML 解析
├── wrangler.toml           # Cloudflare 配置（D1 / AI 绑定）
├── .github/workflows/      # GitHub Actions 部署
└── package.json
```

## 🚀 部署

项目支持两种部署方式，任选其一：

### 方式一：GitHub Actions 自动部署（推荐）

适合将代码托管在 GitHub 并希望推送即部署。**无需手动创建 D1 数据库**——workflow 会自动创建（或复用）数据库、写入 `database_id`、应用迁移、创建 Pages 项目并部署；已存在时自动跳过创建（即更新部署）。

1. **推送代码到 GitHub** 仓库。

2. **配置 Actions Secrets**（仓库 → Settings → Secrets and variables → Actions）：
   - `CLOUDFLARE_API_TOKEN`：在 Cloudflare 控制台 → My Profile → API Tokens 创建，权限需包含 **Cloudflare Pages — Edit** 与 **D1 — Edit**（workflow 会自动创建 D1 数据库）
   - `CLOUDFLARE_ACCOUNT_ID`：Cloudflare 控制台首页右侧的 Account ID

3. **启用 Workers AI**：在 Cloudflare 控制台 → **Workers AI** 页面开通（免费额度可用）。
   `wrangler.toml` 中已配置 `[[ai]] binding = "AI"`，部署时自动生效，无需额外操作。

4. **推送 / 手动触发 workflow**：`.github/workflows/deploy.yml` 会自动依次执行：
   构建 → 创建/复用 D1 数据库 → 应用迁移建表 → 创建/复用 Pages 项目 → `wrangler pages deploy`。

   > `wrangler.toml` 中的 `database_id` 占位符会在 workflow 内被自动替换为真实 ID，无需手动修改。

### 方式二：Cloudflare Dashboard 面板连接 GitHub 部署

适合不熟悉命令行、直接在面板操作的用户。

1. 将本项目推送到 GitHub 仓库。
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。
3. 授权并选择你的仓库，配置构建信息：
   - **Framework preset**：`Vite`
   - **Build command**：`npm run build`
   - **Build output directory**：`dist`
   - **Production branch**：`main`
4. 点击 **Save and Deploy**，等待首次构建完成。
5. 为项目添加 **Bindings**（项目 → Settings → Bindings）：
   - **D1 数据库**：变量名 `DB`，选择（或先创建）`bookmarks-db`
   - **Workers AI**：变量名 `AI`
   - **环境变量**：`AI_MODEL` = `@cf/meta/llama-3.1-8b-instruct`（可选，有默认值）
6. **初始化数据库**：在项目 **Console（控制台）** 中运行：
   ```bash
   npx wrangler d1 migrations apply bookmarks-db --remote
   ```
   （或使用 `npx wrangler d1 execute bookmarks-db --remote --file=migrations/0001_init.sql`）
7. 重新 Deploy 一次，即可通过 `https://<project>.pages.dev` 访问。

> 💡 通过 Dashboard 面板连接时，[wrangler.toml](wrangler.toml) 中的 `pages_build_output_dir`、D1/AI 绑定也会被 Pages 自动读取；若面板提示绑定冲突，以面板绑定为准即可。

## 🛠 本地开发

1. 安装依赖：

   ```bash
   npm install
   ```

2. 本地运行 D1 + Pages Functions（需已按上文创建并配置数据库）：

   ```bash
   npm run pages:dev
   ```

   > 此命令会先构建前端，再用 `wrangler pages dev dist` 在 `http://localhost:8788` 启动完整站点（含 Functions）。
   > 仅调试前端时可直接 `npm run dev`（Vite 将 `/api` 代理到 `localhost:8788`，请另开 `wrangler pages dev`）。

3. 类型检查与构建：

   ```bash
   npm run typecheck   # 前端 + Functions 类型检查
   npm run build       # 生产构建（输出到 dist/）
   ```

## 📥 导入 Chrome / Edge 收藏夹

1. 在 Chrome / Edge 中导出书签：
   - Chrome：书签管理器 → 右上角 `⋮` → **导出书签** → 保存 `.html` 文件
   - Edge：收藏夹 → `⋮` → **导出收藏夹** → 保存 `.html` 文件
2. 在 CloudFav 顶栏点击 **导入**，选择该 `.html` 文件。
3. 系统会解析其中的文件夹层级与书签，自动添加到当前所在文件夹下（可先在侧栏新建目标文件夹）。

## ⚙️ 环境变量

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `AI_MODEL` | Workers AI 文本模型名称 | `@cf/meta/llama-3.1-8b-instruct` |

## 🔒 安全说明

- 所有 API 均需登录会话（HttpOnly Cookie + 30 天有效期）
- 用户数据通过 `user_id` 严格隔离，无法跨用户访问
- 网页标题抓取已屏蔽内网 / 本地地址，防止 SSRF
- Passkey 私钥保存在用户设备本地，服务器仅存公钥

## 📄 许可证

MIT
