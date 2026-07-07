#!/bin/bash

set -euo pipefail

FRONTEND_DIR="frontend"
BACKEND_DIR="backend"
OUTPUT_DIR="agentRagQuickDeploy"
ARCHIVE_NAME="${OUTPUT_DIR}.tar.gz"

print_step() {
  echo ""
  echo "============================"
  echo " $1"
  echo "============================"
}

print_step "开始构建 Agent RAG 快速部署包"

############################
# 0. 清理输出目录
############################
echo "[0/4] 清理输出目录..."
mkdir -p "$OUTPUT_DIR"
find "$OUTPUT_DIR" -mindepth 1 \
  ! -name '.env.docker' \
  -exec rm -rf {} +

############################
# 1. 构建前端
############################
echo "[1/4] 构建前端..."
pushd "$FRONTEND_DIR" >/dev/null
bun install --frozen-lockfile
VITE_API_BASE_URL="${VITE_API_BASE_URL:-/api}" bun run build
popd >/dev/null

mkdir -p "$OUTPUT_DIR/public"
cp -R "$FRONTEND_DIR/dist/"* "$OUTPUT_DIR/public/"

############################
# 2. 构建后端
############################
echo "[2/4] 构建后端..."
pushd "$BACKEND_DIR" >/dev/null
bun install --frozen-lockfile
bun run db:generate
bun run build:fc
popd >/dev/null

cp "$BACKEND_DIR/package.json" "$OUTPUT_DIR/"
cp "$BACKEND_DIR/bun.lock" "$OUTPUT_DIR/"
cp "$BACKEND_DIR/prisma.config.ts" "$OUTPUT_DIR/"
cp "$BACKEND_DIR/tsconfig.json" "$OUTPUT_DIR/"
cp -R "$BACKEND_DIR/dist" "$OUTPUT_DIR/dist"
cp -R "$BACKEND_DIR/prisma" "$OUTPUT_DIR/prisma"

############################
# 3. 写入快速部署 Docker 文件
############################
echo "[3/4] 写入 Docker 快速部署文件..."
cat > "$OUTPUT_DIR/Dockerfile" <<'EOF'
FROM oven/bun:1.3.14-slim

WORKDIR /app
ENV NODE_ENV=production
ENV STATIC_ROOT=/app/public
# Prisma 7 loads prisma.config.ts during generate and requires DATABASE_URL.
# Runtime DATABASE_URL is injected by docker-compose or the hosting platform.
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/agent_rag

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
RUN bun run db:generate

COPY dist ./dist
COPY public ./public

EXPOSE 9889

CMD ["sh", "-c", "bunx --bun prisma migrate deploy && bun dist/index.js"]
EOF

cat > "$OUTPUT_DIR/docker-compose.yml" <<'EOF'
services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: agent-rag-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-agent-rag}
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-root123456}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}']
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile
    image: agent-rag-quick-deploy:latest
    container_name: agent-rag-app
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - '${PORT:-9889}:9889'
    environment:
      HOST: 0.0.0.0
      PORT: 9889
      STATIC_ROOT: /app/public
      DATABASE_URL: ${DATABASE_URL:-postgres://postgres:root123456@postgres:5432/agent-rag}
      ADMIN_API_KEY: ${ADMIN_API_KEY:-change-me-admin-key}
      OPENAI_CHAT_API_KEY: ${OPENAI_CHAT_API_KEY:-}
      OPENAI_CHAT_BASE_URL: ${OPENAI_CHAT_BASE_URL:-https://api.openai.com/v1}
      OPENAI_CHAT_MODEL: ${OPENAI_CHAT_MODEL:-}
      OPENAI_EMBEDDING_API_KEY: ${OPENAI_EMBEDDING_API_KEY:-}
      OPENAI_EMBEDDING_BASE_URL: ${OPENAI_EMBEDDING_BASE_URL:-https://api.openai.com/v1}
      OPENAI_EMBEDDING_MODEL: ${OPENAI_EMBEDDING_MODEL:-text-embedding-3-small}
      RAG_CHUNK_SIZE: ${RAG_CHUNK_SIZE:-800}
      RAG_CHUNK_OVERLAP: ${RAG_CHUNK_OVERLAP:-120}
      RAG_TOP_K: ${RAG_TOP_K:-5}
    healthcheck:
      test: ['CMD-SHELL', 'bun -e "const r=await fetch(\"http://127.0.0.1:9889/health\"); process.exit(r.ok?0:1)"']
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s

volumes:
  postgres-data:
EOF

cat > "$OUTPUT_DIR/.env.docker.example" <<'EOF'
# Agent RAG quick deploy
PORT=9889

# PostgreSQL service created by docker-compose.yml
POSTGRES_DB=agent-rag
POSTGRES_USER=postgres
POSTGRES_PASSWORD=root123456

# Backend database URL used by the app container. Use postgres as host for the compose service.
DATABASE_URL=postgres://postgres:root123456@postgres:5432/agent-rag

# Backend admin API key. Change this before exposing the service.
ADMIN_API_KEY=change-me-admin-key

# OpenAI-compatible chat provider
OPENAI_CHAT_API_KEY=
OPENAI_CHAT_BASE_URL=https://api.openai.com/v1
OPENAI_CHAT_MODEL=

# OpenAI-compatible embedding provider
OPENAI_EMBEDDING_API_KEY=
OPENAI_EMBEDDING_BASE_URL=https://api.openai.com/v1
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# RAG defaults
RAG_CHUNK_SIZE=800
RAG_CHUNK_OVERLAP=120
RAG_TOP_K=5
EOF

cat > "$OUTPUT_DIR/README.md" <<'EOF'
# Agent RAG Quick Deploy

这个目录已经包含后端运行文件、Prisma 迁移、前端静态资源和 Docker 部署文件。

## 启动

```bash
cp .env.docker.example .env.docker
# 修改 .env.docker 中的 DATABASE_URL、POSTGRES_PASSWORD、ADMIN_API_KEY 和模型配置
docker compose --env-file .env.docker up -d --build
```

## 访问

- 前端控制台：<http://localhost:9889/>
- 健康检查：<http://localhost:9889/health>
- API 前缀：<http://localhost:9889/api>

## 常用命令

```bash
docker compose --env-file .env.docker logs -f app
docker compose --env-file .env.docker restart app
docker compose --env-file .env.docker down
```

清理数据库卷：

```bash
docker compose --env-file .env.docker down -v
```
EOF

############################
# 4. 打包压缩文件
############################
echo "[4/4] 生成压缩包..."
rm -f "$ARCHIVE_NAME"
tar -czf "$ARCHIVE_NAME" "$OUTPUT_DIR"

print_step "构建完成 ✅"
echo "输出目录: $OUTPUT_DIR/"
echo "压缩包: $ARCHIVE_NAME"
echo ""
echo "快速启动:"
echo "  cd $OUTPUT_DIR"
echo "  cp .env.docker.example .env.docker"
echo "  docker compose --env-file .env.docker up -d --build"
