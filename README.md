# 团队先锋 (Step Rally) - 大型团队竞技与拉练组队系统

面向企事业单位、学校、俱乐部大型团队体育赛事、拉练拓展与竞技活动的现代化组队报名与队长推选平台。支持 **Cloudflare Pages 纯 Serverless 零成本边缘部署** 与 **Docker 私有化容器部署** 双模式！

---

## ✨ 核心特性

- 🏃 **活动视觉与全景监控**：动感跑道等高线主题视觉，全员集结大屏进度条、组队率统计胶囊与全员满员礼花庆典动效。
- 📋 **Excel 花名册批量导入与姓名登录**：
  - 支持管理员一键下载 Excel 模板并批量导入参赛花名册（姓名、部门、手机、备注）；
  - 队员输入花名册录入的真实姓名即可快速登录，安全便捷，无需复杂账号体系；
  - 提供管理员专属密码登录后台管理通道。
- 🛡️ **动态自由战队体系**：
  - 打破队伍数量限制，支持管理员自由创建战队、编辑队名/口号/队标图标、解散战队；
  - 支持独立设定每支队伍的人数上限或全局批量调整，配备队伍合计人数硬上限保护。
- 👑 **队长民主推选机制**：
  - 队内队员每人拥有一票推选权，队内实时计票，最高票者当选队长并置顶展示；
  - 队长及管理员享有队伍信息个性化定制权限。
- 📊 **报表导出与管理**：
  - 支持一键导出多工作表 Excel（全员花名册、战队概况、待组队名册、免报人员明细）。
- ⚡ **Cloudflare Pages 原生支持**：
  - 前端静态 CDN + Pages Functions 边缘计算 + Cloudflare KV 边缘持久化，**零服务器成本、全球极速就近访问**！

---

## ⚡ 部署方式一：Cloudflare Pages 边缘部署（推荐，0 服务器费用）

只需在 Cloudflare 控制台点几下即可完成全栈部署：

### 步骤 1：导入 GitHub 仓库
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)，进入 **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**。
2. 选择本仓库 `step-rally` 并点击 **Begin setup**。

### 步骤 2：构建设置 (Build configuration)
- **Framework preset**：选择 `None` 或 `Vite`
- **Build command**：`npm run build:pages`
- **Build output directory**：`apps/web/dist`
- **Root directory**：留空（默认为仓库根目录）

### 步骤 3：配置 Cloudflare KV 持久化存储（核心）
1. 在 Cloudflare 控制台左侧菜单进入 **Workers & Pages** -> **KV**，点击 **Create a namespace**，名称填 `rally_kv`。
2. 返回刚创建的 Pages 项目，进入 **Settings** -> **Functions** -> **KV namespace bindings**，点击 **Add binding**：
   - **Variable name**：必须填 `RALLY_KV`
   - **KV namespace**：选择刚才创建的 `rally_kv`
3. 进入 **Settings** -> **Environment variables**，添加环境变量：
   - `ADMIN_PASSWORD`：自定义管理员密码（默认 `admin888`）
   - `SESSION_SECRET`：任意复杂随机字符串（用于签名 Session Cookie）
4. 保存后点击 **Deployments** -> **Retry deployment** 重新部署一次即可生效！

---

## 🐳 部署方式二：Docker 私有化容器部署

如果您有自己的 Linux 服务器并希望容器化自建：

```bash
# 1. 构建镜像
docker build -t step-rally:latest .

# 2. 启动容器（挂载本地数据目录）
docker run -d \
  -p 8095:8095 \
  -v $(pwd)/data:/app/data \
  -e ADMIN_PASSWORD=admin888 \
  --name step-rally \
  step-rally:latest
```

---

## 💻 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 启动前端 Vite 热更新
npm run dev

# 3. 启动传统 Node 后端（可选）
npm run api:dev

# 或使用 Wrangler 本地模拟 Pages 边缘环境
npx wrangler pages dev apps/web/dist
```

## ⚙️ 环境变量速查

| 变量名 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `RALLY_KV` | - | Cloudflare KV 命名空间绑定名称（Pages 必配） |
| `ADMIN_PASSWORD` | `admin888` | 管理员专属登入密码 |
| `SESSION_SECRET` | 随机字符串 | Session Cookie 加密密钥 |
| `PORT` | `8095` | 容器/本地 Node 服务端口 |
| `DATA_FILE` | `data/rally.json` | 容器/本地 Node 数据持久化路径 |
