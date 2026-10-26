import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { KnowledgeService } from '@gitroom/nestjs-libraries/database/prisma/knowledge/knowledge.service';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import {
  KnowledgeStatus,
  QueryKnowledgeDto,
  RetrieveKnowledgeInputDto,
  UpdateKnowledgeStatusDto,
  UpsertKnowledgeDto,
} from '@gitroom/nestjs-libraries/dtos/knowledge/knowledge.dto';

@ApiTags('Knowledge')
@Controller('/knowledge')
export class KnowledgeController {
  constructor(private _knowledgeService: KnowledgeService) {}

  @Get('/')
  async listKnowledge(
    @GetOrgFromRequest() org: Organization,
    @Query() query: QueryKnowledgeDto
  ) {
    return this._knowledgeService.list(org.id, query);
  }

  @Get('/:id')
  async getKnowledge(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    const resource = await this._knowledgeService.get(org.id, id);
    if (!resource) {
      throw new HttpException('Knowledge resource not found', HttpStatus.NOT_FOUND);
    }
    return resource;
  }

  @Post('/')
  async saveKnowledge(
    @GetOrgFromRequest() org: Organization,
    @Body() body: UpsertKnowledgeDto
  ) {
    if (body.status === KnowledgeStatus.PUBLISHED) {
      return this._knowledgeService.publish(org.id, body);
    }
    return this._knowledgeService.saveDraft(org.id, body);
  }

  @Put('/:id/status')
  async updateStatus(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: UpdateKnowledgeStatusDto
  ) {
    return this._knowledgeService.updateStatus(org.id, id, body.status);
  }

  @Delete('/:id')
  async deleteKnowledge(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._knowledgeService.delete(org.id, id);
  }

  @Post('/retrieve')
  async retrieve(
    @GetOrgFromRequest() org: Organization,
    @Body() body: RetrieveKnowledgeInputDto
  ) {
    return this._knowledgeService.retrieveForOrchestrator(org.id, body);
  }
}
