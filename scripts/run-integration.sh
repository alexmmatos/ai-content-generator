#!/bin/sh
set -eu

project_name="ai-content-generator-integration"

cleanup() {
  docker compose \
    -p "$project_name" \
    -f docker-compose.yml \
    -f docker-compose.e2e.yml \
    down --volumes --remove-orphans
}

trap cleanup EXIT INT TERM

docker compose \
  -p "$project_name" \
  -f docker-compose.yml \
  -f docker-compose.e2e.yml \
  up -d --wait postgres redis

DATABASE_URL="postgresql://postgres:postgres@localhost:55432/ai_content_generator" \
REDIS_URL="redis://localhost:56379" \
S3_ENDPOINT="http://localhost:59000" \
S3_PUBLIC_URL="http://localhost:59000" \
S3_REGION="us-east-1" \
S3_BUCKET="ai-content-generator" \
S3_ACCESS_KEY_ID="minioadmin" \
S3_SECRET_ACCESS_KEY="minioadmin" \
npx prisma migrate deploy

DATABASE_URL="postgresql://postgres:postgres@localhost:55432/ai_content_generator" \
REDIS_URL="redis://localhost:56379" \
S3_ENDPOINT="http://localhost:59000" \
S3_PUBLIC_URL="http://localhost:59000" \
S3_REGION="us-east-1" \
S3_BUCKET="ai-content-generator" \
S3_ACCESS_KEY_ID="minioadmin" \
S3_SECRET_ACCESS_KEY="minioadmin" \
npx vitest run --config vitest.integration.config.ts
