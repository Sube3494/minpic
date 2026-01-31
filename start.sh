#!/bin/sh

set -e

echo "[start.sh] Applying database migrations..."
if npx prisma migrate deploy; then
    echo "[start.sh] Migrations applied successfully."
else
    echo "[start.sh] WARNING: Migration failed. This might be due to connection issues or strict permissions."
    echo "[start.sh] Attempting to proceed with application startup..."
fi

echo "[start.sh] Starting application..."
exec node server.js
