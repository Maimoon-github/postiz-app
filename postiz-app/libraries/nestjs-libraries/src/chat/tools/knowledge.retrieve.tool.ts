import { Injectable } from '@nestjs/common';
import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { KnowledgeService } from '@gitroom/nestjs-libraries/database/prisma/knowledge/knowledge.service';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';
import { getAuth, getContext } from '@gitroom/nestjs-libraries/chat/async.storage';

@Injectable()
export class KnowledgeRetrieveTool implements AgentToolInterface {
  name = 'knowledgeRetrieveTool';

  constructor(private _knowledgeService: KnowledgeService) {}

  run() {
    return createTool({
      id: 'knowledgeRetrieveTool',
      mcp: {
        annotations: {
          title: 'Retrieve Knowledge Base',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      description: `
Retrieve verified, authoritative organization knowledge, campaign briefs, brand voice guidelines, product specs, compliance rules, and historical posts from the Knowledge Base.
Executes bounded 7-layer Agentic RAG (Two-tier Redis cache, Adaptive sub-query planning, Dense vector + BM25 RRF hybrid search, and CRAG relevancy/sufficiency evaluation).
Returns verified chunks with [resourceId:chunkId@vX] citations, sufficiency status ('COMPLETE', 'PARTIAL', 'ABSTAIN'), and missing information.
Always invoke this tool before drafting posts or answering brand/product questions to prevent hallucinations.
`,
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            'The search query or question to retrieve facts and guidelines for'
          ),
        channelIdentifiers: z
          .array(z.string())
          .optional()
          .describe(
            'Optional channel identifiers to scope knowledge (e.g. ["x", "linkedin", "instagram"])'
          ),
        topK: z
          .number()
          .optional()
          .default(6)
          .describe('Maximum number of high-signal chunks to return (<= 6)'),
        minScore: z
          .number()
          .optional()
          .default(0.72)
          .describe('Relevance score threshold (0.0 to 1.0)'),
      }),
      outputSchema: z.object({
        output: z.object({
          sufficiencyStatus: z.enum(['COMPLETE', 'PARTIAL', 'ABSTAIN']),
          verifiedChunks: z.array(
            z.object({
              id: z.string(),
              resourceId: z.string(),
              version: z.number(),
              title: z.string(),
              contextualText: z.string(),
              score: z.number(),
              citation: z.string(),
            })
          ),
          citations: z.array(z.string()),
          missingInformation: z.array(z.string()),
          diagnostics: z.object({
            iterations: z.number(),
            cacheHit: z.string(),
            durationMs: z.number(),
            queryCount: z.number(),
          }),
        }),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);

        let organizationId: string | undefined;
        const orgContext = (context?.requestContext as any)?.get('organization');

        if (orgContext) {
          try {
            organizationId = JSON.parse(orgContext).id;
          } catch (err) {}
        }

        if (!organizationId) {
          organizationId = getAuth()?.id || getContext()?.auth?.id;
        }

        if (!organizationId) {
          throw new Error('Unauthorized: Organization context is missing');
        }

        const result = await this._knowledgeService.retrieveForOrchestrator(
          organizationId,
          {
            query: inputData.query,
            channelIdentifiers: inputData.channelIdentifiers,
            topK: inputData.topK,
            minScore: inputData.minScore,
          }
        );

        return {
          output: result,
        };
      },
    });
  }
}
