import { IdentityCardType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class CreateIdentityCardBodyDto {
  @IsEnum(IdentityCardType)
  cardType!: IdentityCardType;

  @IsString()
  @IsNotEmpty()
  sourceId!: string;
}
