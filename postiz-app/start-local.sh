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
      echo "[1/5] Starting all 11 containers in the Postiz stack (using built localhost/postiz:local image)..."
      docker compose -f docker-compose.local.yaml up -d
    else
      echo "[1/5] Building and starting all 11 containers in the Postiz stack..."
      docker compose -f docker-compose.local.yaml up -d --build
    fi

    echo "[2/5] Waiting for PM2 services (frontend, backend, orchestrator) inside 'postiz' container..."
    for i in $(seq 1 30); do
      if docker exec postiz sh -c "pm2 jlist 2>/dev/null | grep -q '\"name\":\"backend\"'" >/dev/null 2>&1; then
        break
      fi
      sleep 2
    done

    echo "[3/5] Building and activating remaining workspace apps (sdk, commands, extension) inside 'postiz'..."
    docker cp apps/commands/src/main.ts postiz:/app/apps/commands/src/main.ts
    docker cp apps/commands/src/tasks/agent.run.ts postiz:/app/apps/commands/src/tasks/agent.run.ts
    docker cp apps/commands/src/command.module.ts postiz:/app/apps/commands/src/command.module.ts
    docker cp apps/commands/package.json postiz:/app/apps/commands/package.json
    docker exec postiz sh -c "
      set -e
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
    curl -sS -o /dev/null -w "  - Postiz Frontend (Nginx :4007 -> :4200):   %{http_code}\n" http://localhost:4007/auth
    curl -sS -o /dev/null -w "  - Postiz Backend API (Nginx :4007/api):     %{http_code}\n" http://localhost:4007/api/user/self
    curl -sS -o /dev/null -w "  - Postiz Orchestrator Health (:3002):       %{http_code}\n" http://localhost:3002/health/status
    curl -sS -o /dev/null -w "  - Temporal Web UI (:8082):                  %{http_code}\n" http://localhost:8082/
    curl -sS -o /dev/null -w "  - pgAdmin 4 UI (:8085):                     %{http_code}\n" http://localhost:8085/login
    curl -sS -o /dev/null -w "  - RedisInsight UI (:5540):                  %{http_code}\n" http://localhost:5540/
    curl -sS -o /dev/null -w "  - Sentry Spotlight UI (:8969):              %{http_code}\n" http://localhost:8969/
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
