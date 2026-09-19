#!/bin/sh
set -eu

echo "[hospital-hub] Applying Prisma schema..."
npm run db:push

echo "[hospital-hub] Starting API..."
exec node apps/api/dist/server.js
