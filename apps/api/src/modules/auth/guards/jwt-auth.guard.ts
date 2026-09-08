import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(
    err: any,
    user: TUser,
    info: any,
    context: ExecutionContext,
  ): TUser {
    console.log('\n===== JWT AUTH DEBUG =====');
    console.log('Error:', err?.message ?? err);
    console.log('Info:', info?.message ?? info);
    console.log('User:', user);
    console.log('==========================\n');

    if (err || !user) {
      throw err || new UnauthorizedException('Unauthorized');
    }

    return user;
  }
}
