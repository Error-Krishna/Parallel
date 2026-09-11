import { IsEnum } from 'class-validator';
import { SignalType } from '@prisma/client';

export class ContentInteractionDto {
  @IsEnum(SignalType)
  signalType!: SignalType;
}
