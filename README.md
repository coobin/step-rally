# 🏃‍♂️ StepRally / 健步出征 · 企业运动拉练与组队推选平台

<p align="center">
  <img src="https://img.shields.io/badge/Vue-3.x-42b883?style=flat-square&logo=vuedotjs" alt="Vue 3" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.x-38bdf8?style=flat-square&logo=tailwindcss" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Node.js->=20-339933?style=flat-square&logo=nodedotjs" alt="Node.js" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ed?style=flat-square&logo=docker" alt="Docker" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="License" />
</p>

> **StepRally** 是一款专为企业团建拉练、公益健步走、毅行挑战等集体活动量身打造的**全员组队报名与队长推选协作系统**。
> 融入高燃运动竞技与赛级美学，深度整合企业级 **OIDC 单点登录** 与 **LDAP 在职名册同步**，支持队内民主投票推选领跑队长、容量超额锁定、自由换队及管理员名册导出。

---

## 🌟 核心功能特性

### 1. 🚩 智能战队编组与满员锁定
- **精准容量控制**：支持自定义战队数量与每队人数上限（默认 10 支队伍，每队严格限额 15 人，超额实时锁定）；
- **灵活自由流转**：一人一队，支持一键退队或直接跨队更换，队伍余位与集结进度实时联动更新。

### 2. 👑 队内民主投票推举领跑队长
- **一人一票推选制**：只有本队正式入列的队员具备投票与被选举资格，支持随时修改选票；
- **实时竞选看板**：实时柱状得票统计，最高票自动加冕「👑 领跑队长」专属高亮徽章与管理标识。

### 3. 👟 LDAP / Active Directory 企业名册集成
- **直连员工目录**：自动同步企业 LDAP 实时在职员工名册，自动清洗系统账号与映射部门；
- **待整装战友透视**：右侧看板实时呈现未报名的同事，支持按姓名、拼音、工号、部门即时搜索，支持已入队成员一键邀入本队。

### 4. 🔐 现代统一身份认证（OIDC + Mock 双模式）
- **OIDC 单点登录**：无缝对接企业级 Authelia、Keycloak、Casdoor、Okta 等身份提供商，未登录自动 302 重定向；
- **免依赖本地演示**：内置 Mock 快速体验模式（`?mock=1`），开箱即用，无需外部复杂依赖即可完整体验全流程。

### 5. 📊 权限分级与多维 Excel 花名册导出
- **管理员专享权限**：顶部「📊 导出名册」按钮仅对管理员开放，后端接口强制拦截越权下载；
- **多工作表报表**：自动导出包含《全员报名花名册》、《各小队概况》与《待组队同事名单》3个 Sheet 的 Excel 文件。

### 6. 🎨 赛级运动竞技美学设计
- **运动跑道与等高线微光背景**：跑道流线与等高线轨迹穿插，营造鲜明的拉练出征氛围；
- **里程碑全员集结走廊**：直观展示 `0 KM 起点` ➔ `15 KM 半程` ➔ `29.4 KM 会师` 集结进度；
- **赛车/球衣号码布（Jersey Bib）**：每支小队拥有专属战队号码布、红金动态速度带与跑道斜纹进度槽。

---

## 🛠️ 技术架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      Client Layer (Browser)                     │
│    Vue 3 (Composition API) + TypeScript + Tailwind CSS 3.x      │
└────────────────┬───────────────────────────────┬────────────────┘
                 │ HTTP / REST                   │ Static Assets
┌────────────────▼───────────────────────────────▼────────────────┐
│                   Backend Layer (Node.js 20+)                   │
│   Native HTTP Server + openid-client (OIDC) + ldapts (LDAP)     │
└────────────────┬───────────────────────────────┬────────────────┘
                 │                               │
┌────────────────▼──────────────┐ ┌──────────────▼────────────────┐
│   Corporate LDAP / AD Server  │ │   OIDC Provider (Authelia)   │
│   (ldap.example.com / Directory) │ │   (auth.example.com / SSO)   │
└───────────────────────────────┘ └───────────────────────────────┘
```

- **前端架构**：Vue 3 + Vite + TypeScript + Tailwind CSS + canvas-confetti
- **后端架构**：Node.js 20+ 原生轻量 HTTP 路由引擎 + ldapts + exceljs
- **存储方案**：原子写入的文件型持久化存储（`rally.json`），免额外数据库部署，高可靠免运维。

---

## 🚀 快速上手与部署

### 方式一：Docker Compose 一键启动（生产推荐）

1. **克隆项目到本地**：
   ```bash
   git clone https://github.com/your-username/step-rally.git
   cd step-rally
   ```

2. **配置环境变量**：
   ```bash
   cp deploy/.env.example deploy/.env
   vim deploy/.env # 按需修改 OIDC、LDAP 和管理员名单
   ```

3. **启动容器**：
   ```bash
   cd deploy
   docker compose up -d --build
   ```

4. 访问服务：打开浏览器访问 `http://localhost:8095`。

---

### 方式二：本地源码开发调试

本项目使用 NPM Workspaces 单体多包架构：

1. **安装依赖**：
   ```bash
   npm install
   ```

2. **启动本地开发模式**：
   ```bash
   # 终端 1：启动前端 Vite 调试服务器 (默认端口 5173，自动反代后端)
   npm run dev

   # 终端 2：启动后端 API 服务 (端口 8095)
   npm run api:dev
   ```

3. **构建生产版本**：
   ```bash
   npm run build
   ```

---

## ⚙️ 环境变量配置表

| 变量名 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `PORT` | `8095` | 服务监听端口 |
| `AUTH_MODE` | `all` | 认证模式：`all`（支持 OIDC 与 Mock）/ `oidc` / `mock` |
| `OIDC_ISSUER` | - | OIDC 发行方端点（如 `https://auth.example.com`） |
| `OIDC_CLIENT_ID` | `walk-rally` | OIDC 客户端 ID |
| `OIDC_CLIENT_SECRET` | - | OIDC 客户端通信密钥 |
| `OIDC_REDIRECT_URI` | - | OIDC 回调地址（如 `https://run.example.com/api/v1/auth/oidc/callback`） |
| `SESSION_SECRET` | - | 会话 Cookie 加密验签密钥（生产环境必须修改） |
| `ADMIN_USERNAMES` | `admin` | 管理员用户名清单，多个使用英文逗号分隔 |
| `LDAP_URI` | - | LDAP 服务地址（选填，如 `ldap://ldap.example.com:389`，留空不开启） |
| `LDAP_BASE_DN` | `dc=example,dc=com` | LDAP 根基准 DN |
| `LDAP_BIND_DN` | - | LDAP 认证管理员 DN |
| `LDAP_BIND_PASSWORD` | - | LDAP 认证管理员密码 |

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 协议开源。欢迎提交 Issue 与 Pull Request！
