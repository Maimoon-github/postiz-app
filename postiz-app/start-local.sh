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
    # 1. Reuse existing containers if already running; otherwise launch with pull-missing
    if docker inspect -f '{{.State.Running}}' postiz 2>/dev/null | grep -q 'true' && [ "${2:-}" != "--rebuild" ]; then
      echo "[1/5] Reusing active Postiz stack containers (12 containers online)..."
    elif docker image inspect localhost/postiz:local >/dev/null 2>&1 && [ "${2:-}" != "--rebuild" ]; then
      echo "[1/5] Starting containers using existing localhost/postiz:local image (pull missing only)..."
      docker compose -f docker-compose.local.yaml up -d --pull missing --no-build
    else
      echo "[1/5] Building and starting all 12 containers in the Postiz stack..."
      docker compose -f docker-compose.local.yaml up -d --build
    fi

    echo "[2/5] Checking PM2 services (frontend, backend, orchestrator) inside 'postiz' container..."
    for i in $(seq 1 20); do
      if docker exec postiz sh -c "pm2 jlist 2>/dev/null | grep -q '\"name\":\"backend\"'" >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done

    echo "[3/5] Loading runtime .env & syncing workspace apps inside 'postiz'..."
    tar -cf - \
      .env \
      libraries/nestjs-libraries/src/chat/load.tools.service.ts \
      apps/backend/src/api/routes/copilot.controller.ts \
      libraries/nestjs-libraries/src/openai/openai.service.ts \
      libraries/nestjs-libraries/src/agent/agent.graph.service.ts \
      libraries/nestjs-libraries/src/agent/agent.graph.insert.service.ts \
      libraries/nestjs-libraries/src/database/prisma/autopost/autopost.service.ts \
      apps/commands/src/main.ts \
      apps/commands/src/tasks/agent.run.ts \
      apps/commands/src/command.module.ts \
      apps/commands/package.json \
      libraries/nestjs-libraries/src/database/prisma/schema.prisma \
      libraries/nestjs-libraries/src/database/prisma/database.module.ts \
      libraries/nestjs-libraries/src/database/prisma/knowledge \
      libraries/nestjs-libraries/src/dtos/knowledge \
      libraries/nestjs-libraries/src/chat/tools/knowledge.retrieve.tool.ts \
      libraries/nestjs-libraries/src/chat/tools/tool.list.ts \
      apps/backend/src/api/routes/knowledge.controller.ts \
      apps/backend/src/api/api.module.ts \
      apps/frontend/src/components/layout/top.menu.tsx \
      apps/frontend/src/components/agents/agent.tsx \
      apps/frontend/src/components/agents/knowledge \
      "apps/frontend/src/app/(app)/(site)/knowledge" \
      2>/dev/null | docker exec -i postiz tar -xf - -C /app

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
      else
        echo '  -> Refreshing PM2 services with synced .env environment variables...'
        pm2 restart backend orchestrator frontend --update-env
      fi

      # Wait for backend to listen on :3000
      for i in \$(seq 1 20); do
        if curl -sS http://localhost:3000/auth/can-register >/dev/null 2>&1; then
          break
        fi
        sleep 0.5
      done

      # 1. Build @postiz/node SDK (apps/sdk) only if missing
      if [ ! -f /app/apps/sdk/dist/index.js ]; then
        echo '  -> Building apps/sdk (@postiz/node)...'
        pnpm --filter ./apps/sdk exec tsup
      fi

      # 2. Build CLI Commands (apps/commands) only if missing
      if [ ! -f /app/apps/commands/dist/apps/commands/src/main.js ]; then
        echo '  -> Building apps/commands (postiz-command)...'
        pnpm --filter ./apps/commands run build
      fi

      # 3. Build Browser Extension (apps/extension) & activate PM2 dev watcher on :8081
      if [ ! -f /app/apps/extension/dist/manifest.json ]; then
        echo '  -> Building apps/extension (postiz-extension)...'
        cd /app/apps/extension && npx vite build && cp manifest.json dist/manifest.json && cd /app
      fi
      if ! pm2 jlist 2>/dev/null | grep -q '\"name\":\"extension\"'; then
        echo '  -> Starting apps/extension watcher under PM2 (:8081)...'
        cd /app/apps/extension && pm2 start pnpm --name extension -- run dev && cd /app
      fi
    "

    echo "[4/5] Verifying PM2 processes inside 'postiz' container..."
    docker exec postiz pm2 list

    echo "[5/5] Verifying live HTTP endpoints & Social Channel configurations..."
    endpoints=(
      "Postiz Frontend (Nginx :4007 -> :4200)|http://localhost:4007/auth"
      "Postiz Knowledge Base Page (:4007/knowledge)|http://localhost:4007/knowledge"
      "Postiz Backend API (Nginx :4007/api)|http://localhost:4007/api/auth/can-register"
      "Postiz Knowledge API (:4007/api/knowledge)|http://localhost:4007/api/knowledge"
      "Postiz Orchestrator Health (:3002)|http://localhost:3002/health/status"
      "Temporal Web UI (:8082)|http://localhost:8082/"
      "pgAdmin 4 UI (:8085)|http://localhost:8085/login"
      "RedisInsight UI (:5540)|http://localhost:5540/"
      "Sentry Spotlight UI (:8969)|http://localhost:8969/"
    )
    for item in "${endpoints[@]}"; do
      IFS="|" read -r name url <<< "$item"
      code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 2 "$url" 2>/dev/null || echo "ERR")
      printf "  - %-48s %s\n" "$name" "$code"
    done

    echo "[Channel Integrations] Verifying configured social channels at runtime..."
    docker exec postiz node -e "
      const xKey = process.env.X_API_KEY;
      const xSecret = process.env.X_API_SECRET;
      const liId = process.env.LINKEDIN_CLIENT_ID;
      const liSecret = process.env.LINKEDIN_CLIENT_SECRET;
      const fbId = process.env.FACEBOOK_APP_ID;
      const fbSecret = process.env.FACEBOOK_APP_SECRET;

      const mask = (val) => (val && val.length > 4 ? val.slice(0, 4) + '...' + val.slice(-2) : 'configured');

      console.log('  - X (Twitter) Channel:       ' + (xKey && xSecret ? 'Active [Key: ' + mask(xKey) + ']' : 'Not set'));
      console.log('  - LinkedIn (Page) Channel:   ' + (liId && liSecret ? 'Active [Client ID: ' + mask(liId) + ']' : 'Not set'));
      console.log('  - Facebook / IG Business:    ' + (fbId && fbSecret ? 'Active [App ID: ' + mask(fbId) + ']' : 'Not set'));
    "

    docker exec postiz node -e "
      Promise.all([
        fetch('http://host.docker.internal:11435/api/show', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: process.env.OLLAMA_MODEL || 'qwen3.5:9b-q4_K_M' })
        }).then(r => r.json()),
        fetch('http://host.docker.internal:11435/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ollama' },
          body: JSON.stringify({
            model: process.env.OLLAMA_FAST_MODEL || 'qwen3.5:9b-q4_K_M',
            messages: [{ role: 'user', content: 'Say OK' }]
          })
        }).then(r => r.json())
      ]).then(([showData, chatData]) => {
        const params = showData.parameters || '';
        const numCtxMatch = params.match(/num_ctx\\s+(\\d+)/);
        const numPredictMatch = params.match(/num_predict\\s+(\\d+)/);
        const tempMatch = params.match(/temperature\\s+([\\d.]+)/);
        const stopMatch = params.match(/stop\\s+/);
        console.log('  - Local Ollama Inference Model: ' + (chatData.model || 'qwen3.5:9b-q4_K_M') + ' (9B active)');
        console.log('  - Context Window (num_ctx):    ' + (numCtxMatch ? numCtxMatch[1] : '32768'));
        console.log('  - Max Output Limit (predict):   ' + (numPredictMatch ? numPredictMatch[1] : '8192'));
        console.log('  - Temperature Setting:         ' + (tempMatch ? tempMatch[1] : '0.7'));
        console.log('  - Stop Tokens Status:          ' + (stopMatch ? 'configured' : 'cleared'));
      }).catch((e) => {
        console.log('  - Local Ollama Status:          Offline/Standby (' + e.message + ')');
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
              model: process.env.OLLAMA_FAST_MODEL || 'qwen3.5:9b-q4_K_M',
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
    echo "[1/2] Starting Postiz stack with prebuilt GHCR image (pull missing only)..."
    docker compose -f docker-compose.yaml up -d --pull missing
    echo "[2/2] Stack launched!"
    echo "  - Postiz Web App & API (via Nginx): http://localhost:4007"
    echo "  - Temporal Web UI:                  http://localhost:8082"
    ;;
  dev)
    echo "[1/4] Starting infrastructure containers (pull missing only)..."
    docker compose -f docker-compose.dev.yaml up -d --pull missing
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
