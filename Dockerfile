FROM node:20-alpine AS base

# --- 阶段 0: 基础依赖 ---
# 将 OpenSSL 等基础库放入 base 阶段，确保所有后续阶段（builder/runner）都可用
ARG ALPINE_MIRROR=mirrors.aliyun.com
RUN sed -i "s/dl-cdn.alpinelinux.org/${ALPINE_MIRROR}/g" /etc/apk/repositories && \
    apk add --no-cache libc6-compat openssl

# --- 阶段 1: 依赖安装 ---
FROM base AS deps
ARG NPM_REGISTRY=https://registry.npmmirror.com

WORKDIR /app

# 安装 pnpm 并配置镜像源
RUN npm config set registry ${NPM_REGISTRY} && \
    npm install -g pnpm

# 仅拷贝依赖相关文件
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma

# 使用 --shamefully-hoist 确保 node_modules 结构扁平化，解决 Docker COPY 无法处理深层符号链接的问题
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --config.shamefully-hoist=true

# --- 阶段 2: 构建应用 ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 生成 Prisma Client
RUN npx prisma generate

# 构建应用
RUN npm run build

# --- 阶段 3: 运行环境 ---
FROM base AS runner
WORKDIR /app

ARG NPM_REGISTRY=https://registry.npmmirror.com

# 安装运行时需要的工具库：FFmpeg (视频) 和 Prisma (数据库同步)
RUN apk add --no-cache ffmpeg && \
    npm config set registry ${NPM_REGISTRY} && \
    npm install -g prisma@5.22.0

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 拷贝构建产物 (Standalone 模式)
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

# 此时静态资源已经通过 COPY 指令存放在 .next/static 和 public 目录中
USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 启动应用
# 由于应用内部已集成 ensureDatabaseExists 逻辑，支持自动建库、建表和初始化
# 这里的启动命令回归简洁，不再需要 shell 脚本前缀
# Copy startup script
COPY --from=builder /app/start.sh ./start.sh
RUN chmod +x ./start.sh

# 启动应用
USER nextjs
CMD ["./start.sh"]
