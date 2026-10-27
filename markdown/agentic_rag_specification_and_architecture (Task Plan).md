## 1. Objectives

Implement a production-grade **Knowledge Base & Agentic Retrieval-Augmented Generation (RAG) Worker Subsystem** inside the `postiz-app` monorepo ([Maimoon-github/postiz-app](https://github.com/Maimoon-github/postiz-app/tree/main) / [gitroomhq/postiz-app](https://github.com/gitroomhq/postiz-app)). The implementation must:

1. Deliver a **Document Management Subsystem** supporting predictable **Add (`PUBLISHED`)**, **Draft (`DRAFT`)**, and **Delete (`DELETED`)** resource lifecycles with strict tenant isolation (`organizationId`) and contextual parent–child chunking ([Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/)).
2. Deliver a **7-Layer Agentic RAG Worker Subsystem** exposed as a strongly typed Mastra tool (`KnowledgeRetrieveTool`) to the existing Parent Orchestrator (`MastraService` / `AgentGraphService`), preserving L1 session context isolation across multi-turn chat sessions (`/agents/[id]`), selected social channels (`select.channels.tsx`), media library insertion, Polotno studio (`polonto.tsx`), and AI image/video generation ([Anthropic](https://www.anthropic.com/research/building-effective-agents), [InfoQ](https://www.infoq.com/articles/building-hierarchical-agentic-rag-systems/)).

## 2. Context

### Verified Architecture & Monorepo Topology
- **Workspace Structure (`pnpm-workspace.yaml` & `tsconfig.base.json`)**:
  - `apps/backend` (`@gitroom/backend/*`): NestJS HTTP controllers (`src/api/routes/*.controller.ts`), auth middlewares, and CASL permission guards (`CheckPolicies`).
  - `apps/orchestrator` (`@gitroom/orchestrator/*`): NestJS Temporal worker executing immutable workflows (`src/workflows/`) and side-effect activities (`src/activities/`).
  - `apps/frontend` (`@gitroom/frontend/*`): Next.js App Router UI (`src/app/(app)/(site)/`), native Tailwind CSS components (`src/components/`), and isolated SWR data hooks using `useFetch` (`@gitroom/helpers/utils/custom.fetch`).
  - `libraries/nestjs-libraries` (`@gitroom/nestjs-libraries/*`): Centralized server logic housing Prisma models/repositories (`src/database/prisma/`), DTOs (`src/dtos/`), Redis (`src/redis/redis.service.ts`), OpenAI embeddings/completions (`src/openai/openai.service.ts`), Mastra agent orchestration (`src/chat/mastra.service.ts`, `src/agent/agent.graph.service.ts`), and MCP/agent tools (`src/chat/tools/tool.list.ts`).

### Resolved Codebase Inconsistencies & Material Gaps
1. **Path Resolution (`CLAUDE.md` vs. `File Tree: postiz-app`)**: [`CLAUDE.md`](https://github.com/gitroomhq/postiz-app/blob/main/CLAUDE.md) references legacy labels (`libs/server` and `Vite ReactJS`), whereas the repository uses `libraries/nestjs-libraries/src/` and Next.js App Router in `apps/frontend/src/app/`. Always target the physical paths in `File Tree: postiz-app`.
2. **Prisma-Only Persistence vs. Vector Search (`CLAUDE.md` Invariant)**: [`CLAUDE.md`](https://github.com/gitroomhq/postiz-app/blob/main/CLAUDE.md) strictly prohibits raw SQL (`$queryRaw`, `$executeRaw`). To comply without requiring raw SQL or external vector DB dependencies, store dense embeddings as `Float[]` and lexical tokens/summaries on `KnowledgeChunk` in `schema.prisma`, push `organizationId`, `status: 'PUBLISHED'`, and `version` filters into standard Prisma `findMany` queries with explicit `select` projections, and execute cosine similarity + BM25 lexical scoring + Reciprocal Rank Fusion (RRF) deterministically in `KnowledgeService` ([InfoQ](https://www.infoq.com/articles/building-hierarchical-agentic-rag-systems/)).
3. **File Consolidation (`CLAUDE.md` Invariant)**: [`CLAUDE.md`](https://github.com/gitroomhq/postiz-app/blob/main/CLAUDE.md) forbids scattering pure algorithmic helper files across the repo. Consolidate all 7 worker layers (Cache Check, Complexity Classifier/Planner, Hybrid RRF Search, Deduplication/Reranking, CRAG Grader, Reflective Rewriter, and Evidence Packager) inside `KnowledgeService` (`libraries/nestjs-libraries/src/database/prisma/knowledge/knowledge.service.ts`).

## 3. Tasks

### Task 1: Prisma Schema & Repository Layer (`libraries/nestjs-libraries`)
1. In `libraries/nestjs-libraries/src/database/prisma/schema.prisma`, define:
   - `KnowledgeResource`: `id`, `organizationId`, `title`, `content`, `summary`, `status` (`DRAFT` | `PUBLISHED`), `version` (`Int`, default `1`), `contentHash` (SHA-256), `channelIdentifiers` (`String[]`), `tags` (`String[]`), `createdAt`, `updatedAt`, indexed on `[organizationId, status]`.
   - `KnowledgeChunk`: `id`, `resourceId` (relation to `KnowledgeResource` with `onDelete: Cascade`), `organizationId`, `chunkIndex`, `version` (`Int`), `contextualText` (prepended with `[Doc: {title} | Version: v{version} | Channels: {channels} | Summary: {summary}]`), `embedding` (`Float[]`), `createdAt`, indexed on `[organizationId, resourceId, version]`.
2. Create `libraries/nestjs-libraries/src/dtos/knowledge/knowledge.dto.ts` with `class-validator` DTOs (`UpsertKnowledgeDto`, `UpdateKnowledgeStatusDto`, `QueryKnowledgeDto`).
3. Create `libraries/nestjs-libraries/src/database/prisma/knowledge/knowledge.repository.ts` using `PrismaRepository` with explicit `select` projections and strict `organizationId` scoping on every read and write.

### Task 2: Document Management & Contextual Chunking (`KnowledgeService`)
In `libraries/nestjs-libraries/src/database/prisma/knowledge/knowledge.service.ts`, implement:
1. **`saveDraft(orgId, dto)` (`DRAFT`)**: Upserts `KnowledgeResource` with `status = 'DRAFT'`, increments `version`, deletes any existing `KnowledgeChunk` rows for `resourceId` inside `this._prisma.$transaction`, and invalidates tenant Redis cache keys (`rag:t1:${orgId}:*`, `rag:t2:${orgId}:*`).
2. **`publish(orgId, dto)` (`PUBLISHED` / `Add`)**: Computes SHA-256 `contentHash`, generates a 1-sentence parent summary and 300–500 token contextualized child chunks, computes embeddings via `OpenaiService`, transactionally replaces old chunks with new chunks stamped with `version`, and updates the Redis staleness marker (`rag:meta:${orgId}`).
3. **`delete(orgId, resourceId)` (`DELETED`)**: Transactionally deletes `KnowledgeChunk` and `KnowledgeResource` scoped to `organizationId` and flushes tenant Redis cache keys.

### Task 3: 7-Layer Agentic RAG Worker & Mastra Tool Integration
1. Inside `KnowledgeService.retrieveForOrchestrator(orgId, input)`, implement the bounded 7-layer worker loop ([Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/), [Swfte](https://www.swfte.com/agentic-rag), [Towards Data Science](https://towardsdatascience.com/zero-waste-agentic-rag-designing-caching-architectures-to-minimize-latency-and-llm-costs-at-scale/)):
   - **Layer 1 (Ingress, Pre-Retrieval RBAC & Two-Tier Redis Cache)**: Enforce `organizationId`, `status = 'PUBLISHED'`, and `chunk.version == resource.version`. Bypass cache on real-time temporal markers (`"latest"`, `"today"`). Check Redis **Tier 1 Semantic Cache** ($\ge 0.95$ cosine similarity) and **Tier 2 Retrieval Cache** ($\ge 0.70$ topic similarity), validating against row `version`/`updatedAt`, table `MAX(updatedAt)`, SHA-256 `contentHash`, and predicate-slice markers.
   - **Layer 2 (Adaptive Classifier & Planner)**: Classify query at `temperature = 0`; route simple lookups to 1 pass (`maxIterations = 1`) and decompose complex queries into parallel sub-queries (`Promise.all`) ([Analytics Vidhya](https://www.analyticsvidhya.com/blog/2025/03/adaptive-rag-systems-with-langgraph/)).
   - **Layer 3 & 4 (Hybrid RRF Search, Deduplication & Reranking)**: Score candidate chunks from Prisma using Dense Cosine Similarity + BM25 Lexical Matching fused via Reciprocal Rank Fusion (RRF), deduplicate by `(resourceId, id, version)`, and retain top-$K$ (`<= 6`) above `minScore` (`0.72`).
   - **Layer 5 & 6 (CRAG Grader & Reflective Query Rewriter)**: Evaluate relevancy (strip off-topic chunks) and collective sufficiency (`COMPLETE | PARTIAL | ABSTAIN`) ([DataCamp](https://www.datacamp.com/tutorial/corrective-rag-crag)). If insufficient (including insufficient Tier 2 cache hits), rewrite the query using `missingInformation` and `attemptedQueries`, halting immediately on duplicate queries or at `maxIterations = 3`.
   - **Layer 7 (Evidence Packager)**: Cache verified results in Redis and return `{ sufficiencyStatus, verifiedChunks, citations, missingInformation, diagnostics }` capped at $\le 2,500$ tokens ([Medium](https://medium.com/@kuldeeparya3794/when-ai-forgets-debugging-and-preventing-memory-failures-in-production-rag-agentic-rag-systems-2bf142193d21)).
2. Create `libraries/nestjs-libraries/src/chat/tools/knowledge.retrieve.tool.ts` implementing `AgentToolInterface` with `createTool()` from `@mastra/core/tools`, resolving tenant context via `getContext()` from `async.storage.ts`. Register it in `tool.list.ts`, `chat.module.ts`, and `database.module.ts`.

### Task 4: Backend Controller & Frontend Knowledge UI
1. Create `apps/backend/src/api/routes/knowledge.controller.ts` exposing `GET /knowledge`, `POST /knowledge` (Add/Publish or Draft), `PUT /knowledge/:id/status`, and `DELETE /knowledge/:id` using `@GetOrgFromRequest()` and register it in `api.module.ts`.
2. Add native Tailwind UI components in `apps/frontend/src/components/agents/` (or `apps/frontend/src/app/(app)/(site)/agents/`) using isolated `useFetch` SWR hooks to manage `Add`, `Draft`, and `Delete` knowledge items alongside channel selection and studio tools.

## 4. Instructions

Follow the sequence: **Understand → Decompose → Research → Design → Implement → Validate → Test → Review → Observe → Improve**.
1. Inspect existing patterns in `posts.controller.ts`, `posts.service.ts`, `posts.repository.ts`, and `posts.list.tool.ts` before writing code so all naming, dependency injection, and decorator conventions match the codebase.
2. Enforce `DTO → Controller → Service → Repository` across all HTTP endpoints.
3. Enforce a `1,200 ms` timeout per retrieval hop and a `4,500 ms` cumulative timeout per worker execution, returning `PARTIAL` or `ABSTAIN` on timeout ([InfoQ](https://www.infoq.com/articles/building-hierarchical-agentic-rag-systems/)).

## 5. Constraints

- **Package & Tooling Rules**: Use `pnpm` exclusively; run linting from the repository root; do not install external UI component libraries or unnecessary npm packages ([`CLAUDE.md`](https://github.com/gitroomhq/postiz-app/blob/main/CLAUDE.md)).
- **Database & Security Rules**: Never use raw SQL (`$queryRaw` / `$executeRaw`). Never return raw Prisma rows from credential-bearing models (`User`, `Integration`). Always use explicit `select` clauses and server-side `organizationId` scoping ([`CLAUDE.md`](https://github.com/gitroomhq/postiz-app/blob/main/CLAUDE.md)).
- **Temporal & Webhook Safety**: Do not modify any existing workflow file in `apps/orchestrator/src/workflows/` or existing activity signatures; do not touch billing/webhook services ([`CLAUDE.md`](https://github.com/gitroomhq/postiz-app/blob/main/CLAUDE.md)).
- **Frontend Rules**: Do not use deprecated `--color-custom*` CSS variables; declare each SWR `useFetch` call in its own standalone hook without `eslint-disable-next-line` ([`CLAUDE.md`](https://github.com/gitroomhq/postiz-app/blob/main/CLAUDE.md)).

## 6. Acceptance Criteria

1. **Lifecycle Isolation**: `DRAFT` resources produce `0` rows in `KnowledgeChunk` and never appear in `KnowledgeRetrieveTool` outputs; reverting `PUBLISHED → DRAFT` or calling `DELETE` atomically purges all associated chunks and invalidates Redis caches.
2. **Bounded Worker Execution**: `KnowledgeRetrieveTool` enforces pre-retrieval `organizationId` and `status = 'PUBLISHED'` filtering, executes Hybrid RRF + CRAG grading, halts on duplicate rewrites or at `maxIterations = 3`, and returns structured `[resourceId:chunkId@vX]` citations.
3. **Zero Regressions**: Root `pnpm` linting, TypeScript compilation (`tsconfig.base.json`), and unit/integration tests for Draft exclusion, Cascade deletion, Cache staleness invalidation, and 3-step loop termination pass cleanly.

## 7. Required Output

Produce the complete implementation in the following order:
1. **File Modification Matrix**: Table of modified and newly created files with one-sentence justifications.
2. **Prisma Schema & Migration Diff**: Exact additions to `schema.prisma`.
3. **Backend & Worker Implementation**: Complete TypeScript code for `knowledge.dto.ts`, `knowledge.repository.ts`, `knowledge.service.ts`, `knowledge.retrieve.tool.ts`, `knowledge.controller.ts`, and module registrations.
4. **Frontend Knowledge UI & SWR Hooks**: Native Tailwind components and isolated `useFetch` hooks.
5. **Automated Tests & PR Verification Block**: Jest test suite covering lifecycle isolation and worker loop bounds, followed by a `.github/PULL_REQUEST_TEMPLATE.md`-compliant summary containing `# What kind of change does this PR introduce?` and `# QA` with numbered checkbox steps (`1. [ ] step`).