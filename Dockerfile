FROM node:20-alpine AS base

# --- 阶段 1: 依赖安装 ---
FROM base AS deps
# 允许通过 --build-arg 传入镜像源，默认使用阿里云
ARG ALPINE_MIRROR=mirrors.aliyun.com
ARG NPM_REGISTRY=https://registry.npmmirror.com

RUN sed -i "s/dl-cdn.alpinelinux.org/${ALPINE_MIRROR}/g" /etc/apk/repositories && \
    apk add --no-cache libc6-compat openssl

WORKDIR /app

# 安装 pnpm 并配置镜像源
RUN npm config set registry ${NPM_REGISTRY} && \
    npm install -g pnpm

# 仅拷贝依赖相关文件，最大化利用 layer 缓存
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma

# 使用 Docker BuildKit 的 mount 功能挂载 pnpm store 缓存
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

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

ARG ALPINE_MIRROR=mirrors.aliyun.com
RUN sed -i "s/dl-cdn.alpinelinux.org/${ALPINE_MIRROR}/g" /etc/apk/repositories && \
    apk add --no-cache openssl ffmpeg

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 拷贝构建产物 (Next.js standalone 模式)
# Standalone 模式需要将 public 和 static 拷贝到指定位置以供 node 服务使用
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 由于 standalone 并不包含 .next 目录（除了 server.js 本身），
# 我们需要确保 static 资源在正确的位置
RUN mkdir -p .next && mv static .next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
