# Postiz Architecture & Workflow Analysis — Structured ReAct \+ CoT Prompt & Reference Guide

## 1\. Structured ReAct \+ Chain-of-Thought (CoT) Prompt

Use the prompt below to instruct an AI engineering agent to inspect, trace, and document the **Postiz (`postiz-app`)** monorepo architecture and operational workflows without modifying any files.

### Role & Objective

You are a Principal Software Architect analyzing the **Postiz (`postiz-app`)** open-source social media scheduling and automation platform ([Maimoon-github/postiz-app](https://github.com/Maimoon-github/postiz-app/tree/main) / [gitroomhq/postiz-app](https://github.com/gitroomhq/postiz-app)). Your objective is to:

1. Analyze the underlying operational workflow logic and monorepo architecture to establish a blueprint for custom modifications.  
2. Identify, catalog, and extract architectural rules from all non-code text and documentation files in the repository.

### Strict Operational Constraints

- **Read-Only Execution**: Do **not** create, edit, format, refactor, delete, or otherwise modify any file in the underlying codebase under any circumstances.  
- **Evidence-Grounded Analysis**: Base every architectural claim on explicit file paths, module definitions, and documentation inside `postiz-app`.  
- **Output Format**: Deliver the entire response as a single, self-contained Markdown document using standard pipe tables (`| col |`) and clear hierarchical headings.

### Execution Framework: Hybrid ReAct \+ Chain-of-Thought (CoT)

Execute your investigation and structure your analysis by cycling through the **ReAct** loop (**Thought → Action → Observation**) paired with explicit **Chain-of-Thought (CoT)** step-by-step reasoning before synthesizing each architectural section.

#### Phase 1: Non-Code Documentation Discovery & Rule Extraction

- **Thought (CoT Step 1 — Documentation Triage)**: Reason through the repository file tree to separate non-code documentation, agent instruction files, legal agreements, and environment templates from executable source code (`.ts`, `.tsx`, `.js`, `.mjs`, `.cjs`, `.scss`, `.css`, `.sh`).  
- **Action**: Inspect all Markdown (`.md`), plain-text (`.txt`, `LICENSE`), and environment template (`.env.example`) files across the root directory, `.github/`, `apps/`, and `libraries/`.  
- **Observation**: Record the exact relative path, scope, and architectural constraints defined in each file (such as `CLAUDE.md`, `apps/frontend/AGENTS.md`, `apps/frontend/CLAUDE.md`, `.github/copilot-instructions.md`, `CONTRIBUTING.md`, and `README.md`).

#### Phase 2: Monorepo Topology & Workspace Boundary Mapping

- **Thought (CoT Step 2 — Dependency Graph Reasoning)**: Trace how `pnpm-workspace.yaml`, `package.json`, and `tsconfig.base.json` connect the runnable applications in `apps/` to the shared packages in `libraries/`. Evaluate why business logic is centralized in `libraries/nestjs-libraries` rather than `apps/backend`.  
- **Action**: Examine the entry points and module declarations across `apps/backend`, `apps/orchestrator`, `apps/commands`, `apps/frontend`, `apps/extension`, `apps/sdk`, `libraries/nestjs-libraries`, `libraries/react-shared-libraries`, and `libraries/helpers`.  
- **Observation**: Map the responsibility of each workspace package, its runtime framework (Next.js, NestJS, Temporal, Vite, tsup), and cross-package import boundaries.

#### Phase 3: Backend Layering, Data Persistence & Security Invariants

- **Thought (CoT Step 3 — Request Lifecycle & Data Flow)**: Trace an incoming request from API ingress (`apps/backend/src/api/routes/*.controller.ts` and `apps/backend/src/public-api/routes/v1/public.integrations.controller.ts`) through authentication/permission guards down to Prisma persistence (`libraries/nestjs-libraries/src/database/prisma/`).  
- **Action**: Inspect the strict multi-tier architecture (`DTO → Controller → [Manager] → Service → Repository`), `schema.prisma`, OAuth/session middlewares, and webhook handlers (`stripe.controller.ts`, `webhooks.controller.ts`, `SubscriptionService`).  
- **Observation**: Document validation patterns, Prisma query rules (no raw SQL; explicit `select` clauses on credential-bearing models like `User` and `Integration`), and non-throwing error-handling requirements for external billing webhooks.

#### Phase 4: Asynchronous Orchestration & Temporal Workflow Logic

- **Thought (CoT Step 4 — Temporal State Machine Tracing)**: Analyze how scheduled posts, recurring jobs, media processing, and token refreshes transition from database state to asynchronous execution in `apps/orchestrator` and `libraries/nestjs-libraries/src/temporal/`.  
- **Action**: Inspect `apps/orchestrator/src/workflows/` (including versioned post workflows `post.workflow.v1.0.1.ts` through `post.workflow.v1.1.2.ts`, `autopost.workflow.ts`, `clipping.workflow.ts`, `generate.video.workflow.ts`, `process.media.workflow.ts`, `refresh.token.workflow.ts`, `send.email.workflow.ts`, `digest.email.workflow.ts`, `missing.post.workflow.ts`, and `streak.workflow.ts`), `apps/orchestrator/src/activities/`, and `apps/orchestrator/src/signals/`.  
- **Observation**: Detail how Temporal workflows, activities, and signals coordinate post publishing, retries, media transcoding, and email dispatch.

#### Phase 5: Social Provider, AI Agent & MCP Extension Points

- **Thought (CoT Step 5 — Extensibility & Custom Modification Blueprint)**: Determine the exact interfaces, abstract classes, DTOs, and UI components required to safely customize Postiz—such as adding a new social media provider, registering an AI chat/MCP tool, or extending third-party media integrations.  
- **Action**: Inspect `libraries/nestjs-libraries/src/integrations/social/` (`social.abstract.ts`, `social.integrations.interface.ts`, `integration.manager.ts`), `libraries/nestjs-libraries/src/chat/` (`mastra.service.ts`, `mcp.relay.service.ts`, `start.mcp.ts`, `tools/`), `libraries/nestjs-libraries/src/agent/`, and `apps/frontend/src/components/new-launch/providers/`.  
- **Observation**: Synthesize a step-by-step modification checklist showing every file layer that must be touched when extending the platform in future development.

### Required Deliverable Structure

Format the final analysis output using the following Markdown sections:

1. **Non-Code Documentation & Text File Inventory**: Categorized Markdown table listing every non-code text file, its relative path, format, and architectural relevance.  
2. **Monorepo Architecture & Workspace Topology**: Breakdown of `apps/*` and `libraries/*` packages and their inter-package dependencies.  
3. **End-to-End Operational Workflows**: Step-by-step traces of (a) API Request & Auth Flow, (b) Post Scheduling & Temporal Execution Pipeline, (c) Social Integration & OAuth Lifecycle, and (d) AI Agent / MCP Tool Execution.  
4. **Core Architectural Rules & Safety Guardrails**: Mandatory coding, database, security, and frontend conventions enforced by the repository.  
5. **Custom Modification Blueprint**: Concrete extension touchpoints for adding new social channels, Temporal workflows, API endpoints, and AI tools without breaking existing invariants.

## 2\. Reference Inventory of Non-Code Documentation & Text Files

Based on the provided `File Tree: postiz-app` and `README.md` from [Maimoon-github/postiz-app](https://github.com/Maimoon-github/postiz-app/tree/main) ([gitroomhq/postiz-app](https://github.com/gitroomhq/postiz-app)), the repository contains the following non-code text and documentation files:

### Root Documentation, AI Instructions & Legal Files

| File Path | Type | Primary Information & Architectural Relevance |
| :---- | :---- | :---- |
| `README.md` | Markdown | Project overview, supported social channels and AI agents, core tech stack (`pnpm` workspaces, Next.js, NestJS, Prisma/PostgreSQL, Temporal, Resend), Cloud vs. self-hosted feature matrix, and OAuth compliance rules ([README.md](https://github.com/gitroomhq/postiz-app/blob/main/README.md)). |
| `CLAUDE.md` | Markdown | Primary engineering and AI agent rulebook defining workspace roles, backend layering (`DTO → Controller → [Manager] → Service → Repository`), Prisma security rules, frontend SWR/`useFetch` conventions, and `# QA` PR verification rules ([CLAUDE.md](https://github.com/gitroomhq/postiz-app/blob/main/CLAUDE.md)). |
| `CONTRIBUTING.md` | Markdown | Contributor onboarding guide, community communication channels (GitHub Issues, Discord), CLA requirements, and pull request submission policies ([CONTRIBUTING.md](https://github.com/gitroomhq/postiz-app/blob/main/CONTRIBUTING.md)). |
| `CODE_OF_CONDUCT.md` | Markdown | Community participation standards and enforcement policies ([CODE\_OF\_CONDUCT.md](https://www.google.com/search?q=https://github.com/gitroomhq/postiz-app/blob/main/CODE_OF_CONDUCT.md)). |
| `SECURITY.md` | Markdown | Security vulnerability disclosure instructions and supported versions policy ([SECURITY.md](https://www.google.com/search?q=https://github.com/gitroomhq/postiz-app/blob/main/SECURITY.md)). |
| `LICENSE` | Plain Text | Full text of the GNU Affero General Public License v3.0 (AGPL-3.0) governing open-source usage and modifications ([LICENSE](https://github.com/gitroomhq/postiz-app/blob/main/LICENSE)). |
| `CCLA.md` | Markdown | Corporate Contributor License Agreement terms for organization-backed contributions. |
| `ICLA.md` | Markdown | Individual Contributor License Agreement terms for independent contributors. |
| `version.txt` | Plain Text | Single-source plain-text version identifier for releases and container builds. |

### GitHub Governance & Sub-Package Documentation Files

| File Path | Type | Primary Information & Architectural Relevance |
| :---- | :---- | :---- |
| `.github/copilot-instructions.md` | Markdown | Repository-level instructions guiding GitHub Copilot on coding conventions, monorepo structure, and architectural boundaries. |
| `.github/PULL_REQUEST_TEMPLATE.md` | Markdown | Standardized PR description template enforcing the mandatory `# QA` numbered checkbox testing plan. |
| `apps/frontend/AGENTS.md` | Markdown | AI coding agent instructions tailored to the Next.js frontend (`apps/frontend`), covering routing, UI components, and state management. |
| `apps/frontend/CLAUDE.md` | Markdown | Claude-specific frontend development rules, styling conventions (`colors.scss`, `global.scss`, `tailwind.config.cjs`), and component guidelines. |
| `apps/frontend/README.md` | Markdown | Documentation for running, building, and maintaining the Next.js frontend application. |
| `apps/frontend/src/fonts/plus-jakarta-sans/OFL.txt` | Plain Text | SIL Open Font License governing the bundled Plus Jakarta Sans font family. |
| `apps/sdk/README.md` | Markdown | Usage guide and API documentation for the `@postiz/node` SDK package. |
| `libraries/nestjs-libraries/README.md` | Markdown | Overview of the shared NestJS backend library housing Prisma services, social providers, Temporal bindings, and AI tools. |
| `libraries/react-shared-libraries/README.md` | Markdown | Overview of the shared React library providing reusable form controls, UI helpers, Sentry initialization, and i18n translation bundles. |

### Supplementary Configuration, Localization & Environment Reference Files

| File Path | Type | Primary Information & Architectural Relevance |
| :---- | :---- | :---- |
| `.env.example` | Plain Text (Env) | Reference template documenting required environment variables (PostgreSQL `DATABASE_URL`, Redis, Temporal host/namespace, OAuth client credentials, Cloudflare R2/local storage, Stripe, and OpenAI/LLM keys). |
| `sonar-project.properties` | Plain Text (Props) | SonarQube project metadata and source scanning configuration. |
| `libraries/react-shared-libraries/src/translation/locales/*/translation.json` | JSON (Text Data) | Localization string dictionaries across 16 locales (`ar`, `bn`, `de`, `en`, `es`, `fr`, `he`, `it`, `ja`, `ka_ge`, `ko`, `pt`, `ru`, `tr`, `vi`, `zh`). |
| `.github/ISSUE_TEMPLATE/*.yml` & `.github/FUNDING.yaml` | YAML | Structured bug report (`01_bug_report.yml`), feature request (`02_feature_request.yml`), issue routing (`config.yml`), and sponsorship metadata. |
| `dynamicconfig/development-sql.yaml` & `development-cass.yaml` | YAML | Temporal dynamic configuration parameters for local SQL and Cassandra development environments. |

## 3\. Baseline Architectural & Workflow Overview of Postiz

### Monorepo Structure (`pnpm` Workspaces)

- **`apps/backend` (NestJS API Server)**: Exposes internal REST endpoints (`src/api/routes/*.controller.ts`) for the web UI and external v1 API endpoints (`src/public-api/routes/v1/public.integrations.controller.ts`) for SDK, CLI, and automation integrations (n8n, Make.com, Zapier). Handles authentication (`src/services/auth/`), RBAC permissions (`permissions.guard.ts`, `permissions.ability.ts`), and widget auth middlewares.  
- **`apps/orchestrator` (NestJS \+ Temporal Worker)**: Executes background workflows (`src/workflows/`), external side-effect activities (`src/activities/`), and asynchronous workflow signals (`src/signals/`). Isolates long-running schedules, retries, media transcoding, and token refreshes from HTTP request threads.  
- **`apps/commands` (NestJS CLI Runner)**: Provides operational CLI tasks (`src/tasks/agent.run.ts`, `configuration.ts`, `refresh.tokens.ts`) for manual or cron-triggered maintenance and agent execution.  
- **`apps/frontend` (Next.js App Router)**: Provides the multi-tenant UI across route groups `(app)/(site)` (launches/calendar, analytics, agents, media, plugs, billing, settings, third-party), `(app)/(preview)`, `(app)/auth`, `(app)/integrations`, `(app)/oauth`, `(extension)`, and `(provider)`.  
- **`apps/extension` (Vite Chrome Extension)**: Browser extension (`background.ts`, `skool.provider.ts`) supporting cookie-bridged provider integrations where standard OAuth is unavailable.  
- **`apps/sdk` (`tsup` TypeScript Package)**: Publishable `@postiz/node` client SDK (`src/index.ts`).  
- **`libraries/nestjs-libraries` (Core Server Domain Library)**: Houses almost all backend business logic:  
  - **Database Layer (`src/database/prisma/`)**: `schema.prisma`, `prisma.service.ts`, and domain-specific `*.service.ts` \+ `*.repository.ts` pairs (`posts`, `integrations`, `organizations`, `users`, `subscriptions`, `media`, `autopost`, `clipping`, `webhooks`, `oauth`, `sets`, `signatures`, `notifications`, `errors`, `agencies`, `announcements`, `admin-stats`).  
  - **Social Providers (`src/integrations/social/`)**: 36+ platform implementations extending `social.abstract.ts` and managed by `integration.manager.ts` and `refresh.integration.service.ts`.  
  - **AI Agent & MCP Layer (`src/agent/` & `src/chat/`)**: Graph-based agent services (`agent.graph.service.ts`), Mastra integration (`mastra.service.ts`), Model Context Protocol server/relay (`start.mcp.ts`, `mcp.relay.service.ts`), and 20+ structured agent tools (`src/chat/tools/*.tool.ts`).  
  - **Media, Video & Third-Party Services**: Storage adapters (`cloudflare.storage.ts`, `r2.uploader.ts`, `local.storage.ts`), video generators (`images.slides.ts`, `seedance.ts`), transcription (`deepgram.service.ts`), AI services (`openai.service.ts`, `fal.service.ts`), newsletters (`beehiiv`, `listmonk`), and short-link providers (`dub.ts`, `kutt.ts`, `linkdrip.ts`, `short.io.ts`).  
- **`libraries/react-shared-libraries` & `libraries/helpers`**: Shared React form primitives, Uppy media upload helpers, i18n configuration, and cross-environment utilities (`custom.fetch.tsx`, content sanitization, URL/image validators, `@Plug` decorators).

### Core Operational Workflows & Modification Guardrails

1. **Strict Backend Layering**: Every API operation follows `DTO → Controller → [Manager] → Service → Repository` ([CLAUDE.md](https://github.com/gitroomhq/postiz-app/blob/main/CLAUDE.md)). Controllers live in `apps/backend`, while DTOs, Managers, Services, and Repositories live in `libraries/nestjs-libraries`.  
2. **Post Lifecycle & Versioned Temporal Workflows**:  
   - Creating or updating a post validates provider-specific settings via `libraries/nestjs-libraries/src/dtos/posts/providers-settings/*.dto.ts`, persists the record via `PostsService` / `PostsRepository`, and registers or updates a Temporal workflow via `libraries/nestjs-libraries/src/temporal/`.  
   - `apps/orchestrator/src/workflows/post-workflows/post.workflow.v1.0.1.ts` through `post.workflow.v1.1.2.ts` preserve deterministic replay compatibility for in-flight scheduled posts while executing `post.activity.ts`, `media.activity.ts`, and `integrations.activity.ts`.  
3. **Database & Credential Safety**:  
   - Raw SQL queries are prohibited; all persistence must use Prisma ([CLAUDE.md](https://github.com/gitroomhq/postiz-app/blob/main/CLAUDE.md)).  
   - Never return raw Prisma rows from credential-holding models (`Integration`, `User`) in controller responses; repository writes and reads on sensitive models must use explicit `select` projections ([CLAUDE.md](https://github.com/gitroomhq/postiz-app/blob/main/CLAUDE.md)).  
   - Webhook handlers (`StripeController`, `SubscriptionService`) must catch and log all internal or provider errors rather than throwing exceptions so customer billing state is never left partially applied ([CLAUDE.md](https://github.com/gitroomhq/postiz-app/blob/main/CLAUDE.md)).