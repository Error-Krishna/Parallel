import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCollabDto {
  @IsOptional()
  @IsString()
  targetUserId?: string;

  @IsOptional()
  @IsString()
  toUsername?: string;

  @IsNotEmpty()
  @IsString()
  myParallelTypeId!: string;
}
