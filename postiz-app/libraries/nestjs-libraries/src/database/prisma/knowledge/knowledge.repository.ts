import { Injectable } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

@Injectable()
export class KnowledgeRepository {
  constructor(private _prisma: PrismaService) {}

  async createResource(
    organizationId: string,
    data: {
      title: string;
      content: string;
      summary?: string;
      status: string;
      version: number;
      contentHash: string;
      channelIdentifiers: string[];
      tags: string[];
    }
  ) {
    return this._prisma.knowledgeResource.create({
      data: {
        organizationId,
        title: data.title,
        content: data.content,
        summary: data.summary,
        status: data.status,
        version: data.version,
        contentHash: data.contentHash,
        channelIdentifiers: data.channelIdentifiers,
        tags: data.tags,
      },
      select: {
        id: true,
        organizationId: true,
        title: true,
        summary: true,
        status: true,
        version: true,
        contentHash: true,
        channelIdentifiers: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateResource(
    organizationId: string,
    id: string,
    data: {
      title?: string;
      content?: string;
      summary?: string;
      status?: string;
      version?: number;
      contentHash?: string;
      channelIdentifiers?: string[];
      tags?: string[];
    }
  ) {
    return this._prisma.knowledgeResource.update({
      where: {
        id,
        organizationId,
      },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.content !== undefined ? { content: data.content } : {}),
        ...(data.summary !== undefined ? { summary: data.summary } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.version !== undefined ? { version: data.version } : {}),
        ...(data.contentHash !== undefined ? { contentHash: data.contentHash } : {}),
        ...(data.channelIdentifiers !== undefined
          ? { channelIdentifiers: data.channelIdentifiers }
          : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
      },
      select: {
        id: true,
        organizationId: true,
        title: true,
        summary: true,
        status: true,
        version: true,
        contentHash: true,
        channelIdentifiers: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getResourceById(organizationId: string, id: string) {
    return this._prisma.knowledgeResource.findFirst({
      where: {
        id,
        organizationId,
      },
      select: {
        id: true,
        organizationId: true,
        title: true,
        content: true,
        summary: true,
        status: true,
        version: true,
        contentHash: true,
        channelIdentifiers: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
        chunks: {
          select: {
            id: true,
            chunkIndex: true,
            version: true,
            contextualText: true,
            createdAt: true,
          },
          orderBy: {
            chunkIndex: 'asc',
          },
        },
      },
    });
  }

  async listResources(
    organizationId: string,
    filter: {
      status?: string;
      search?: string;
      channel?: string;
      skip?: number;
      take?: number;
    }
  ) {
    const where: any = { organizationId };

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.channel) {
      where.channelIdentifiers = { has: filter.channel };
    }

    if (filter.search) {
      where.OR = [
        { title: { contains: filter.search, mode: 'insensitive' } },
        { content: { contains: filter.search, mode: 'insensitive' } },
        { tags: { has: filter.search } },
      ];
    }

    return this._prisma.knowledgeResource.findMany({
      where,
      skip: filter.skip || 0,
      take: filter.take || 20,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        organizationId: true,
        title: true,
        summary: true,
        status: true,
        version: true,
        contentHash: true,
        channelIdentifiers: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            chunks: true,
          },
        },
      },
    });
  }

  async countResources(
    organizationId: string,
    filter: { status?: string; search?: string; channel?: string }
  ) {
    const where: any = { organizationId };
    if (filter.status) where.status = filter.status;
    if (filter.channel) where.channelIdentifiers = { has: filter.channel };
    if (filter.search) {
      where.OR = [
        { title: { contains: filter.search, mode: 'insensitive' } },
        { content: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    return this._prisma.knowledgeResource.count({ where });
  }

  async deleteResource(organizationId: string, id: string) {
    return this._prisma.$transaction(async (tx: any) => {
      await tx.knowledgeChunk.deleteMany({
        where: {
          resourceId: id,
          organizationId,
        },
      });

      return tx.knowledgeResource.delete({
        where: {
          id,
          organizationId,
        },
        select: {
          id: true,
          organizationId: true,
          title: true,
        },
      });
    });
  }

  async deleteChunksForResource(organizationId: string, resourceId: string) {
    return this._prisma.knowledgeChunk.deleteMany({
      where: {
        resourceId,
        organizationId,
      },
    });
  }

  async createChunks(
    chunks: Array<{
      resourceId: string;
      organizationId: string;
      chunkIndex: number;
      version: number;
      contextualText: string;
      embedding: number[];
    }>
  ) {
    if (!chunks.length) return { count: 0 };
    return this._prisma.knowledgeChunk.createMany({
      data: chunks,
    });
  }

  async findPublishedChunks(
    organizationId: string,
    channelIdentifiers?: string[]
  ) {
    const where: any = {
      organizationId,
      resource: {
        status: 'PUBLISHED',
      },
    };

    if (channelIdentifiers && channelIdentifiers.length > 0) {
      where.resource.OR = [
        { channelIdentifiers: { hasSome: channelIdentifiers } },
        { channelIdentifiers: { isEmpty: true } },
      ];
    }

    return this._prisma.knowledgeChunk.findMany({
      where,
      select: {
        id: true,
        resourceId: true,
        organizationId: true,
        chunkIndex: true,
        version: true,
        contextualText: true,
        embedding: true,
        resource: {
          select: {
            id: true,
            title: true,
            summary: true,
            version: true,
            status: true,
            channelIdentifiers: true,
            updatedAt: true,
            contentHash: true,
          },
        },
      },
    });
  }

  async getLatestResourceUpdatedAt(organizationId: string): Promise<Date | null> {
    const latest = await this._prisma.knowledgeResource.findFirst({
      where: { organizationId, status: 'PUBLISHED' },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });
    return latest?.updatedAt || null;
  }
}
