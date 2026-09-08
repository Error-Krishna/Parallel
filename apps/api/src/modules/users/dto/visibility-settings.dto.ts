import { IsBoolean, IsIn, IsOptional } from 'class-validator';

// Explicit, validated shape instead of arbitrary Record<string, unknown> — this field
// controls real privacy/visibility behavior (blueprint §22), so it shouldn't accept
// whatever JSON a client sends. Add new keys here deliberately as privacy controls
// are actually built (blueprint §14 Profile/Privacy flow) — never widen this back to
// an unchecked bag of keys.
export class VisibilitySettingsDto {
  @IsOptional()
  @IsIn(['public', 'friends', 'private'])
  profileVisibility?: 'public' | 'friends' | 'private';

  @IsOptional()
  @IsBoolean()
  showActivityStatus?: boolean;
}
