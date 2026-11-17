import { IsNotEmpty, IsString } from 'class-validator';

export class AcceptCollabDto {
  @IsNotEmpty()
  @IsString()
  myParallelTypeId!: string;
}
