#!/bin/sh
set -eu

project_name="ai-content-generator-e2e"

cleanup() {
  docker compose \
    -p "$project_name" \
    -f docker-compose.yml \
    -f docker-compose.e2e.yml \
    down --volumes --remove-orphans
}

trap cleanup EXIT INT TERM

S3_PUBLIC_URL="http://localhost:59000" docker compose \
  -p "$project_name" \
  -f docker-compose.yml \
  -f docker-compose.e2e.yml \
  up -d --build --wait api

DATABASE_URL="postgresql://postgres:postgres@localhost:55432/ai_content_generator" \
E2E_API_URL="http://localhost:3100" \
E2E_INDEPENDENCE_PHASE="accept" \
npx vitest run e2e/runtime-independence.e2e.test.ts --config vitest.e2e.config.ts

S3_PUBLIC_URL="http://localhost:59000" docker compose \
  -p "$project_name" \
  -f docker-compose.yml \
  -f docker-compose.e2e.yml \
  up -d --wait worker

docker compose \
  -p "$project_name" \
  -f docker-compose.yml \
  -f docker-compose.e2e.yml \
  stop api

DATABASE_URL="postgresql://postgres:postgres@localhost:55432/ai_content_generator" \
REDIS_URL="redis://localhost:56379" \
S3_ENDPOINT="http://localhost:59000" \
S3_PUBLIC_URL="http://localhost:59000" \
S3_REGION="us-east-1" \
S3_BUCKET="ai-content-generator" \
S3_ACCESS_KEY_ID="minioadmin" \
S3_SECRET_ACCESS_KEY="minioadmin" \
E2E_INDEPENDENCE_PHASE="process" \
npx vitest run e2e/runtime-independence.e2e.test.ts --config vitest.e2e.config.ts

S3_PUBLIC_URL="http://localhost:59000" docker compose \
  -p "$project_name" \
  -f docker-compose.yml \
  -f docker-compose.e2e.yml \
  up -d --wait api worker

DATABASE_URL="postgresql://postgres:postgres@localhost:55432/ai_content_generator" \
REDIS_URL="redis://localhost:56379" \
S3_ENDPOINT="http://localhost:59000" \
S3_PUBLIC_URL="http://localhost:59000" \
S3_REGION="us-east-1" \
S3_BUCKET="ai-content-generator" \
S3_ACCESS_KEY_ID="minioadmin" \
S3_SECRET_ACCESS_KEY="minioadmin" \
E2E_API_URL="http://localhost:3100" \
npx vitest run e2e/content-flow.e2e.test.ts --config vitest.e2e.config.ts
