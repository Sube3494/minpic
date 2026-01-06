# MinPic 图床管理系统

MinPic 是一个现代化、高性能的图床管理系统，基于 Next.js 16 全栈框架构建，专为个人和团队设计。它提供了强大的文件管理、对象存储集成（MinIO）、团队协作以及精细的配额控制功能。

## ✨ 核心特性

- **🔐 身份认证与权限**
  - **GitHub OAuth 集成**：安全便捷的第三方登录。
  - **角色控制 (RBAC)**：支持系统管理员 (Admin) 和普通用户 (User) 角色。
  - **团队协作**：支持创建团队、邀请成员、设置成员角色（Owner/Admin/Member）。

- **🖼️ 强大的文件管理**
  - **多格式支持**：图片、视频、音频全覆盖。
  - **自动处理**：图片缩略图生成、视频封面提取、Pinyin 自动转换。
  - **大文件支持**：支持分片上传 (Multipart Upload) 和断点续传。
  - **文件同步**：支持从现有的 MinIO 存储桶反向同步文件元数据到数据库。

- **⚙️ 灵活的存储配置**
  - **多存储源**：支持配置多个 MinIO/S3 兼容存储源。
  - **配置加密**：敏感信息（AccessKey/SecretKey）使用 AES-256 加密存储。
  - **智能策略**：支持按需切换存储配置，且具备智能的文件归属识别防止冲突。

- **📊 配额与限制**
  - **双重配额**：支持基于**存储容量**和**文件数量**的双重配额限制。
  - **层级控制**：支持设置团队总配额和成员个人配额。
  - **实时监控**：上传时实时检查配额，支持超限预警。

- **🔗 短链服务**
  - **自动生成**：上传即生成短链。
  - **独立服务集成**：支持对接外部短链服务 API。

- **🎨 极致的 UI 体验**
  - **Shadcn/UI + Tailwind**：现代化的组件库。
  - **玻璃态设计**：精致的深色模式与磨砂玻璃质感。
  - **交动体验**：平滑的过渡动画与实时的 Toast 反馈。
  - **响应式布局**：完美适配桌面与移动端。

## 🚀 技术栈

- **框架**: Next.js 16 (App Router) + React 19
- **语言**: TypeScript
- **数据库**: Prisma CRM + SQLite (支持平滑迁移至 PostgreSQL/MySQL)
- **样式**: Tailwind CSS + Shadcn/UI
- **存储**: MinIO SDK (S3 Compatible)
- **缓存**: Redis (通过 ioRedis) - 生产环境推荐
- **认证**: NextAuth.js (Auth.js) v5
- **工具**: Zod (验证), Sharp (图片处理), Sonner (通知)

## 📦 快速开始

### 1. 环境准备

确保您的环境已安装：
- Node.js >= 18
- pnpm >= 8
- 一个可用的 MinIO 服务或 S3 兼容存储。

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env.local` 并填入您的配置：

```bash
cp .env.example .env.local
```

关键配置说明：
```env
# 数据库
DATABASE_URL="file:./dev.db"

# 认证 (GitHub OAuth)
AUTH_SECRET="your-random-secret-key"
GITHUB_ID="your-github-client-id"
GITHUB_SECRET="your-github-client-secret"
# 管理员邮箱 (必填)
# 对应登录后即获得 ADMIN 权限
ADMIN_EMAIL="your-admin@example.com"

# 系统配置密钥 (用于加密存储凭据)
CONFIG_ENCRYPTION_KEY="32-char-random-string"

# Redis 缓存 (可选，生产环境推荐)
# 格式: redis://:password@host:port/db
REDIS_URL="redis://:your_password@localhost:6379/0"
```

### 4. 初始化数据库

```bash
pnpm prisma generate
pnpm prisma db push
```

### 5. 启动服务

```bash
pnpm dev
```
访问 http://localhost:3000 即可开始使用。

## ⚙️ 系统管理功能

### 团队与配额
- **创建团队**：用户可创建团队并成为 Owner。
- **邀请机制**：通过邀请码邀请成员加入。
- **配额管理**：
  - 管理员可在后台设置全局默认配额。
  - 团队拥有者可分配团队内的存储/文件数配额给成员。

### 文件同步 (Impoter)
- 在设置页面配置好 MinIO 源后，可以使用“同步文件”功能。
- 系统会自动扫描 MinIO 桶中的文件，将元数据导入数据库，支持增量同步。

### 审计日志
- 管理员可在后台查看关键操作日志（用户登录、文件删除、配置变更等）。

## 📝 开发指南

### 目录结构

```
minpic-app/
├── prisma/                # 数据库 Schema & Migrations
├── src/
│   ├── app/               # Next.js App Router 页面与 API
│   │   ├── api/           # 后端 API 路由
│   │   ├── (main)/        # 主应用界面
│   │   ├── (auth)/        # 认证相关页面
│   │   └── admin/         # 管理员后台
│   ├── components/        # UI 组件
│   ├── hooks/             # 自定义 React Hooks
│   ├── lib/               # 工具函数与核心逻辑 (MinIO, Auth, Quota)
│   ├── types/             # TypeScript 类型定义
│   └── services/          # 前端服务层封装
└── public/                # 静态资源
```

## 📄 许可证

MIT License © 2026 MinPic Team
