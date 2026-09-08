// Catches anything not handled by a more specific filter and returns a consistent,
// safe error shape — never leaks stack traces or internal messages to the client.
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';

interface ErrorResponseBody {
  statusCode: number;
  path: string;
  timestamp: string;
  message: string | string[];
  error?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handlePrismaError(exception, reply, request);
    }

    if (exception instanceof HttpException) {
      return this.handleHttpException(exception, reply, request);
    }

    this.logger.error(`Unhandled exception on ${request.method} ${request.url}`, (exception as Error)?.stack);
    return this.send(reply, {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      path: request.url,
      timestamp: new Date().toISOString(),
      message: 'Internal server error',
    });
  }

  // NestJS's ValidationPipe throws a BadRequestException whose getResponse() is an
  // *object* (`{ statusCode, message: string[], error }`), not a string — returning
  // that whole object as our `message` field (the original bug) produced a nested,
  // inconsistent shape depending on which exception fired. This flattens every case
  // to the same { statusCode, path, timestamp, message, error? } shape.
  private handleHttpException(exception: HttpException, reply: FastifyReply, request: FastifyRequest) {
    const status = exception.getStatus();
    const body = exception.getResponse();

    let message: string | string[];
    let error: string | undefined;

    if (typeof body === 'string') {
      message = body;
    } else if (typeof body === 'object' && body !== null) {
      const record = body as Record<string, unknown>;
      message = (record.message as string | string[]) ?? exception.message;
      error = typeof record.error === 'string' ? record.error : undefined;
    } else {
      message = exception.message;
    }

    return this.send(reply, {
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      message,
      ...(error && { error }),
    });
  }

  // Prisma's raw errors (P2002 unique constraint, P2025 record not found, ...) should
  // never reach the client as a 500 with an internal error message — map the common,
  // client-actionable ones to proper HTTP semantics; anything else stays a generic
  // 500 (logged, not detailed) rather than risk leaking schema/column names.
  private handlePrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
    reply: FastifyReply,
    request: FastifyRequest,
  ) {
    const timestamp = new Date().toISOString();
    const path = request.url;

    if (exception.code === 'P2002') {
      const target = exception.meta?.target;
      const fields = Array.isArray(target) ? target.join(', ') : String(target ?? 'field');
      return this.send(reply, {
        statusCode: HttpStatus.CONFLICT,
        path,
        timestamp,
        message: `A record with this ${fields} already exists`,
        error: 'Conflict',
      });
    }

    if (exception.code === 'P2025') {
      return this.send(reply, {
        statusCode: HttpStatus.NOT_FOUND,
        path,
        timestamp,
        message: 'Record not found',
        error: 'Not Found',
      });
    }

    this.logger.error(`Unhandled Prisma error ${exception.code} on ${request.method} ${path}`, exception.stack);
    return this.send(reply, {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      path,
      timestamp,
      message: 'Internal server error',
    });
  }

  private send(reply: FastifyReply, body: ErrorResponseBody) {
    return reply.status(body.statusCode).send(body);
  }
}
