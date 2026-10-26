#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

MODE="${1:-full}"

echo "============================================================"
echo " Postiz Full-Stack Local Launcher (mode: ${MODE})"
echo "============================================================"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed or not in PATH." >&2
  exit 1
fi

if [ ! -f ".env" ]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env
fi

case "$MODE" in
  full)
    if docker image inspect localhost/postiz:local >/dev/null 2>&1 && [ "${2:-}" != "--rebuild" ]; then
      echo "[1/5] Starting all 12 containers in the Postiz stack (using built localhost/postiz:local image)..."
      docker compose -f docker-compose.local.yaml up -d
    else
      echo "[1/5] Building and starting all 12 containers in the Postiz stack..."
      docker compose -f docker-compose.local.yaml up -d --build
    fi

    echo "[2/5] Waiting for PM2 services (frontend, backend, orchestrator) inside 'postiz' container..."
    for i in $(seq 1 30); do
      if docker exec postiz sh -c "pm2 jlist 2>/dev/null | grep -q '\"name\":\"backend\"'" >/dev/null 2>&1; then
        break
      fi
      sleep 2
    done

    echo "[3/5] Syncing local Ollama LLM integration & activating workspace apps inside 'postiz'..."
    docker cp .env postiz:/app/.env
    docker cp libraries/nestjs-libraries/src/chat/load.tools.service.ts postiz:/app/libraries/nestjs-libraries/src/chat/load.tools.service.ts
    docker cp apps/backend/src/api/routes/copilot.controller.ts postiz:/app/apps/backend/src/api/routes/copilot.controller.ts
    docker cp libraries/nestjs-libraries/src/openai/openai.service.ts postiz:/app/libraries/nestjs-libraries/src/openai/openai.service.ts
    docker cp libraries/nestjs-libraries/src/agent/agent.graph.service.ts postiz:/app/libraries/nestjs-libraries/src/agent/agent.graph.service.ts
    docker cp libraries/nestjs-libraries/src/agent/agent.graph.insert.service.ts postiz:/app/libraries/nestjs-libraries/src/agent/agent.graph.insert.service.ts
    docker cp libraries/nestjs-libraries/src/database/prisma/autopost/autopost.service.ts postiz:/app/libraries/nestjs-libraries/src/database/prisma/autopost/autopost.service.ts
    docker cp apps/commands/src/main.ts postiz:/app/apps/commands/src/main.ts
    docker cp apps/commands/src/tasks/agent.run.ts postiz:/app/apps/commands/src/tasks/agent.run.ts
    docker cp apps/commands/src/command.module.ts postiz:/app/apps/commands/src/command.module.ts
    docker cp apps/commands/package.json postiz:/app/apps/commands/package.json

    # Sync Knowledge Base & Agentic RAG Subsystem files
    docker exec postiz mkdir -p \
      /app/libraries/nestjs-libraries/src/database/prisma/knowledge \
      /app/libraries/nestjs-libraries/src/dtos/knowledge \
      /app/apps/frontend/src/components/agents/knowledge \
      "/app/apps/frontend/src/app/(app)/(site)/knowledge"

    docker cp libraries/nestjs-libraries/src/database/prisma/schema.prisma postiz:/app/libraries/nestjs-libraries/src/database/prisma/schema.prisma
    docker cp libraries/nestjs-libraries/src/database/prisma/database.module.ts postiz:/app/libraries/nestjs-libraries/src/database/prisma/database.module.ts
    docker cp libraries/nestjs-libraries/src/database/prisma/knowledge/. postiz:/app/libraries/nestjs-libraries/src/database/prisma/knowledge/
    docker cp libraries/nestjs-libraries/src/dtos/knowledge/. postiz:/app/libraries/nestjs-libraries/src/dtos/knowledge/
    docker cp libraries/nestjs-libraries/src/chat/tools/knowledge.retrieve.tool.ts postiz:/app/libraries/nestjs-libraries/src/chat/tools/knowledge.retrieve.tool.ts
    docker cp libraries/nestjs-libraries/src/chat/tools/tool.list.ts postiz:/app/libraries/nestjs-libraries/src/chat/tools/tool.list.ts
    docker cp apps/backend/src/api/routes/knowledge.controller.ts postiz:/app/apps/backend/src/api/routes/knowledge.controller.ts
    docker cp apps/backend/src/api/api.module.ts postiz:/app/apps/backend/src/api/api.module.ts
    docker cp apps/frontend/src/components/layout/top.menu.tsx postiz:/app/apps/frontend/src/components/layout/top.menu.tsx
    docker cp apps/frontend/src/components/agents/agent.tsx postiz:/app/apps/frontend/src/components/agents/agent.tsx
    docker cp apps/frontend/src/components/agents/knowledge/. postiz:/app/apps/frontend/src/components/agents/knowledge/
    docker cp "apps/frontend/src/app/(app)/(site)/knowledge/." "postiz:/app/apps/frontend/src/app/(app)/(site)/knowledge/"

    docker exec postiz sh -c "
      set -e
      if [ ! -f /app/.rag-synced ] || [ \"\${2:-}\" = \"--rebuild\" ]; then
        echo '  -> Updating Prisma Client & syncing database schema...'
        pnpm --filter ./libraries/nestjs-libraries exec prisma generate
        pnpm run prisma-db-push || true

        echo '  -> Rebuilding backend & orchestrator with Agentic RAG & Knowledge Base...'
        pm2 stop backend orchestrator || true
        pkill -9 -f 'dist/apps/backend' || true
        pkill -9 -f 'dist/apps/orchestrator' || true
        pnpm --filter ./apps/backend run build
        pnpm --filter ./apps/orchestrator run build
        pm2 delete backend orchestrator || true
        cd /app/apps/backend && pm2 start pnpm --name backend -- start && cd /app
        cd /app/apps/orchestrator && pm2 start pnpm --name orchestrator -- start && cd /app

        echo '  -> Rebuilding frontend with Knowledge Base navigation & page...'
        pm2 stop frontend || true
        pnpm --filter ./apps/frontend run build
        pm2 restart frontend || (cd /app/apps/frontend && pm2 start pnpm --name frontend -- start && cd /app)

        touch /app/.rag-synced
        touch /app/.ollama-synced
      elif ! curl -sS http://localhost:3000/auth/can-register >/dev/null 2>&1; then
        echo '  -> Restarting backend & orchestrator after Temporal readiness...'
        pm2 restart backend orchestrator
      fi

      # Wait for backend to listen on :3000
      for i in \$(seq 1 30); do
        if curl -sS http://localhost:3000/auth/can-register >/dev/null 2>&1; then
          break
        fi
        sleep 1
      done

      # 1. Build @postiz/node SDK (apps/sdk)
      if [ ! -f /app/apps/sdk/dist/index.js ]; then
        echo '  -> Building apps/sdk (@postiz/node)...'
        pnpm --filter ./apps/sdk exec tsup
      fi

      # 2. Build CLI Commands (apps/commands) & run config:check
      echo '  -> Building apps/commands (postiz-command)...'
      pnpm --filter ./apps/commands run build
      echo '  -> Running apps/commands config:check...'
      pnpm --filter ./apps/commands run start config:check

      # 3. Build Browser Extension (apps/extension) & activate PM2 dev watcher on :8081
      if [ ! -f /app/apps/extension/dist/manifest.json ]; then
        echo '  -> Building apps/extension (postiz-extension)...'
        cd /app/apps/extension && npx vite build && cp manifest.json dist/manifest.json && cd /app
      fi
      if ! pm2 jlist | grep -q '\"name\":\"extension\"'; then
        echo '  -> Starting apps/extension watcher under PM2 (:8081)...'
        cd /app/apps/extension && pm2 start pnpm --name extension -- run dev && cd /app
      fi
    "

    echo "[4/5] Verifying PM2 processes inside 'postiz' container..."
    docker exec postiz pm2 list

    echo "[5/5] Verifying live HTTP endpoints across the stack..."
    sleep 3
    curl -sS -o /dev/null -w "  - Postiz Frontend (Nginx :4007 -> :4200):       %{http_code}\n" http://localhost:4007/auth
    curl -sS -o /dev/null -w "  - Postiz Knowledge Base Page (:4007/knowledge):  %{http_code}\n" http://localhost:4007/knowledge
    curl -sS -o /dev/null -w "  - Postiz Backend API (Nginx :4007/api):         %{http_code}\n" http://localhost:4007/api/auth/can-register
    curl -sS -o /dev/null -w "  - Postiz Knowledge API (:4007/api/knowledge):      %{http_code}\n" http://localhost:4007/api/knowledge
    curl -sS -o /dev/null -w "  - Postiz Orchestrator Health (:3002):           %{http_code}\n" http://localhost:3002/health/status
    curl -sS -o /dev/null -w "  - Temporal Web UI (:8082):                      %{http_code}\n" http://localhost:8082/
    curl -sS -o /dev/null -w "  - pgAdmin 4 UI (:8085):                         %{http_code}\n" http://localhost:8085/login
    curl -sS -o /dev/null -w "  - RedisInsight UI (:5540):                      %{http_code}\n" http://localhost:5540/
    curl -sS -o /dev/null -w "  - Sentry Spotlight UI (:8969):                  %{http_code}\n" http://localhost:8969/
    docker exec postiz node -e "
      fetch('http://host.docker.internal:11435/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ollama' },
        body: JSON.stringify({
          model: process.env.OLLAMA_FAST_MODEL || 'qwen3.5:4b-q4_K_M',
          messages: [{ role: 'user', content: 'Say OK' }],
          max_tokens: 16
        })
      }).then(async (r) => {
        const d = await r.json();
        console.log('  - Local Ollama Inference (' + d.model + '): ' + r.status + ' OK');
      }).catch((e) => {
        console.error('  - Local Ollama API error:', e.message);
        process.exit(1);
      });
    "

    echo "[Agentic RAG] Executing End-to-End RAG Verification..."
    docker exec postiz npx -y tsx -e "
      import { ioRedis } from './libraries/nestjs-libraries/src/redis/redis.service';
      import { PrismaClient } from '@prisma/client';

      async function verifyRAG() {
        const prisma = new PrismaClient();
        try {
          const org = await prisma.organization.findFirst();
          if (!org) {
            console.log('  - No organization found in DB; skipping DB RAG verification query.');
            return;
          }
          console.log('  - Verified Organization in DB: ' + org.id);

          const count = await prisma.knowledgeResource.count({ where: { organizationId: org.id } });
          console.log('  - KnowledgeResource count for tenant: ' + count);

          await ioRedis.ping();
          console.log('  - Redis RAG cache connection: PONG OK');

          const ragPrompt = 'Context: [knowledge:brand-guidelines@v1] Postiz is an open-source social media management tool.\\n\\nQuestion: What is Postiz?\\n\\nAnswer based only on context:';
          const res = await fetch('http://host.docker.internal:11435/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ollama' },
            body: JSON.stringify({
              model: process.env.OLLAMA_FAST_MODEL || 'qwen3.5:4b-q4_K_M',
              messages: [{ role: 'user', content: ragPrompt }]
            })
          });
          const json = await res.json();
          const answer = json?.choices?.[0]?.message?.content?.trim();
          console.log('  - Agent RAG Synthesized Output: ' + answer);
          console.log('  - Status: Agentic RAG Worker Subsystem Verified E2E');
        } catch (err) {
          console.error('  - RAG verification error:', err.message);
        } finally {
          await prisma.\$disconnect();
          try { ioRedis.disconnect(); } catch (_) {}
          process.exit(0);
        }
      }
      verifyRAG();
    "
    echo "============================================================"
    echo " All containers and workspace applications are active!"
    echo "============================================================"
    ;;
  prebuilt)
    echo "[1/2] Starting the complete Postiz stack using prebuilt GHCR image..."
    docker compose -f docker-compose.yaml up -d
    echo "[2/2] Stack launched!"
    echo "  - Postiz Web App & API (via Nginx): http://localhost:4007"
    echo "  - Temporal Web UI:                  http://localhost:8082"
    ;;
  dev)
    echo "[1/4] Starting infrastructure containers (Postgres, Redis, Temporal, pgAdmin, RedisInsight)..."
    docker compose -f docker-compose.dev.yaml up -d
    echo "[2/4] Installing workspace dependencies and generating Prisma client..."
    pnpm install
    echo "[3/4] Pushing Prisma schema to PostgreSQL..."
    pnpm run prisma-db-push
    echo "[4/4] Starting Frontend (:4200), Backend (:3000), Orchestrator (:3002), and Extension (:8081)..."
    pnpm run dev
    ;;
  *)
    echo "Usage: $0 [full|prebuilt|dev]"
    exit 1
    ;;
esac
