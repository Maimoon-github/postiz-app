import { Injectable } from '@nestjs/common';
import crypto from 'crypto';
import { KnowledgeRepository } from './knowledge.repository';
import {
  QueryKnowledgeDto,
  RetrieveKnowledgeInputDto,
  UpsertKnowledgeDto,
} from '@gitroom/nestjs-libraries/dtos/knowledge/knowledge.dto';
import { OpenaiService } from '@gitroom/nestjs-libraries/openai/openai.service';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';

export interface VerifiedChunk {
  id: string;
  resourceId: string;
  version: number;
  title: string;
  contextualText: string;
  score: number;
  citation: string;
}

export interface RetrievalResult {
  sufficiencyStatus: 'COMPLETE' | 'PARTIAL' | 'ABSTAIN';
  verifiedChunks: VerifiedChunk[];
  citations: string[];
  missingInformation: string[];
  diagnostics: {
    iterations: number;
    cacheHit: 'tier1' | 'tier2' | 'none';
    durationMs: number;
    queryCount: number;
  };
}

@Injectable()
export class KnowledgeService {
  private readonly HOP_TIMEOUT_MS = 1200;
  private readonly TOTAL_BUDGET_MS = 4500;
  private readonly MAX_ITERATIONS = 3;
  private readonly MAX_EVIDENCE_TOKENS = 2500;

  constructor(
    private _knowledgeRepository: KnowledgeRepository,
    private _openaiService: OpenaiService
  ) {}

  // ---------------------------------------------------------------------------
  // DOCUMENT MANAGEMENT SUBSYSTEM
  // ---------------------------------------------------------------------------

  async saveDraft(organizationId: string, dto: UpsertKnowledgeDto) {
    const contentHash = this._computeHash(dto.content);
    let resource;

    if (dto.id) {
      const existing = await this._knowledgeRepository.getResourceById(
        organizationId,
        dto.id
      );
      const nextVersion = existing ? existing.version + 1 : 1;
      resource = await this._knowledgeRepository.updateResource(
        organizationId,
        dto.id,
        {
          title: dto.title,
          content: dto.content,
          status: 'DRAFT',
          version: nextVersion,
          contentHash,
          channelIdentifiers: dto.channelIdentifiers || [],
          tags: dto.tags || [],
        }
      );
    } else {
      resource = await this._knowledgeRepository.createResource(organizationId, {
        title: dto.title,
        content: dto.content,
        status: 'DRAFT',
        version: 1,
        contentHash,
        channelIdentifiers: dto.channelIdentifiers || [],
        tags: dto.tags || [],
      });
    }

    // Invariant: DRAFT resources must produce ZERO chunks in KnowledgeChunk
    await this._knowledgeRepository.deleteChunksForResource(
      organizationId,
      resource.id
    );

    // Invalidate tenant Redis caches
    await this._invalidateTenantCache(organizationId);

    return resource;
  }

  async publish(organizationId: string, dto: UpsertKnowledgeDto) {
    const contentHash = this._computeHash(dto.content);
    const summary = await this._openaiService.generateSummary(
      dto.content,
      dto.title
    );

    let resource;
    let targetVersion = 1;

    if (dto.id) {
      const existing = await this._knowledgeRepository.getResourceById(
        organizationId,
        dto.id
      );
      targetVersion = existing ? existing.version + 1 : 1;
      resource = await this._knowledgeRepository.updateResource(
        organizationId,
        dto.id,
        {
          title: dto.title,
          content: dto.content,
          summary,
          status: 'PUBLISHED',
          version: targetVersion,
          contentHash,
          channelIdentifiers: dto.channelIdentifiers || [],
          tags: dto.tags || [],
        }
      );
    } else {
      resource = await this._knowledgeRepository.createResource(organizationId, {
        title: dto.title,
        content: dto.content,
        summary,
        status: 'PUBLISHED',
        version: 1,
        contentHash,
        channelIdentifiers: dto.channelIdentifiers || [],
        tags: dto.tags || [],
      });
      targetVersion = 1;
    }

    // Purge old chunks for this resource before inserting new ones
    await this._knowledgeRepository.deleteChunksForResource(
      organizationId,
      resource.id
    );

    // Chunk and embed
    const rawChunks = this._contextualChunkContent(
      dto.content,
      dto.title,
      targetVersion,
      dto.channelIdentifiers || [],
      summary
    );

    const chunkEntities = await Promise.all(
      rawChunks.map(async (chunkText, index) => {
        const embedding = await this._openaiService.getEmbedding(chunkText);
        return {
          resourceId: resource.id,
          organizationId,
          chunkIndex: index,
          version: targetVersion,
          contextualText: chunkText,
          embedding,
        };
      })
    );

    await this._knowledgeRepository.createChunks(chunkEntities);

    // Invalidate and update staleness marker
    await this._invalidateTenantCache(organizationId);
    await this._setMetaTimestamp(organizationId);

    return resource;
  }

  async updateStatus(
    organizationId: string,
    id: string,
    status: 'DRAFT' | 'PUBLISHED'
  ) {
    const existing = await this._knowledgeRepository.getResourceById(
      organizationId,
      id
    );
    if (!existing) {
      throw new Error(`Knowledge resource ${id} not found`);
    }

    if (status === 'DRAFT') {
      const resource = await this._knowledgeRepository.updateResource(
        organizationId,
        id,
        {
          status: 'DRAFT',
          version: existing.version + 1,
        }
      );
      await this._knowledgeRepository.deleteChunksForResource(
        organizationId,
        id
      );
      await this._invalidateTenantCache(organizationId);
      return resource;
    }

    return this.publish(organizationId, {
      id: existing.id,
      title: existing.title,
      content: existing.content,
      channelIdentifiers: existing.channelIdentifiers,
      tags: existing.tags,
      status: 'PUBLISHED' as any,
    });
  }

  async delete(organizationId: string, id: string) {
    const deleted = await this._knowledgeRepository.deleteResource(
      organizationId,
      id
    );
    await this._invalidateTenantCache(organizationId);
    return deleted;
  }

  async get(organizationId: string, id: string) {
    return this._knowledgeRepository.getResourceById(organizationId, id);
  }

  async list(organizationId: string, query: QueryKnowledgeDto) {
    const take = query.limit || 20;
    const skip = ((query.page || 1) - 1) * take;

    const [items, total] = await Promise.all([
      this._knowledgeRepository.listResources(organizationId, {
        status: query.status,
        search: query.search,
        channel: query.channel,
        take,
        skip,
      }),
      this._knowledgeRepository.countResources(organizationId, {
        status: query.status,
        search: query.search,
        channel: query.channel,
      }),
    ]);

    return {
      items,
      total,
      page: query.page || 1,
      totalPages: Math.ceil(total / take) || 1,
    };
  }

  // ---------------------------------------------------------------------------
  // 7-LAYER AGENTIC RAG WORKER SUBSYSTEM
  // ---------------------------------------------------------------------------

  async retrieveForOrchestrator(
    organizationId: string,
    input: RetrieveKnowledgeInputDto
  ): Promise<RetrievalResult> {
    const startTime = Date.now();
    const query = input.query.trim();
    const topK = input.topK || 6;
    const minScore = input.minScore || 0.72;
    const channelIdentifiers = input.channelIdentifiers || [];

    let cacheHitStatus: 'tier1' | 'tier2' | 'none' = 'none';

    // -------------------------------------------------------------------------
    // Layer 1: Ingress Gate, Pre-Retrieval RBAC & Two-Tier Cache Check
    // -------------------------------------------------------------------------
    const isTemporalQuery = this._isTemporalQuery(query);

    if (!isTemporalQuery) {
      // Tier 1 Semantic Cache Check (>= 0.95 similarity)
      const t1Cached = await this._checkTier1Cache(organizationId, query);
      if (t1Cached) {
        return {
          ...t1Cached,
          diagnostics: {
            iterations: 1,
            cacheHit: 'tier1',
            durationMs: Date.now() - startTime,
            queryCount: 1,
          },
        };
      }
    }

    // Pre-retrieval authorization pushdown: Fetch candidate chunks
    // where organizationId matches, resource.status == 'PUBLISHED', and chunk.version == resource.version
    const allPublishedChunks =
      await this._knowledgeRepository.findPublishedChunks(
        organizationId,
        channelIdentifiers
      );

    // Active version isolation filter
    const validChunks = allPublishedChunks.filter(
      (c: any) => c.version === c.resource.version && c.resource.status === 'PUBLISHED'
    );

    if (validChunks.length === 0) {
      return {
        sufficiencyStatus: 'ABSTAIN',
        verifiedChunks: [],
        citations: [],
        missingInformation: ['No published knowledge resources found for this organization'],
        diagnostics: {
          iterations: 1,
          cacheHit: 'none',
          durationMs: Date.now() - startTime,
          queryCount: 1,
        },
      };
    }

    // -------------------------------------------------------------------------
    // Layer 2: Adaptive Complexity Classifier & Sub-Query Planner
    // -------------------------------------------------------------------------
    const { isComplex, subQueries } =
      await this._openaiService.classifyQueryComplexity(query);

    const plannedQueries = isComplex ? subQueries : [query];
    const attemptedQueries = new Set<string>();
    let candidatePool: Array<{ chunk: (typeof validChunks)[0]; score: number }> =
      [];

    let iteration = 0;
    let sufficiencyStatus: 'COMPLETE' | 'PARTIAL' | 'ABSTAIN' = 'PARTIAL';
    let missingInfo: string[] = [];

    // Worker Control Loop (Bounded: max_iterations = 3, budget = 4500ms)
    while (iteration < this.MAX_ITERATIONS) {
      iteration++;

      // Wall-clock budget safeguard
      if (Date.now() - startTime > this.TOTAL_BUDGET_MS - 200) {
        break;
      }

      const currentQueries =
        iteration === 1
          ? plannedQueries
          : [
              await this._openaiService.rewriteQuery(
                query,
                missingInfo,
                Array.from(attemptedQueries)
              ),
            ];

      // Layer 6 Guardrail: Cycle Prevention (Abort if duplicate query generated)
      const newQueries = currentQueries.filter((q) => !attemptedQueries.has(q));
      if (newQueries.length === 0) {
        break;
      }
      newQueries.forEach((q) => attemptedQueries.add(q));

      // -----------------------------------------------------------------------
      // Layer 3: Typed Retrieval & Hybrid RRF Search
      // -----------------------------------------------------------------------
      const hopPromises = newQueries.map(async (subQ) => {
        return this._executeHopWithTimeout(
          () => this._hybridRrfSearch(subQ, validChunks),
          this.HOP_TIMEOUT_MS
        );
      });

      const hopResults = await Promise.all(hopPromises);
      for (const res of hopResults) {
        candidatePool.push(...res);
      }

      // -----------------------------------------------------------------------
      // Layer 4: Deduplication & Reranking
      // -----------------------------------------------------------------------
      const dedupedMap = new Map<string, (typeof candidatePool)[0]>();
      for (const item of candidatePool) {
        const key = `${item.chunk.resourceId}:${item.chunk.id}@v${item.chunk.version}`;
        const existing = dedupedMap.get(key);
        if (!existing || item.score > existing.score) {
          dedupedMap.set(key, item);
        }
      }

      // Sort and filter above minScore
      const ranked = Array.from(dedupedMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      // -----------------------------------------------------------------------
      // Layer 5: Evidence Grader (CRAG Relevancy + Sufficiency Gate)
      // -----------------------------------------------------------------------
      const graderChunks = ranked.map((r) => ({
        id: `${r.chunk.resourceId}:${r.chunk.id}@v${r.chunk.version}`,
        text: r.chunk.contextualText,
      }));

      const grade = await this._openaiService.gradeEvidence(query, graderChunks);

      sufficiencyStatus = grade.status;
      missingInfo = grade.missingInfo;

      // Filter off-topic chunks based on relevancy
      candidatePool = ranked.filter((r) =>
        grade.relevantChunkIds.includes(
          `${r.chunk.resourceId}:${r.chunk.id}@v${r.chunk.version}`
        )
      );

      // Quality Gate: Exit loop if evidence is sufficient or single-hop
      if (grade.isSufficient || !isComplex) {
        break;
      }
    }

    // -------------------------------------------------------------------------
    // Layer 7: Evidence Packager, Citation Serializer & Cache Writer
    // -------------------------------------------------------------------------
    const finalChunks = candidatePool
      .filter((c) => c.score >= minScore)
      .slice(0, topK);

    let tokenAccumulator = 0;
    const verifiedChunks: VerifiedChunk[] = [];
    const citations: string[] = [];

    for (const item of finalChunks) {
      const citation = `[${item.chunk.resourceId}:${item.chunk.id}@v${item.chunk.version}]`;
      const estimatedTokens = Math.ceil(item.chunk.contextualText.length / 4);

      if (tokenAccumulator + estimatedTokens > this.MAX_EVIDENCE_TOKENS) {
        break;
      }

      tokenAccumulator += estimatedTokens;
      citations.push(citation);
      verifiedChunks.push({
        id: item.chunk.id,
        resourceId: item.chunk.resourceId,
        version: item.chunk.version,
        title: item.chunk.resource.title,
        contextualText: item.chunk.contextualText,
        score: Number(item.score.toFixed(4)),
        citation,
      });
    }

    if (verifiedChunks.length === 0 && sufficiencyStatus !== 'COMPLETE') {
      sufficiencyStatus = 'ABSTAIN';
    }

    const payload: RetrievalResult = {
      sufficiencyStatus,
      verifiedChunks,
      citations,
      missingInformation: missingInfo,
      diagnostics: {
        iterations: iteration,
        cacheHit: cacheHitStatus,
        durationMs: Date.now() - startTime,
        queryCount: attemptedQueries.size,
      },
    };

    // Cache verified payload if sufficient and not temporal
    if (sufficiencyStatus === 'COMPLETE' && !isTemporalQuery) {
      await this._writeTier1Cache(organizationId, query, payload);
    }

    return payload;
  }

  // ---------------------------------------------------------------------------
  // HELPER METHODS: CHUNKING, RRF, CACHING
  // ---------------------------------------------------------------------------

  private _contextualChunkContent(
    content: string,
    title: string,
    version: number,
    channels: string[],
    summary: string
  ): string[] {
    const targetChunkSize = 1200; // ~300-400 words
    const overlap = 200;
    const cleanContent = content.trim();

    if (cleanContent.length <= targetChunkSize) {
      return [
        `[Doc: ${title} | Version: v${version} | Channels: ${
          channels.join(',') || 'all'
        } | Summary: ${summary}]\n${cleanContent}`,
      ];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < cleanContent.length) {
      let end = start + targetChunkSize;
      if (end < cleanContent.length) {
        // Break cleanly on paragraph or sentence boundary
        const nextBreak = cleanContent.indexOf('\n\n', end - 150);
        if (nextBreak !== -1 && nextBreak <= end + 150) {
          end = nextBreak;
        } else {
          const nextPeriod = cleanContent.indexOf('. ', end - 100);
          if (nextPeriod !== -1 && nextPeriod <= end + 100) {
            end = nextPeriod + 1;
          }
        }
      }

      const slice = cleanContent.slice(start, end).trim();
      if (slice) {
        chunks.push(
          `[Doc: ${title} | Version: v${version} | Channels: ${
            channels.join(',') || 'all'
          } | Summary: ${summary}]\n${slice}`
        );
      }

      start = end - overlap;
      if (start >= cleanContent.length - overlap) break;
    }

    return chunks;
  }

  private async _hybridRrfSearch(
    subQuery: string,
    chunks: any[]
  ) {
    const queryVector = await this._openaiService.getEmbedding(subQuery);
    const queryTokens = this._tokenize(subQuery);

    // 1. Dense Cosine Similarity
    const denseRanked = chunks
      .map((chunk) => {
        const sim = this._cosineSimilarity(queryVector, chunk.embedding);
        return { chunk, sim };
      })
      .sort((a, b) => b.sim - a.sim);

    const denseRankMap = new Map<string, number>();
    denseRanked.forEach((item, idx) => {
      denseRankMap.set(item.chunk.id, idx + 1);
    });

    // 2. BM25 Lexical Scoring
    const sparseRanked = chunks
      .map((chunk) => {
        const score = this._bm25Score(queryTokens, chunk.contextualText);
        return { chunk, score };
      })
      .sort((a, b) => b.score - a.score);

    const sparseRankMap = new Map<string, number>();
    sparseRanked.forEach((item, idx) => {
      sparseRankMap.set(item.chunk.id, idx + 1);
    });

    // 3. Reciprocal Rank Fusion (RRF: k=60)
    const k = 60;
    return chunks.map((chunk) => {
      const denseRank = denseRankMap.get(chunk.id) || 1000;
      const sparseRank = sparseRankMap.get(chunk.id) || 1000;
      const rrf = 1 / (k + denseRank) + 1 / (k + sparseRank);

      // Normalize combined score to ~[0, 1]
      const denseSim = this._cosineSimilarity(queryVector, chunk.embedding);
      const compositeScore = Math.min(1, rrf * 30 * 0.4 + denseSim * 0.6);

      return {
        chunk,
        score: compositeScore,
      };
    });
  }

  private _cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA?.length || !vecB?.length || vecA.length !== vecB.length) {
      return 0;
    }
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : Math.max(0, dot / denom);
  }

  private _bm25Score(queryTokens: string[], text: string): number {
    const textTokens = this._tokenize(text);
    if (!textTokens.length || !queryTokens.length) return 0;

    let matches = 0;
    for (const qt of queryTokens) {
      const count = textTokens.filter((tt) => tt === qt).length;
      if (count > 0) {
        matches += 1 + Math.log(count);
      }
    }

    return matches / (queryTokens.length + textTokens.length * 0.05);
  }

  private _tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);
  }

  private async _executeHopWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Retrieval hop timeout')), timeoutMs)
      ),
    ]).catch(() => [] as unknown as T);
  }

  private _isTemporalQuery(query: string): boolean {
    const temporalMarkers = ['latest', 'today', 'current', 'real-time', 'now', 'recent'];
    const lower = query.toLowerCase();
    return temporalMarkers.some((m) => lower.includes(m));
  }

  private _computeHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  // ---------------------------------------------------------------------------
  // REDIS TWO-TIER CACHE HELPERS
  // ---------------------------------------------------------------------------

  private async _checkTier1Cache(
    orgId: string,
    query: string
  ): Promise<RetrievalResult | null> {
    try {
      const key = `rag:t1:${orgId}:${this._computeHash(query)}`;
      const cached = await ioRedis.get(key);
      if (!cached) return null;

      const data = JSON.parse(cached);

      // Validate cache staleness against tenant latest mutation timestamp
      const latestMeta = await ioRedis.get(`rag:meta:${orgId}`);
      if (latestMeta && Number(latestMeta) > data.timestamp) {
        await ioRedis.del(key);
        return null;
      }

      return data.payload;
    } catch (err) {
      return null;
    }
  }

  private async _writeTier1Cache(
    orgId: string,
    query: string,
    payload: RetrievalResult
  ) {
    try {
      const key = `rag:t1:${orgId}:${this._computeHash(query)}`;
      await ioRedis.set(
        key,
        JSON.stringify({
          payload,
          timestamp: Date.now(),
        }),
        'EX',
        3600 // 1 hour TTL
      );

      // Track key in tenant index for deterministic invalidation
      await ioRedis.rpush(`rag:keys:${orgId}`, key);
      await ioRedis.expire(`rag:keys:${orgId}`, 86400);
    } catch (err) {}
  }

  private async _invalidateTenantCache(organizationId: string) {
    try {
      const keys = await ioRedis.lrange(`rag:keys:${organizationId}`, 0, -1);
      if (keys && keys.length > 0) {
        for (const k of keys) {
          await ioRedis.del(k);
        }
      }
      await ioRedis.del(`rag:keys:${organizationId}`);
      await ioRedis.set(`rag:meta:${organizationId}`, Date.now().toString());
    } catch (err) {}
  }

  private async _setMetaTimestamp(organizationId: string) {
    try {
      await ioRedis.set(`rag:meta:${organizationId}`, Date.now().toString());
    } catch (err) {}
  }
}
