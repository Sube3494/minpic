#!/bin/sh

set -e

echo "[start.sh] Syncing database schema (db push)..."
# 使用 db push 替代 migrate deploy，以兼容通过 db push 创建的存量数据库
# 这避免了 "P3005: The database schema is not empty" 错误
if npx prisma db push; then
    echo "[start.sh] Database schema synced successfully."
else
    echo "[start.sh] WARNING: Schema sync failed. Please check connection and permissions."
    echo "[start.sh] Attempting to proceed with application startup..."
fi

echo "[start.sh] Starting application..."
exec node server.js
