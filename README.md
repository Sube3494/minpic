# MinPic 图床管理系统

现代化、高质感的图床管理系统，基于 Next.js 15 + MinIO + 短链服务构建。

## ✨ 特性

- 🖼️ **文件管理** - 支持图片、视频、音频上传和管理
- 🔗 **短链集成** - 自动生成文件访问短链
- ⚙️ **配置管理** - 支持多个 MinIO 配置切换
- 📊 **统计分析** - 可视化数据展示
- 🎨 **现代UI** - 玻璃态深色主题，流畅动画

## 🚀 技术栈

- **前端框架**: Next.js 15 + React 19 + TypeScript
- **UI组件**: shadcn/ui + Tailwind CSS
- **数据库**: Prisma 5 + SQLite
- **对象存储**: MinIO SDK
- **图片处理**: Sharp
- **状态管理**: Zustand

## 📦 安装

```bash
# 安装依赖
pnpm install

# 初始化数据库
pnpm prisma generate
pnpm prisma db push

# 启动开发服务器
pnpm dev
```

访问 http://localhost:3000

## ⚙️ 配置

### 环境变量

创建 `.env.local` 文件：

```env
DATABASE_URL="file:./dev.db"
```

### MinIO 配置

在应用的设置页面配置您的 MinIO 服务：

- **Endpoint**: MinIO 服务器地址（如 `localhost`）
- **Port**: 端口号（默认 `9000`）
- **Access Key**: MinIO 访问密钥
- **Secret Key**: MinIO 秘密密钥
- **Bucket**: 存储桶名称
- **Use SSL**: 是否使用 HTTPS

### 短链服务配置

配置您的短链服务（如 `https://github.com/Sube3494/shortlinks`）：

- **API URL**: 短链服务 API 地址
- **API Key**: API 密钥
- **Auto Generate**: 是否自动为上传的文件生成短链

## 📖 API 文档

### 配置管理

- `GET /api/config/minio` - 获取 MinIO 配置
- `POST /api/config/minio` - 保存 MinIO 配置
- `GET /api/config/shortlink` - 获取短链配置
- `POST /api/config/shortlink` - 保存短链配置
- `POST /api/config/test` - 测试配置连接

### 文件管理

- `POST /api/files` - 上传文件
- `GET /api/files` - 获取文件列表
- `GET /api/files/[id]` - 获取文件详情
- `DELETE /api/files/[id]` - 删除文件
- `PUT /api/files/[id]` - 更新文件元数据
- `GET /api/files/[id]/download` - 下载文件

### 短链管理

- `POST /api/shortlinks` - 为文件创建短链
- `GET /api/shortlinks` - 获取所有短链

### 统计信息

- `GET /api/stats` - 获取统计数据

## 📁 项目结构

```
minpic-app/
├── prisma/
│   └── schema.prisma          # 数据库模型
├── src/
│   ├── app/
│   │   ├── api/               # API Routes
│   │   │   ├── config/        # 配置相关 API
│   │   │   ├── files/         # 文件管理 API
│   │   │   ├── shortlinks/    # 短链管理 API
│   │   │   └── stats/         # 统计 API
│   │   ├── globals.css        # 全局样式（玻璃态主题）
│   │   └── page.tsx           # 首页
│   ├── components/
│   │   └── ui/                # shadcn/ui 组件
│   └── lib/
│       ├── prisma.ts          # Prisma 客户端
│       ├── minio.ts           # MinIO 服务
│       ├── shortlink.ts       # 短链服务
│       └── image-utils.ts     # 图片处理工具
└── package.json
```

## 🎯 功能特性

### 文件上传

- 支持拖拽上传
- 多文件批量上传
- 自动生成缩略图（图片）
- 支持的文件类型：
  - 图片：JPEG, PNG, GIF, WebP, SVG
  - 视频：MP4, WebM, MOV, AVI, MKV
  - 音频：MP3, WAV, OGG, M4A, FLAC

### 短链生成

- 上传后自动生成短链（可配置）
- 支持自定义短码
- 一键复制短链

### 配置管理

- 支持多个 MinIO 配置
- 配置测试功能
- 配置持久化存储

## 🎨 UI 设计

- **玻璃态效果** - 半透明背景 + 模糊效果
- **深色主题** - 紫蓝渐变配色
- **流畅动画** - 悬停效果和过渡动画
- **响应式布局** - 支持桌面和移动端

## 🔧 开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start

# Prisma 相关
pnpm prisma studio        # 打开数据库管理界面
pnpm prisma generate      # 生成 Prisma Client
pnpm prisma db push       # 同步数据库结构
```

## 📝 待完成功能

- [ ] 完整的前端页面（文件管理、配置、统计）
- [ ] 拖拽上传组件
- [ ] 图片预览和视频播放器
- [ ] 批量操作功能
- [ ] 文件搜索和筛选
- [ ] Docker 部署配置
- [ ] 用户认证系统（可选）

## 📄 许可证

MIT
