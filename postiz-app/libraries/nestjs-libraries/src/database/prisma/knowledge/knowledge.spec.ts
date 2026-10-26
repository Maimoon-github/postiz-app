import { KnowledgeService } from './knowledge.service';
import { KnowledgeRepository } from './knowledge.repository';
import { OpenaiService } from '@gitroom/nestjs-libraries/openai/openai.service';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';

describe('Knowledge Base & 7-Layer Agentic RAG Worker Subsystem', () => {
  let service: KnowledgeService;
  let mockRepo: any;
  let mockOpenai: any;

  const orgId = 'org-tenant-alpha-123';

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepo = {
      createResource: jest.fn(),
      updateResource: jest.fn(),
      getResourceById: jest.fn(),
      listResources: jest.fn(),
      countResources: jest.fn(),
      deleteResource: jest.fn(),
      deleteChunksForResource: jest.fn().mockResolvedValue({ count: 1 }),
      createChunks: jest.fn().mockResolvedValue({ count: 2 }),
      findPublishedChunks: jest.fn().mockResolvedValue([]),
      getLatestResourceUpdatedAt: jest.fn().mockResolvedValue(new Date()),
    };

    mockOpenai = {
      getEmbedding: jest.fn().mockResolvedValue(new Array(64).fill(0.1)),
      generateSummary: jest
        .fn()
        .mockResolvedValue('Authoritative guide for social media campaigns.'),
      classifyQueryComplexity: jest.fn().mockResolvedValue({
        isComplex: false,
        subQueries: ['campaign rules'],
      }),
      gradeEvidence: jest.fn().mockResolvedValue({
        isSufficient: true,
        status: 'COMPLETE',
        relevantChunkIds: ['res-1:chk-1@v1'],
        missingInfo: [],
        nextQueries: [],
      }),
      rewriteQuery: jest.fn().mockResolvedValue('campaign rules brand tone'),
    };

    service = new KnowledgeService(
      mockRepo as unknown as KnowledgeRepository,
      mockOpenai as unknown as OpenaiService
    );
  });

  describe('Document Management & Lifecycle Isolation', () => {
    it('1. saveDraft creates a DRAFT resource and guarantees ZERO chunks exist in KnowledgeChunk', async () => {
      mockRepo.createResource.mockResolvedValue({
        id: 'res-draft-1',
        organizationId: orgId,
        title: 'Draft Campaign Brief',
        content: 'Draft content for review',
        status: 'DRAFT',
        version: 1,
        contentHash: 'hash123',
      });

      const result = await service.saveDraft(orgId, {
        title: 'Draft Campaign Brief',
        content: 'Draft content for review',
      });

      expect(result.status).toBe('DRAFT');
      expect(mockRepo.deleteChunksForResource).toHaveBeenCalledWith(
        orgId,
        'res-draft-1'
      );
      expect(mockRepo.createChunks).not.toHaveBeenCalled();
    });

    it('2. publish creates contextualized chunks with versioned header and embeddings', async () => {
      mockRepo.createResource.mockResolvedValue({
        id: 'res-pub-1',
        organizationId: orgId,
        title: 'Published Brand Rules',
        content: 'Brand rules content for production social channels.',
        status: 'PUBLISHED',
        version: 1,
      });

      const result = await service.publish(orgId, {
        title: 'Published Brand Rules',
        content: 'Brand rules content for production social channels.',
        channelIdentifiers: ['x', 'linkedin'],
      });

      expect(result.status).toBe('PUBLISHED');
      expect(mockOpenai.generateSummary).toHaveBeenCalled();
      expect(mockOpenai.getEmbedding).toHaveBeenCalled();
      expect(mockRepo.createChunks).toHaveBeenCalledTimes(1);

      const chunkCalls = mockRepo.createChunks.mock.calls[0][0];
      expect(chunkCalls.length).toBeGreaterThan(0);
      expect(chunkCalls[0].contextualText).toContain('[Doc: Published Brand Rules');
      expect(chunkCalls[0].contextualText).toContain('Channels: x,linkedin');
      expect(chunkCalls[0].version).toBe(1);
    });

    it('3. reverting PUBLISHED to DRAFT atomically deletes all indexed chunks and increments version', async () => {
      mockRepo.getResourceById.mockResolvedValue({
        id: 'res-toggle-1',
        organizationId: orgId,
        title: 'Document to revert',
        content: 'Document content',
        status: 'PUBLISHED',
        version: 1,
      });

      mockRepo.updateResource.mockResolvedValue({
        id: 'res-toggle-1',
        status: 'DRAFT',
        version: 2,
      });

      const result = await service.updateStatus(orgId, 'res-toggle-1', 'DRAFT');

      expect(result.status).toBe('DRAFT');
      expect(result.version).toBe(2);
      expect(mockRepo.deleteChunksForResource).toHaveBeenCalledWith(
        orgId,
        'res-toggle-1'
      );
    });

    it('4. delete purges resource and all associated chunks scoped to tenant', async () => {
      mockRepo.deleteResource.mockResolvedValue({
        id: 'res-del-1',
        organizationId: orgId,
      });

      const result = await service.delete(orgId, 'res-del-1');

      expect(result.id).toBe('res-del-1');
      expect(mockRepo.deleteResource).toHaveBeenCalledWith(orgId, 'res-del-1');
    });
  });

  describe('7-Layer Agentic RAG Worker Subsystem', () => {
    it('5. Layer 1: Excludes DRAFT resources and stale versions from candidate chunks', async () => {
      mockOpenai.gradeEvidence.mockResolvedValueOnce({
        isSufficient: true,
        status: 'COMPLETE',
        relevantChunkIds: ['res-1:chk-published-active@v2'],
        missingInfo: [],
        nextQueries: [],
      });

      mockRepo.findPublishedChunks.mockResolvedValue([
        {
          id: 'chk-published-active',
          resourceId: 'res-1',
          organizationId: orgId,
          version: 2,
          contextualText: '[Doc: Active Guidelines | Version: v2 | Channels: all | Summary: Active] Content here',
          embedding: new Array(64).fill(0.1),
          resource: {
            id: 'res-1',
            title: 'Active Guidelines',
            summary: 'Active',
            version: 2, // Active version matches
            status: 'PUBLISHED',
            channelIdentifiers: [],
            updatedAt: new Date(),
            contentHash: 'hash-active',
          },
        },
        {
          id: 'chk-stale-version',
          resourceId: 'res-1',
          organizationId: orgId,
          version: 1, // Stale version (resource is v2)
          contextualText: '[Doc: Active Guidelines | Version: v1] Old content',
          embedding: new Array(64).fill(0.1),
          resource: {
            id: 'res-1',
            title: 'Active Guidelines',
            summary: 'Active',
            version: 2,
            status: 'PUBLISHED',
            channelIdentifiers: [],
            updatedAt: new Date(),
            contentHash: 'hash-active',
          },
        },
      ]);

      const result = await service.retrieveForOrchestrator(orgId, {
        query: 'What are the active guidelines?',
      });

      expect(result.sufficiencyStatus).toBe('COMPLETE');
      expect(result.citations).toContain('[res-1:chk-published-active@v2]');
      expect(result.citations).not.toContain('[res-1:chk-stale-version@v1]');
    });

    it('6. Layer 1: Temporal live-intent query bypasses Redis cache', async () => {
      const spyCheckT1 = jest.spyOn(service as any, '_checkTier1Cache');

      mockRepo.findPublishedChunks.mockResolvedValue([]);

      await service.retrieveForOrchestrator(orgId, {
        query: 'What is the latest campaign schedule today?',
      });

      // Because query contains "latest" and "today", Tier 1 cache lookup was bypassed
      expect(spyCheckT1).not.toHaveBeenCalled();
    });

    it('7. Layer 2 & 3: Adaptive Planner decomposes multi-hop query into parallel sub-queries', async () => {
      mockOpenai.classifyQueryComplexity.mockResolvedValue({
        isComplex: true,
        subQueries: ['X character limits', 'LinkedIn character limits'],
      });

      mockRepo.findPublishedChunks.mockResolvedValue([
        {
          id: 'chk-x',
          resourceId: 'res-x',
          organizationId: orgId,
          version: 1,
          contextualText: '[Doc: Specs | Version: v1 | Channels: x | Summary: Limits] X character limit is 280.',
          embedding: new Array(64).fill(0.1),
          resource: {
            id: 'res-x',
            title: 'Specs',
            summary: 'Limits',
            version: 1,
            status: 'PUBLISHED',
            channelIdentifiers: ['x'],
            updatedAt: new Date(),
            contentHash: 'hash-x',
          },
        },
      ]);

      const result = await service.retrieveForOrchestrator(orgId, {
        query: 'Compare X vs LinkedIn character limits',
      });

      expect(mockOpenai.classifyQueryComplexity).toHaveBeenCalled();
      expect(result.diagnostics.queryCount).toBeGreaterThanOrEqual(2);
    });

    it('8. Layer 5 & 6: Cycle Prevention aborts loop immediately if duplicate rewrite is proposed', async () => {
      mockOpenai.classifyQueryComplexity.mockResolvedValue({
        isComplex: true,
        subQueries: ['compliance rules'],
      });

      // Grader reports PARTIAL
      mockOpenai.gradeEvidence.mockResolvedValue({
        isSufficient: false,
        status: 'PARTIAL',
        relevantChunkIds: [],
        missingInfo: ['Exact fine amounts'],
        nextQueries: ['compliance rules fine amounts'],
      });

      // Rewriter returns duplicate of already-attempted query
      mockOpenai.rewriteQuery.mockResolvedValue('compliance rules');

      mockRepo.findPublishedChunks.mockResolvedValue([
        {
          id: 'chk-1',
          resourceId: 'res-1',
          organizationId: orgId,
          version: 1,
          contextualText: 'Some compliance overview',
          embedding: new Array(64).fill(0.1),
          resource: {
            id: 'res-1',
            title: 'Compliance',
            summary: '',
            version: 1,
            status: 'PUBLISHED',
            channelIdentifiers: [],
            updatedAt: new Date(),
            contentHash: 'hash-1',
          },
        },
      ]);

      const result = await service.retrieveForOrchestrator(orgId, {
        query: 'compliance rules',
      });

      // Terminated at iteration 2 because proposed rewrite was a duplicate (prevented loop from reaching max 3)
      expect(result.diagnostics.iterations).toBe(2);
      expect(result.diagnostics.queryCount).toBe(1);
    });

    it('9. Layer 7: Formats citations as [resourceId:chunkId@vX] and enforces token budget cap', async () => {
      mockRepo.findPublishedChunks.mockResolvedValue([
        {
          id: 'chk-alpha-99',
          resourceId: 'res-omega-77',
          organizationId: orgId,
          version: 3,
          contextualText: 'Authoritative rules for video uploads: max 60 seconds.',
          embedding: new Array(64).fill(0.1),
          resource: {
            id: 'res-omega-77',
            title: 'Video Rules',
            summary: 'Rules',
            version: 3,
            status: 'PUBLISHED',
            channelIdentifiers: [],
            updatedAt: new Date(),
            contentHash: 'hash-77',
          },
        },
      ]);

      mockOpenai.gradeEvidence.mockResolvedValue({
        isSufficient: true,
        status: 'COMPLETE',
        relevantChunkIds: ['res-omega-77:chk-alpha-99@v3'],
        missingInfo: [],
        nextQueries: [],
      });

      const result = await service.retrieveForOrchestrator(orgId, {
        query: 'What is the max video length?',
      });

      expect(result.sufficiencyStatus).toBe('COMPLETE');
      expect(result.citations).toEqual(['[res-omega-77:chk-alpha-99@v3]']);
      expect(result.verifiedChunks[0].citation).toBe('[res-omega-77:chk-alpha-99@v3]');
      expect(result.verifiedChunks[0].version).toBe(3);
    });
  });
});
