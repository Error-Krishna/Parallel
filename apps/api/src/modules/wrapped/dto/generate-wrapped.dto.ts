import { WrappedPeriod } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class GenerateWrappedBodyDto {
  @IsOptional()
  @IsEnum(WrappedPeriod)
  period?: WrappedPeriod;
}
