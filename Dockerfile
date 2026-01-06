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

# 归集运行时需要的工具 (Prisma CLI 和引擎)，防止 pnpm 符号链接在跨阶段拷贝时丢失
RUN mkdir -p /app/runtime-tools/bin && \
    cp -r node_modules/prisma /app/runtime-tools/ && \
    cp -r node_modules/@prisma /app/runtime-tools/ && \
    (cp -r node_modules/.prisma /app/runtime-tools/ || echo "No .prisma found") && \
    cp node_modules/.bin/prisma /app/runtime-tools/bin/prisma

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

# 拷贝构建产物 (Standalone 模式)
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

# 拷贝归集的 Prisma 工具链到 node_modules
# 这确保了运行时可以使用 ./node_modules/.bin/prisma 进行离线同步
COPY --from=builder /app/runtime-tools/ ./node_modules/

# 修正 Next.js 静态目录结构：在 standalone 模式下，static 应该在 .next 文件夹内
RUN mkdir -p .next && mv static .next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 运行容器时自动同步数据库结构 (使用本地工具链，无需联网)
CMD ["sh", "-c", "./node_modules/.bin/prisma db push --skip-generate && node server.js"]
