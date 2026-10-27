# Agentic RAG Worker Subsystem — Production Architecture & Design Specification

## 1. Architectural Shift: Standalone Agentic RAG vs. Orchestrator Worker Component

A standalone Agentic RAG system owns user dialogue, tool routing, retrieval, and final response generation inside one monolithic loop ([Galileo AI](https://galileo.ai/blog/agentic-rag-integration-ai-architecture), [arXiv:2501.09136v4](https://arxiv.org/html/2501.09136v4)). When redesigned as a **Worker Component for a Parent Orchestrator** using the **Orchestrator–Workers** and **Evaluator–Optimizer** patterns ([Anthropic](https://www.anthropic.com/research/building-effective-agents), [InfoQ](https://www.infoq.com/articles/building-hierarchical-agentic-rag-systems/)), responsibilities are strictly partitioned:

| Architectural Dimension | Parent Orchestrator (Supervisor / Session Controller) | Agentic RAG Worker (Sub-Agent / Retrieval Subsystem) |
| :--- | :--- | :--- |
| **Primary Authority** | Owns user conversation history, session state, channel context, and downstream action tools (media, design studio, scheduling) ([Anthropic](https://www.anthropic.com/research/building-effective-agents)). | Owns query decomposition, cache validation, hybrid retrieval, evidence grading, query rewriting, and grounded context assembly ([Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/)). |
| **Context Window Scope** | **L1 Session Context**: Receives only verified, deduplicated passages and citation IDs—never raw search candidates or failed intermediate hops ([Bezen](https://bezen.in/learn/agentic_ai/single-agent-and-multi-agent-systems)). | **Isolated Ephemeral Loop State**: Absorbs 100% of candidate chunks, grading tokens, and query rewrites internally, preventing L1 prompt token inflation ([Swfte](https://www.swfte.com/agentic-rag)). |
| **Model Class Assignment** | **Frontier Model**: Invoked once at the end of the turn to synthesize the final user response or trigger creative/action tools ([Swfte](https://www.swfte.com/agentic-rag)). | **Small, Fast Models (`temperature = 0`)**: Executes classification, routing, grading, and query rewriting at 60–80% lower token cost ([Swfte](https://www.swfte.com/agentic-rag), [Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/)). |
| **Failure Mode Isolation** | Never hallucinates from silent SQL/vector errors because the worker explicitly surfaces `COMPLETE`, `PARTIAL`, or `ABSTAIN` statuses ([InfoQ](https://www.infoq.com/articles/building-hierarchical-agentic-rag-systems/)). | Catches empty results, schema mismatches, and low-relevance chunks internally via reflective retry before returning to the orchestrator ([InfoQ](https://www.infoq.com/articles/building-hierarchical-agentic-rag-systems/)). |

## 2. The 7-Layer Agentic RAG Worker Architecture

```
Parent Orchestrator Call: invoke_rag_worker(query, tenant_scope, filters, budget)
 │
 ▼
[Layer 1: Ingress Gate, Pre-Retrieval RBAC & Validation-Aware Two-Tier Cache]
 ├─ Enforces immutable tenant predicates (organization_id, status = 'PUBLISHED', active version)
 ├─ Temporal / Live-Intent Check: Bypasses cache if query requests "latest" or real-time state
 ├─ Tier 1 Semantic Cache (>= 0.95 cosine similarity + fresh SHA-256 / timestamp validation) ──► Return Verified Payload
 └─ Tier 2 Retrieval Cache (>= 0.70 topic match +freshness check) ──► Seeds Candidate Context & Skips DB Lookup
      │
      ▼
[Layer 2: Adaptive Complexity Classifier & Sub-Query Planner]
 ├─ Simple Single-Fact ──► Direct 1-Pass Hybrid Retrieval (bypasses multi-hop planner)
 └─ Complex / Multi-Hop ─► Decomposes into independent atomic sub-queries (scheduled in parallel)
      │
      ▼
┌───► [Layer 3: Typed Retrieval & Modality Router]
│      ├─ search_topic_index(query, filters): Searches parent document/section summaries
│      ├─ hybrid_chunk_search(query, filters): Dense Vector + BM25 Lexical + RRF Fusion
│      ├─ read_chunk_details(resource_id, chunk_ids): Fetches granular child passages
│      ├─ structured_sql_lookup(parameterized_query): Exact relational/metadata lookup
│      └─ external_web_fallback(query): Optional CRAG fallback when internal corpus misses
│         │
│         ▼
│     [Layer 4: Deduplication & Cross-Encoder Reranking Layer]
│      ├─ Deduplicates candidate chunks across hops by (resource_id, chunk_id, version)
│      └─ Cross-encoder reranks top-N candidates down to top-K high-signal passages
│         │
│         ▼
│     [Layer 5: Evidence Grader (CRAG Relevancy + Sufficiency Gate)]
│      ├─ Dimension 1 (Relevancy): Prunes off-topic knowledge strips below min_relevance_score
│      └─ Dimension 2 (Sufficiency): Verifies if surviving chunks answer all sub-questions
│         ├─ Sufficient OR Max Iterations (3) Reached ──► Exit Loop to Layer 7
│         └─ Insufficient / Ambiguous (Even on Tier 2 Cache Hits -> Triggers Context Fallback)
│             │
│             ▼
│     [Layer 6: Reflective Query Rewriter & Autonomous Error Recovery]
│      ├─ Checks attempted_queries (terminates loop immediately if rewrite is a duplicate)
│      ├─ Rewrites query using missing_information, domain synonyms, or entity IDs from prior hops
│      └─ Repairs filter/schema mismatches via fuzzy metadata matching
└─────────┘ (Loops back to Layer 3; Hard Cap: max_iterations = 3)
          │
          ▼
[Layer 7: Evidence Packager, Citation Serializer & Cache Writer]
 ├─ Populates Tier 1 & Tier 2 caches with SHA-256 content hashes and version/timestamp tags
 └─ Returns { sufficiency_status, verified_chunks[], citations[], missing_information[], diagnostics }
```

### Detailed Specification of Each Worker Layer

#### Layer 1: Ingress Gate, Pre-Retrieval RBAC & Validation-Aware Two-Tier Cache
1. **Pre-Retrieval Authorization Pushdown**: Every lookup inherits the caller's `organization_id`, RBAC scope, and lifecycle filter (`status = 'PUBLISHED'`). These predicates are pushed directly into the database/vector `WHERE` clause before similarity calculation so unauthorized or `DRAFT` records can never be scored or leaked ([Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/), [Galileo AI](https://galileo.ai/blog/agentic-rag-integration-ai-architecture)).
2. **Validation-Aware Two-Tier Caching** ([Towards Data Science](https://towardsdatascience.com/zero-waste-agentic-rag-designing-caching-architectures-to-minimize-latency-and-llm-costs-at-scale/)):
   - **Tier 1 (Query-Level Semantic Cache, $\ge 0.95$ cosine similarity)**: Returns previously verified evidence packs in milliseconds at zero LLM token cost when the query intent and tenant filters match.
   - **Tier 2 (Context-Level Retrieval Cache, $\ge 0.70$ topic similarity)**: Reuses pre-fetched database rows and vector chunks as an in-memory scratchpad when a follow-up query targets the same topic with a different instruction. If the Layer 5 Grader finds the cached context insufficient for a broader follow-up query, it triggers a **Context Fallback** to live retrieval ([Towards Data Science](https://towardsdatascience.com/zero-waste-agentic-rag-designing-caching-architectures-to-minimize-latency-and-llm-costs-at-scale/)).
   - **Five Cache Invalidation & Staleness Strategies** ([Towards Data Science](https://towardsdatascience.com/zero-waste-agentic-rag-designing-caching-architectures-to-minimize-latency-and-llm-costs-at-scale/)):
     - *Temporal Intent Bypass*: Queries containing real-time temporal markers ("latest", "current", "today") bypass caching and hit live stores directly.
     - *Row-Level Timestamp / Version Validation*: Verifies `updated_at` or `version` on cited `resource_id` records before serving a cache hit.
     - *Table-Level `MAX(updated_at)` Validation*: Validates global aggregation queries against the table's latest mutation timestamp.
     - *SHA-256 Data Fingerprinting*: Compares cryptographic content hashes when underlying documents lack reliable timestamps.
     - *Predicate-Slice Validation*: Validates `MAX(updated_at)` strictly within the queried `WHERE` slice so unrelated writes do not flush valid cache entries.

#### Layer 2: Adaptive Complexity Classifier & Sub-Query Planner
- **Complexity Triage (Adaptive RAG)**: A lightweight classifier categorizes the incoming request ([Analytics Vidhya](https://www.analyticsvidhya.com/blog/2025/03/adaptive-rag-systems-with-langgraph/), [arXiv:2501.09136v4](https://arxiv.org/html/2501.09136v4)):
  - **Single-Hop Queries**: Route directly to a single hybrid retrieval pass (`max_iterations = 1`), avoiding multi-step planning overhead.
  - **Multi-Hop / Comparative Queries**: The Planner decomposes the request into independent sub-questions that execute concurrently via parallel graph branches (`Send` API / `Promise.all`) and synchronize before grading ([InfoQ](https://www.infoq.com/articles/building-hierarchical-agentic-rag-systems/), [Anthropic](https://www.anthropic.com/research/building-effective-agents)).

#### Layer 3: Typed Retrieval & Modality Router (Poka-Yoke ACI)
Instead of exposing a single generic search function, the worker routes sub-queries across narrow, strongly typed tools ([Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/), [Anthropic](https://www.anthropic.com/research/building-effective-agents)):
- **`search_topic_index`**: Searches parent document/section summaries to isolate relevant documents without flooding the context window ([Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/)).
- **`hybrid_chunk_search`**: Combines dense vector cosine similarity (`pgvector` / HNSW) with sparse BM25 lexical matching, merging rankings via **Reciprocal Rank Fusion (RRF)** to capture both conceptual meaning and exact product/channel identifiers ([InfoQ](https://www.infoq.com/articles/building-hierarchical-agentic-rag-systems/)).
- **`read_chunk_details`**: Expands specific child chunks by `(resource_id, chunk_id)` once a parent section is identified ([Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/)).
- **`structured_sql_lookup`**: Executes parameterized, read-only relational queries with row/byte caps and pre-execution schema validation ([InfoQ](https://www.infoq.com/articles/building-hierarchical-agentic-rag-systems/)).
- **`external_web_fallback`**: Triggered under Corrective RAG (CRAG) only when internal knowledge returns `INSUFFICIENT` confidence and `include_external_fallback` is enabled ([DataCamp](https://www.datacamp.com/tutorial/corrective-rag-crag)).

#### Layer 4: Deduplication & Cross-Encoder Reranking
- Candidate chunks gathered across parallel sub-queries and iterative hops are deduplicated by `(resource_id, chunk_id, version)` ([Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/)).
- A cross-encoder reranker scores the merged candidate pool against the original query and retains only the top-$K$ passages above `min_relevance_score`, cutting baseline retrieval errors by 50–67% ([Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/)).

#### Layer 5: Evidence Grader (Relevancy + Sufficiency Quality Gate)
- Operating as an **Evaluator–Optimizer** gate ([Anthropic](https://www.anthropic.com/research/building-effective-agents)) combined with **Corrective RAG (CRAG)** ([DataCamp](https://www.datacamp.com/tutorial/corrective-rag-crag)), a structured-output evaluator grades the candidate set on two orthogonal axes ([Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/)):
  1. **Relevancy (Knowledge-Strip Filtering)**: Partitions and strips out irrelevant chunks or off-topic paragraphs so noisy passages are discarded before synthesis ([DataCamp](https://www.datacamp.com/tutorial/corrective-rag-crag), [Swfte](https://www.swfte.com/agentic-rag)).
  2. **Sufficiency (Completeness Check)**: Determines whether the surviving chunks contain all facts required to answer every part of the query. Outputs a structured verdict:
     ```json
     {
       "is_sufficient": false,
       "sufficiency_status": "PARTIAL",
       "relevant_chunk_ids": ["res_88:chk_01@v4"],
       "missing_information": ["Previous Q2 exception rules for Instagram Reels"],
       "next_queries": ["Q2 Instagram Reels compliance exception rules version history"]
     }
     ```

#### Layer 6: Reflective Query Rewriter & Autonomous Error Recovery
- When `is_sufficient == false`, the Reflective Rewriter inspects `original_query`, `attempted_queries`, `missing_information`, and any tool/schema errors ([InfoQ](https://www.infoq.com/articles/building-hierarchical-agentic-rag-systems/), [Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/)):
  - **Multi-Hop Bridging**: Injects entity IDs or terms discovered in Hop 1 into the Hop 2 filter/query (e.g., filtering vector search by IDs returned from a relational lookup) ([Swfte](https://www.swfte.com/agentic-rag)).
  - **Vocabulary Normalization**: Translates user phrasing into domain/corpus terminology ([Swfte](https://www.swfte.com/agentic-rag)).
  - **Reflective Error Recovery**: If a structured query fails due to column/filter mismatch, fuzzy-matches against cached schema metadata (`similarity > 0.8`) and proposes a corrected query instead of failing silently ([InfoQ](https://www.infoq.com/articles/building-hierarchical-agentic-rag-systems/)).

#### Layer 7: Evidence Packager & Return Contract (Worker → Parent Orchestrator)
- Instead of generating prose for the end user, the worker returns a deterministic, compact evidence payload to the Parent Orchestrator containing verified chunks, `[resource_id:chunk_id@vX]` citation handles, `sufficiency_status` (`COMPLETE | PARTIAL | ABSTAIN`), and any unresolved `missing_information` ([Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/), [Bezen](https://bezen.in/learn/agentic_ai/single-agent-and-multi-agent-systems)).

## 3. Data Ingestion, Contextual Chunking & Knowledge Lifecycle (`Add`, `Draft`, `Delete`)

To prevent retrieval degradation, the **Document Management Subsystem** is physically decoupled from the **Agentic RAG Worker** and enforces three ingestion invariants:

1. **Contextual Parent–Child Chunking**:
   - Each document produces a **Parent Summary Record** (for topic routing) and 300–500 token **Child Chunks** ([Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/), [Galileo AI](https://galileo.ai/blog/agentic-rag-integration-ai-architecture)).
   - At ingestion time, a lightweight model prepends a compact document-level header (`[Doc: {title} | Version: v{N} | Channels: {tags} | Context: {1-sentence summary}]`) to each child chunk before computing dense embeddings and BM25 tokens, preserving global context inside every isolated vector ([Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/), [AI Daddy](https://www.aidaddy.tech/learn/06-retrieval-systems/01-rag-fundamentals)).
2. **Strict Lifecycle State Isolation**:
   - **`DRAFT`**: Stored in the relational `KnowledgeResource` table with `status = 'DRAFT'`. Zero chunks exist in `KnowledgeChunk`. Reverting a `PUBLISHED` resource to `DRAFT` executes an atomic transactional purge of all its indexed chunks and invalidates Tier 1/Tier 2 cache entries.
   - **`PUBLISHED` (`Add`)**: Increments `version`, computes `content_hash` (SHA-256), writes contextualized chunks stamped with `(organization_id, resource_id, version, status = 'PUBLISHED')`, and updates the cache fingerprint.
   - **`DELETED` (`Delete`)**: Deletes the `KnowledgeResource` record with database-level `ON DELETE CASCADE` plus explicit vector/chunk deletion and immediate cache invalidation.

## 4. Production Guardrails & Operational Bounds

| Guardrail Category | Concrete Engineering Rule | Target Metric / Bound |
| :--- | :--- | :--- |
| **Loop Step Cap** | Hard-cap the worker control loop; exit with `PARTIAL` or `ABSTAIN` if exceeded ([Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/), [Swfte](https://www.swfte.com/agentic-rag)). | `max_iterations = 3` |
| **Cycle Prevention** | Abort the loop immediately if a proposed `next_query` matches any entry in `attempted_queries` ([Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/)). | `0` duplicate queries per invocation |
| **Per-Tool & Total Timeouts** | Enforce per-tool execution timeouts and a cumulative worker wall-clock budget ([InfoQ](https://www.infoq.com/articles/building-hierarchical-agentic-rag-systems/)). | `1,200 ms` per tool / `4,500 ms` total worker budget |
| **Model Cost Tiering** | Route Classifier, Router, Grader, and Rewriter to small/fast models (`temperature = 0`); reserve frontier LLM for the Parent Orchestrator ([Swfte](https://www.swfte.com/agentic-rag)). | Total cost $\le 1.5\text{–}2.5\times$ single-pass RAG |
| **Context Compaction** | Return only deduplicated, graded chunks (`top_k <= 6`) to the Parent Orchestrator so L1 prompt utilization stays below 70% ([Medium](https://medium.com/@kuldeeparya3794/when-ai-forgets-debugging-and-preventing-memory-failures-in-production-rag-agentic-rag-systems-2bf142193d21)). | $\le 2,500$ tokens returned per worker call |
| **Zero-Trust RBAC & Tenant Scope** | Bind `organization_id` and `status = 'PUBLISHED'` from server-side session context (`AsyncLocalStorage`), never from LLM-supplied tool arguments ([InfoQ](https://www.infoq.com/articles/building-hierarchical-agentic-rag-systems/), [Galileo AI](https://galileo.ai/blog/agentic-rag-integration-ai-architecture)). | 100% pre-retrieval predicate pushdown |

## 5. Concrete Ecosystem Binding for Your Codebase (`postiz-app`)

Answering the three target-environment questions for your project:

1. **Orchestration Framework & Ecosystem**:
   - **TypeScript / NestJS Monorepo (`libraries/nestjs-libraries`)**: The Parent Orchestrator already runs on **Mastra (`MastraService`)** and custom graph orchestration (`AgentGraphService`), while long-running asynchronous ingestion/chunking runs on **Temporal (`apps/orchestrator`)**.
   - **Integration Pattern**: Expose the Agentic RAG Worker as a strongly typed Mastra tool (`KnowledgeRetrieveTool` implementing `AgentToolInterface` in `libraries/nestjs-libraries/src/chat/tools/`) backed by an injectable `KnowledgeWorkerService` that executes the 7-layer bounded loop.
2. **Target Data Sources**:
   - **Unstructured + Vector Store**: PostgreSQL with `pgvector` (HNSW dense embeddings) + PostgreSQL `tsvector` / GIN (BM25 lexical search) fused via RRF in Prisma/SQL, storing `KnowledgeResource` and `KnowledgeChunk`.
   - **Structured Relational Store**: Existing PostgreSQL tables accessed via Prisma repositories (`Integration`, `Post`, `Media`, `Organization`) scoped to `organizationId`.
   - **Cache Store**: Existing **Redis (`RedisService`)** in `libraries/nestjs-libraries/src/redis/redis.service.ts` for Tier 1 Semantic Cache, Tier 2 Retrieval Cache, and SHA-256 / `updated_at` staleness markers.
3. **Latency vs. Accuracy Profile**:
   - **Interactive Studio & Chat Sessions (`/agents/[id]`)**: Target **p95 latency $\le 2.1\text{–}3.5\text{s}$** ([InfoQ](https://www.infoq.com/articles/building-hierarchical-agentic-rag-systems/)) by combining Tier 1/Tier 2 Redis caching ($\sim 20\text{ ms}$ on cache hits) ([Towards Data Science](https://towardsdatascience.com/zero-waste-agentic-rag-designing-caching-architectures-to-minimize-latency-and-llm-costs-at-scale/)), Adaptive 1-hop bypass for simple lookups, and a strict 3-iteration cap with parallel sub-query execution for complex multi-channel queries.



---
---
***
---
---



I've updated the **Agentic RAG Worker Subsystem Architecture** in Canvas (`agentic_rag_specification_and_architecture.md`) and synthesized the complete, research-grounded design below.

### 1. Structural Shift: Standalone Agentic RAG vs. Orchestrator Worker Component

A standalone Agentic RAG system mixes user conversation management, tool routing, retrieval loops, and final answer generation inside one monolithic agent ([Galileo AI](https://galileo.ai/blog/agentic-rag-integration-ai-architecture), [arXiv:2501.09136v4](https://arxiv.org/html/2501.09136v4)). Re-architecting it as a **Worker Component under a Parent Orchestrator** using the **Orchestrator–Workers** and **Evaluator–Optimizer** patterns ([Anthropic](https://www.anthropic.com/research/building-effective-agents), [InfoQ](https://www.infoq.com/articles/building-hierarchical-agentic-rag-systems/)) establishes four strict boundaries:

| Architectural Boundary | Parent Orchestrator (Supervisor / Session Brain) | Agentic RAG Worker (Sub-Agent / Retrieval Engine) |
| --- | --- | --- |
| **Core Authority** | Owns session state, chat history, selected channels, downstream action tools (media, studio, scheduling), and final user synthesis ([Anthropic](https://www.anthropic.com/research/building-effective-agents)). | Owns query decomposition, cache validation, hybrid retrieval, evidence grading, query rewriting, and grounded context assembly ([Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/)). |
| **Memory & Context Isolation** | **L1 Session Memory**: Receives only verified, deduplicated passages and citation IDs (`<= 2,500` tokens), preventing prompt bloat ([Bezen](https://bezen.in/learn/agentic_ai/single-agent-and-multi-agent-systems), [Medium](https://medium.com/@kuldeeparya3794/when-ai-forgets-debugging-and-preventing-memory-failures-in-production-rag-agentic-rag-systems-2bf142193d21)). | **Ephemeral Loop State**: Absorbs 100% of candidate chunks, grading passes, and query rewrites internally and discards noise before returning ([Swfte](https://www.swfte.com/agentic-rag)). |
| **Model Tiering & Economics** | **Frontier LLM**: Invoked once per turn after evidence is collected to synthesize the response or call creative tools ([Swfte](https://www.swfte.com/agentic-rag)). | **Small, Fast LLMs (`temperature = 0`)**: Runs classification, routing, grading, and rewriting at 1.5–2.5x single-pass cost instead of 5–10x ([Swfte](https://www.swfte.com/agentic-rag), [Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/)). |
| **Accuracy & Error Recovery** | Receives an explicit `COMPLETE`, `PARTIAL`, or `ABSTAIN` status so it never guesses over silent retrieval failures ([Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/)). | Catches empty results, vocabulary mismatches, and schema errors internally via reflective retry, raising multi-hop accuracy to **84.5%** (vs. 62.8% flat agent) and cutting hallucinations to **7.1%** (vs. 28.5% standard RAG) ([InfoQ](https://www.infoq.com/articles/building-hierarchical-agentic-rag-systems/)). |

### 2. The 7-Layer Agentic RAG Worker Architecture

| Layer | Worker Module | Deterministic Execution Logic |
| --- | --- | --- |
| **1. Ingress, RBAC & Two-Tier Cache** | **Pre-Retrieval Predicate Gate + Validation-Aware Cache** | Injects immutable server-side predicates (`organization_id`, `status = 'PUBLISHED'`, active `version`) into every lookup before similarity scoring ([Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/), [Galileo AI](https://galileo.ai/blog/agentic-rag-integration-ai-architecture)). Checks **Tier 1 Semantic Cache** ($\ge 0.95$ cosine similarity) for instant $0.02\text{s}$ hits and **Tier 2 Retrieval Cache** ($\ge 0.70$ topic match) to reuse pre-fetched chunks without hitting the database ([Towards Data Science](https://towardsdatascience.com/zero-waste-agentic-rag-designing-caching-architectures-to-minimize-latency-and-llm-costs-at-scale/)). |
| **2. Triage & Planning** | **Adaptive Complexity Classifier & Sub-Query Planner** | Classifies query complexity ([Analytics Vidhya](https://www.analyticsvidhya.com/blog/2025/03/adaptive-rag-systems-with-langgraph/), [arXiv:2501.09136v4](https://arxiv.org/html/2501.09136v4)): single-fact queries run a 1-step hybrid lookup (`max_iterations = 1`); multi-faceted queries decompose into atomic sub-queries scheduled in parallel branches ([InfoQ](https://www.infoq.com/articles/building-hierarchical-agentic-rag-systems/), [Anthropic](https://www.anthropic.com/research/building-effective-agents)). |
| **3. Action Layer** | **Typed Modality & Retrieval Router (Poka-Yoke ACI)** | Dispatches sub-queries across narrow tools ([Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/), [Anthropic](https://www.anthropic.com/research/building-effective-agents)): `search_topic_index` (parent summaries), `hybrid_chunk_search` (Dense vector + BM25 lexical fused via Reciprocal Rank Fusion [RRF]) ([InfoQ](https://www.infoq.com/articles/building-hierarchical-agentic-rag-systems/)), `read_chunk_details` (child chunk expansion), `structured_sql_lookup` (parameterized relational lookup), and optional `external_web_fallback` ([DataCamp](https://www.datacamp.com/tutorial/corrective-rag-crag)). |
| **4. Ranking** | **Deduplicator & Cross-Encoder Reranker** | Deduplicates candidate passages across hops by `(resource_id, chunk_id, version)` and reranks top candidates down to top-$K$ passages above `min_relevance_score`, reducing baseline retrieval failures by **50–67%** ([Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/)). |
| **5. Quality Gate** | **Evidence Grader (CRAG Relevancy + Sufficiency)** | Evaluates candidate passages on two strict axes ([DataCamp](https://www.datacamp.com/tutorial/corrective-rag-crag), [Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/)): (1) **Relevancy**—strips off-topic chunks; (2) **Sufficiency**—verifies if surviving chunks answer every sub-question. If a Tier 2 cache hit lacks coverage for a broader follow-up query, triggers a **Context Fallback** to live search ([Towards Data Science](https://towardsdatascience.com/zero-waste-agentic-rag-designing-caching-architectures-to-minimize-latency-and-llm-costs-at-scale/)). |
| **6. Self-Correction** | **Reflective Query Rewriter & Error Recovery** | If evidence is insufficient, inspects `missing_information`, `attempted_queries`, and tool errors to rewrite the query (bridging entity IDs from Hop 1 into Hop 2, resolving vocabulary mismatches, or fuzzy-matching schema/filter names) before looping back to Layer 3 ([Swfte](https://www.swfte.com/agentic-rag), [InfoQ](https://www.infoq.com/articles/building-hierarchical-agentic-rag-systems/)). |
| **7. Egress Contract** | **Evidence Packager & Cache Writer** | Writes validated results to Tier 1/Tier 2 caches with staleness markers and returns `{ sufficiency_status, verified_chunks[], citations[], missing_information[], diagnostics }` to the Parent Orchestrator ([Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/), [Towards Data Science](https://towardsdatascience.com/zero-waste-agentic-rag-designing-caching-architectures-to-minimize-latency-and-llm-costs-at-scale/)). |

### 3. Critical Infrastructure: Ingestion, Caching & Lifecycle Isolation

1. **Contextual Parent–Child Chunking**:
* Store a **Parent Summary Record** per document/section for fast topic routing and 300–500 token **Child Chunks** for granular evidence ([Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/), [Galileo AI](https://galileo.ai/blog/agentic-rag-integration-ai-architecture)).
* Prepend a contextual summary header (`[Doc: {title} | Version: v{N} | Channels: {tags} | Context: {summary}]`) to every child chunk at ingestion before computing dense embeddings and BM25 tokens so isolated fragments retain global context ([Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/), [AI Daddy](https://www.aidaddy.tech/learn/06-retrieval-systems/01-rag-fundamentals)).


2. **Knowledge Lifecycle Isolation (`Add`, `Draft`, `Delete`)**:
* **`DRAFT`**: Saved in the relational `KnowledgeResource` table with `status = 'DRAFT'`; **zero chunks** exist in `KnowledgeChunk`. Downgrading a `PUBLISHED` resource to `DRAFT` atomically deletes its indexed chunks and invalidates the cache.
* **`PUBLISHED` (`Add`)**: Increments `version`, computes a SHA-256 `content_hash`, indexes contextualized chunks with `status = 'PUBLISHED'`, and updates the cache fingerprint.
* **`DELETED` (`Delete`)**: Deletes the parent record with transactional `ON DELETE CASCADE` on all chunks/embeddings and flushes matching cache keys.


3. **Five Cache Staleness Validation Rules** ([Towards Data Science](https://towardsdatascience.com/zero-waste-agentic-rag-designing-caching-architectures-to-minimize-latency-and-llm-costs-at-scale/)):
* **Temporal Intent Bypass**: Queries asking for `"latest"` or live metrics bypass cache tiers entirely.
* **Row-Level Version/Timestamp Check**: Verifies `version` and `updated_at` on cited `resource_id` rows before serving a cache hit.
* **Table-Level `MAX(updated_at)` Check**: Validates aggregate queries against the table's latest write timestamp.
* **SHA-256 Data Fingerprinting**: Validates cryptographic hashes of underlying document content when timestamps are absent.
* **Predicate-Slice Validation**: Checks `MAX(updated_at)` strictly within the queried `WHERE` filter slice (e.g., a specific channel or date range) so unrelated writes do not invalidate valid cache entries.



### 4. Production Guardrails & Target Ecosystem Answers

| Guardrail / Target Dimension | Concrete Specification |
| --- | --- |
| **Loop & Cycle Termination** | Hard-cap at `max_iterations = 3`; abort immediately if any `next_query` matches `attempted_queries` ([Regolo.AI](https://regolo.ai/agentic-rag-tutorial-build-retrieval-that-reasons/), [Swfte](https://www.swfte.com/agentic-rag)). |
| **Timeout & Budget Bounds** | `1,200 ms` timeout per retrieval tool call; `4,500 ms` total wall-clock worker budget; return `PARTIAL` or `ABSTAIN` on timeout ([InfoQ](https://www.infoq.com/articles/building-hierarchical-agentic-rag-systems/)). |
| **Target Orchestration Ecosystem** | **TypeScript / NestJS + Mastra (`MastraService` / `AgentGraphService`) + Temporal (`apps/orchestrator`)**: Expose the worker as a typed Mastra tool (`KnowledgeRetrieveTool`) for synchronous chat/studio retrieval, and offload heavy document chunking/embedding to Temporal activities. |
| **Target Data Sources** | **PostgreSQL (`pgvector` HNSW + `tsvector` BM25 RRF)** for `KnowledgeResource` and `KnowledgeChunk`, **Prisma SQL repositories** for structured channel/post metadata, and **Redis (`RedisService`)** for Tier 1/Tier 2 caching. |
| **Latency vs. Accuracy Profile** | Sub-50 ms on Redis Tier 1 cache hits ([Towards Data Science](https://towardsdatascience.com/zero-waste-agentic-rag-designing-caching-architectures-to-minimize-latency-and-llm-costs-at-scale/)), `< 1.0s` on 1-hop Adaptive lookups, and `2.1–3.5s` p95 on multi-hop corrective queries ([InfoQ](https://www.infoq.com/articles/building-hierarchical-agentic-rag-systems/)). |

Let me know when you're ready to trace the exact Prisma schema (`KnowledgeResource` / `KnowledgeChunk`) and TypeScript worker implementation for `libraries/nestjs-libraries`.