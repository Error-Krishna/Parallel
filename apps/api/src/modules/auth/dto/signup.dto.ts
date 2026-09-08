import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { IsUsername } from '../../../common/validators/username.validator.js';

export class SignupDto {
  @IsEmail()
  email!: string;

  @IsUsername()
  username!: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(72) // bcrypt truncates beyond 72 bytes — reject longer inputs explicitly instead of silently truncating
  password!: string;
}
