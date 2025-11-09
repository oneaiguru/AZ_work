import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class RunAgentDto {
  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @IsObject()
  @IsOptional()
  context?: Record<string, unknown>;
}
