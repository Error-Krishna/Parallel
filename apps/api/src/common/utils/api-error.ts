import { HttpException, HttpStatus } from '@nestjs/common';

export function apiError(
  message: string,
  statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
): never {
  throw new HttpException(message, statusCode);
}
