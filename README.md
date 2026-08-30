# CloudFav · 云收藏夹

基于 **Cloudflare Pages + D1 + Workers AI + Passkey** 的多用户云书签收藏夹，功能与 Edge / Chrome 收藏夹类似，但数据保存在云端，可在任意设备上访问。

## ✨ 功能特性

- 🔖 **书签管理**：新建 / 编辑 / 删除书签，支持无限层级文件夹，拖拽排序、拖拽移动
- 📝 **简介自动获取**：新建书签时自动抓取网页标题与描述，可随时手动修改
- 🤖 **AI 生成介绍**：可一键调用 Cloudflare Workers AI 为书签撰写简介，并自由选择是否在卡片上展示（替代手动简介）
- 📁 **文件夹层级**：树形侧栏 + 面包屑导航，轻松整理收藏
- 🔍 **全局搜索**：按标题、链接、简介快速搜索
- 👥 **多用户**：每位用户拥有完全独立的数据空间
- 🔐 **多种登录方式**：支持 仅密码 / 仅通行密钥 / 密码 + 通行密钥双重认证（2FA 可选），并支持绑定 **TOTP 验证器应用**（如 Google Authenticator）作为第二因素，第二因素可任选通行密钥或动态验证码，可自由选择或组合
- 🔑 **密码找回**：绑定邮箱后可一键发送重置链接，重设密码
- 📥 **导入收藏夹**：直接导入 Chrome / Edge 导出的书签 HTML 文件，自动保留原有文件夹层级
- 🌓 **精美界面**：响应式设计，适配移动端与桌面端，支持明暗主题

## 🧱 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS |
| 后端 | Cloudflare Pages Functions（serverless 函数） |
| 数据库 | Cloudflare D1（SQLite） |
| AI | Cloudflare Workers AI（默认 `@cf/meta/llama-3.1-8b-instruct`） |
| 认证 | 密码（PBKDF2-SHA256）+ WebAuthn / Passkey（`@simplewebauthn`）+ 双重认证（通行密钥 / TOTP 验证码） |
| 邮件 | Resend API / MailChannels（用于密码找回，可选） |

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

适合将代码托管在 GitHub 并希望推送即部署。workflow 会把仓库 Secret `D1_DATABASE_ID` 写入 `wrangler.toml`，然后自动应用迁移、创建 Pages 项目并部署。

1. **创建 D1 数据库**（本地装有 [wrangler](https://developers.cloudflare.com/workers/wrangler/) 且已登录）：

   ```bash
   npx wrangler d1 create bookmarks-db
   ```

   记下输出的 `database_id`。

2. **推送代码到 GitHub** 仓库。

3. **配置 Actions Secrets**（仓库 → Settings → Secrets and variables → Actions）：
   - `CLOUDFLARE_API_TOKEN`：在 Cloudflare 控制台 → My Profile → API Tokens 创建，权限需包含 **Cloudflare Pages — Edit** 与 **D1 — Edit**
   - `CLOUDFLARE_ACCOUNT_ID`：Cloudflare 控制台首页右侧的 Account ID
   - `D1_DATABASE_ID`：第 1 步得到的数据库 ID

4. **启用 Workers AI**：在 Cloudflare 控制台 → **Workers AI** 页面开通（免费额度可用）。
   `wrangler.toml` 中已配置 `[[ai]] binding = "AI"`，部署时自动生效，无需额外操作。

5. **推送 / 手动触发 workflow**：`.github/workflows/deploy.yml` 会自动依次执行：
   构建 → 写入 D1 数据库 ID → 应用迁移建表 → 创建/复用 Pages 项目 → `wrangler pages deploy`。

   > `wrangler.toml` 中的 `database_id` 占位符会在 workflow 内被自动替换为 Secret 中的真实 ID，无需手动修改。

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
| `RESEND_API_KEY` | Resend 邮件服务 API Key（可选，用于发送找回密码邮件） | 无 |
| `MAIL_FROM` | 找回密码邮件的发件地址（可选） | `CloudFav <onboarding@resend.dev>` |

> 💡 密码找回邮件：配置 `RESEND_API_KEY` 后，重置链接会发送到用户绑定的邮箱；未配置时，重置链接会直接显示在页面上（仅适合本地 / 演示环境）。
> 配置方法见下文「[📧 找回密码邮件（Resend / MailChannels）](#📧-找回密码邮件resend--mailchannels)」。

## 📧 找回密码邮件（Resend / MailChannels）

忘记密码时需要向用户绑定邮箱发送重置链接，支持两种邮件服务（**二选一**，Resend 优先）。邮件变量与 D1 / AI 一样，配置在 **Pages 项目设置**中（两种部署方式最终都是同一个 Pages 项目），配置后需重新部署生效：

- **GitHub Actions 部署**：Cloudflare 控制台 → **Workers & Pages** → 选择项目 `cloud-fav` → **Settings → Environment variables** 添加（选择 **Production** 环境）
- **Dashboard 面板部署**：同上，项目 → Settings → Environment variables 添加

### 方式一：Resend（推荐）

1. 注册 [Resend](https://resend.com)，进入 **API Keys** 页面创建一个 API Key（形如 `re_xxxxxxxx`）。
2. （可选，推荐）在 **Domains** 添加并验证你的发件域名，然后在项目环境变量中设置：
   - `RESEND_API_KEY`：上一步的 API Key
   - `MAIL_FROM`：你的发件地址，如 `CloudFav <noreply@你的域名>`
   - 若跳过域名验证，可用默认发件人 `CloudFav <onboarding@resend.dev>`（**只能**发送给你 Resend 账号已验证的邮箱，适合测试，正式使用建议绑定域名）
3. 重新部署后即可发送找回密码邮件。

### 方式二：MailChannels（免费）

不依赖 Resend 账号，但需要一个自有域名并配置 DNS：

1. 将 `MAIL_FROM` 设为你的发件邮箱（如 `noreply@你的域名`），并在 Cloudflare DNS 中按 [MailChannels 官方文档](https://support.mailchannels.com/hc/en-us/articles/200262650-Send-email-from-Cloudflare-Workers) 配置发件域名的 **SPF / DKIM** 记录。
2. 在 Pages 项目环境变量中添加 `MAIL_FROM`。
3. 重新部署后生效。

> 📌 注意：`MAIL_FROM` 在 Resend 下可为 `姓名 <邮箱>` 格式；MailChannels 仅支持纯邮箱地址。

## 🔒 安全说明

- 所有 API 均需登录会话（HttpOnly Cookie + 30 天有效期）
- 用户数据通过 `user_id` 严格隔离，无法跨用户访问
- 网页标题抓取已屏蔽内网 / 本地地址，防止 SSRF
- 密码使用 **PBKDF2-SHA256 加盐哈希**存储，服务器不保存明文，也无法逆向还原
- 密码重置采用**一次性、30 分钟有效期**的随机令牌，令牌仅以哈希形式入库，用后即焚
- 至少保留一种登录方式：无法删除最后一个通行密钥（无密码用户）；双重认证为可选开关，开启后登录需「密码 + 通行密钥 / TOTP 验证码」共同验证，删除最后一个第二因素（通行密钥或验证器）会自动关闭 2FA
- Passkey 私钥保存在用户设备本地，服务器仅存公钥

## 📄 许可证

MIT
