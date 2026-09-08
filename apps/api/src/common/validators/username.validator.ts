import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

// Single source of truth for username rules — used by both SignupDto and
// UpdateUserDto so the constraint can never drift between "create" and "edit"
// (a real gap in the original implementation: signup enforced this, profile
// update didn't). Add @IsOptional() separately at the call site for DTOs where
// the field isn't required.
export function IsUsername() {
  return applyDecorators(
    IsString(),
    MinLength(USERNAME_MIN_LENGTH),
    MaxLength(USERNAME_MAX_LENGTH),
    Matches(USERNAME_PATTERN, {
      message: 'username can only contain letters, numbers, and underscores',
    }),
  );
}
