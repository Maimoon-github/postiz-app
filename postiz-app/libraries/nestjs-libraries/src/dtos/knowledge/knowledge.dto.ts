import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum KnowledgeStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}

export class UpsertKnowledgeDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channelIdentifiers?: string[] = [];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[] = [];

  @IsOptional()
  @IsEnum(KnowledgeStatus)
  status?: KnowledgeStatus = KnowledgeStatus.DRAFT;
}

export class UpdateKnowledgeStatusDto {
  @IsEnum(KnowledgeStatus)
  @IsNotEmpty()
  status: KnowledgeStatus;
}

export class QueryKnowledgeDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 20))
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}

export class RetrieveKnowledgeInputDto {
  @IsString()
  @IsNotEmpty()
  query: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channelIdentifiers?: string[];

  @IsOptional()
  @IsNumber()
  topK?: number = 6;

  @IsOptional()
  @IsNumber()
  minScore?: number = 0.72;
}
