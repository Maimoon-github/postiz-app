# Text (non-code) files in `postiz-app` — documentation, config, and data

These are the files worth reading for understanding / configuring the project without touching source code. Paths are relative to `postiz-app/`.

---

## 1. Project documentation (root)

| Path | What it is |
|---|---|
| `README.md` | Main project overview, features, cloud vs OSS comparison |
| `CLAUDE.md` | AI coding assistant instructions / project orientation |
| `CONTRIBUTING.md` | Contribution guidelines |
| `CODE_OF_CONDUCT.md` | Community rules |
| `SECURITY.md` | Security policy |
| `LICENSE` | AGPL-3.0 license text |
| `CCLA.md` | Corporate Contributor License Agreement |
| `ICLA.md` | Individual Contributor License Agreement |
| `version.txt` | Current version string |

## 2. Root-level project configuration

| Path | What it is |
|---|---|
| `.env.example` | **Template of every environment variable** — read this first for runtime config |
| `package.json` | Workspace root scripts & deps |
| `pnpm-workspace.yaml` | Monorepo workspace layout |
| `pnpm-lock.yaml` | Locked dependency graph |
| `tsconfig.base.json` | Shared TS config |
| `tsconfig.json` | Root TS config |
| `.npmrc` | npm/pnpm registry settings |
| `.prettierrc` | Prettier formatting rules |
| `.prettierignore` | Prettier ignore list |
| `.eslintignore` | ESLint ignore list |
| `.gitignore` | Git ignore list |
| `.gitmodules` | Git submodule config |
| `.dockerignore` | Docker build ignore list |
| `.coderabbit.yaml` | CodeRabbit review bot config |
| `i18n.json` | i18n tool configuration |
| `i18n.lock` | Lockfile for i18n tool |
| `sonar-project.properties` | SonarQube analysis config |
| `railway.toml` | Railway deploy config |
| `chatgpt-app-submission.json` | ChatGPT app store metadata |
| `Dockerfile.dev` | Dev container build recipe (text) |
| `docker-compose.yaml` | Production compose stack |
| `docker-compose.dev.yaml` | Dev compose stack |

## 3. Dev environment & tooling

| Path | What it is |
|---|---|
| `.claude/settings.json` | Claude Code project settings |
| `.devcontainer/devcontainer.json` | VS Code dev container definition |

## 4. CI / GitHub automation (`.github/`)

| Path | What it is |
|---|---|
| `.github/copilot-instructions.md` | GitHub Copilot repo instructions |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR template |
| `.github/FUNDING.yaml` | Sponsor links |
| `.github/Dependabot.yml` | Dependabot config |
| `.github/ISSUE_TEMPLATE/config.yml` | Issue template chooser config |
| `.github/ISSUE_TEMPLATE/01_bug_report.yml` | Bug report form |
| `.github/ISSUE_TEMPLATE/02_feature_request.yml` | Feature request form |
| `.github/workflows/build.yml` | Build CI |
| `.github/workflows/build-containers.yml` | Container build CI |
| `.github/workflows/build-extension.yaml` | Extension build CI |
| `.github/workflows/codeql.yml` | CodeQL security scanning |
| `.github/workflows/eslint` | ESLint workflow (no extension) |
| `.github/workflows/issue-label-triggers.yml` | Issue-label automation |
| `.github/workflows/publish-extension.yml` | Extension publish workflow |
| `.github/workflows/staging-conflicts.yml` | Staging conflict detector |
| `.github/workflows/stale.yml` | Stale-issue closer |

## 5. Per-app documentation & config

### `apps/backend/`
- `apps/backend/package.json`
- `apps/backend/tsconfig.json`
- `apps/backend/nest-cli.json`
- `apps/backend/.gitignore`

### `apps/commands/`
- `apps/commands/package.json`
- `apps/commands/tsconfig.json`
- `apps/commands/nest-cli.json`
- `apps/commands/.gitignore`

### `apps/extension/`
- `apps/extension/package.json`
- `apps/extension/tsconfig.json`
- `apps/extension/manifest.json`  ← Chrome MV3 manifest (permissions, entrypoints)
- `apps/extension/manifest.dev.json`
- `apps/extension/.gitignore`

### `apps/frontend/`
- `apps/frontend/README.md`
- `apps/frontend/CLAUDE.md`
- `apps/frontend/AGENTS.md`
- `apps/frontend/package.json`
- `apps/frontend/tsconfig.json`
- `apps/frontend/.gitignore`

> Note: `next.config.js`, `postcss.config.mjs`, `tailwind.config.cjs`, `eslint.config.mjs` are JS/TS *code* configs — excluded per your "no code" filter. `package.json` and `tsconfig.json` are JSON, so kept.

### `apps/orchestrator/`
- `apps/orchestrator/package.json`
- `apps/orchestrator/tsconfig.json`
- `apps/orchestrator/nest-cli.json`
- `apps/orchestrator/.swcrc`
- `apps/orchestrator/.gitignore`

### `apps/sdk/`
- `apps/sdk/README.md`
- `apps/sdk/package.json`
- `apps/sdk/tsconfig.json`
- `apps/sdk/.npmignore`
- `apps/sdk/tsup.config.ts` — *TS config (borderline; skip if strict)*

## 6. Libraries

### `libraries/nestjs-libraries/`
- `libraries/nestjs-libraries/README.md`
- `libraries/nestjs-libraries/package.json` *(not shown in tree but implied — if absent, skip)*
- `libraries/nestjs-libraries/tsconfig.json`
- `libraries/nestjs-libraries/tsconfig.lib.json`
- `libraries/nestjs-libraries/.eslintrc.json`
- **`libraries/nestjs-libraries/src/database/prisma/schema.prisma`** ← the data model — **read this before anything else**

### `libraries/react-shared-libraries/`
- `libraries/react-shared-libraries/README.md`
- `libraries/react-shared-libraries/tsconfig.json`
- `libraries/react-shared-libraries/tsconfig.lib.json`
- `libraries/react-shared-libraries/.eslintrc.json`

## 7. i18n translation data (all under `libraries/react-shared-libraries/src/translation/locales/`)

Each `translation.json` contains every UI string in that language — useful to see the app's feature surface.

- `.../locales/ar/translation.json`
- `.../locales/bn/translation.json`
- `.../locales/de/translation.json`
- `.../locales/en/translation.json`  ← canonical
- `.../locales/es/translation.json`
- `.../locales/fr/translation.json`
- `.../locales/he/translation.json`
- `.../locales/it/translation.json`
- `.../locales/ja/translation.json`
- `.../locales/ka_ge/translation.json`
- `.../locales/ko/translation.json`
- `.../locales/pt/translation.json`
- `.../locales/ru/translation.json`
- `.../locales/tr/translation.json`
- `.../locales/vi/translation.json`
- `.../locales/zh/translation.json`

## 8. Temporal dynamic config

- `dynamicconfig/development-sql.yaml`
- `dynamicconfig/development-cass.yaml`

## 9. Ops / infra

- `var/docker/nginx.conf`  ← reverse proxy config
- `reports/junit.xml`  ← test report output

*(`.sh` scripts in `var/docker/` and `Jenkins/*.Jenkinsfile` are code — excluded per your filter.)*

---

## What I deliberately excluded (and why)

| Category | Examples | Reason |
|---|---|---|
| Source code | `*.ts`, `*.tsx`, `*.js`, `*.mjs`, `*.cjs` (except config-only JSON) | You said "no code" |
| Style files | `*.scss`, `*.css` (except `nginx.conf` which is *server* config) | CSS is source, not "info" |
| Assets | `*.png`, `*.svg`, `*.jpg`, `*.jpeg`, `*.ico`, `*.woff2`, `*.ttf` | Binary/image |
| Shell / Groovy | `*.sh`, `*.Jenkinsfile` | Executable scripts |
| JS/TS config-code | `eslint.config.mjs`, `next.config.js`, `vite.config.*`, `tailwind.config.cjs`, `postcss.config.mjs`, `jest.config.ts`, `jest.preset.js`, `tsup.config.ts`, `custom-vite-plugins.ts`, `i18n.config.ts`, `i18next.ts`, `f.js` | These are code files even though they configure |

---

## Highest-signal files for "I want to understand / modify this app"

If you only read 6 non-code files, read these in order:

1. **`.env.example`** — every knob the app understands (DB, Redis, Temporal, OAuth keys, storage, AI providers).
2. **`libraries/nestjs-libraries/src/database/prisma/schema.prisma`** — the entire data model in one declarative file.
3. **`apps/frontend/CLAUDE.md`** + **`CLAUDE.md`** (root) — feature map + AI-agent orientation notes.
4. **`.github/copilot-instructions.md`** — compact repo conventions.
5. **`docker-compose.yaml`** — the real runtime topology (services, ports, env wiring).
6. **`libraries/react-shared-libraries/src/translation/locales/en/translation.json`** — a de-facto feature inventory of every screen and control.