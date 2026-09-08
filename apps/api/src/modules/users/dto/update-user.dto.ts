import { IsOptional, IsString, IsUrl, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsUsername } from '../../../common/validators/username.validator.js';
import { VisibilitySettingsDto } from './visibility-settings.dto.js';

// Every field optional — PATCH /v1/users/me is a partial update (see API.md §3).
// username uses the same @IsUsername() rules as signup (was previously unvalidated
// here — a real inconsistency between "create" and "edit" paths).
export class UpdateUserDto {
  @IsOptional()
  @IsUsername()
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  bio?: string;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => VisibilitySettingsDto)
  visibilitySettings?: VisibilitySettingsDto;
}
