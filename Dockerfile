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

# 使用缓存加速安装
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# --- 阶段 2: 构建应用 ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 生成 Prisma Client (现在 builder 环境已包含 openssl)
RUN npx prisma generate

# 构建应用
RUN npm run build

# --- 阶段 3: 运行环境 ---
FROM base AS runner
WORKDIR /app

# 额外安装运行时需要的 FFmpeg
RUN apk add --no-cache ffmpeg

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 拷贝构建产物
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 由于 pnpm + standalone 模式下 Prisma 引擎可能不会被自动拷贝，手动拷贝
COPY --from=builder /app/node_modules/.prisma/client/libquery_engine-*.so.node ./node_modules/.prisma/client/

# 补全 Next.js 静态目录结构
RUN mkdir -p .next && mv static .next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
