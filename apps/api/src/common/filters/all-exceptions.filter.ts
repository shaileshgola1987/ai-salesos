import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Catches everything — NestJS's default filter only formats HttpExceptions; anything else
 * (a raw thrown Error, a driver-level Prisma error, ...) would otherwise reach the client as
 * a bare 500 with no logging and, in some setups, a leaked stack trace. Security hardening
 * (PRD §18): never return internal error details to the client in production.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!isHttpException) {
      const stack =
        exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.originalUrl}`,
        stack,
      );
    }

    const isProduction = process.env.NODE_ENV === 'production';
    let message: string | string[];
    let error: string;

    if (isHttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        error = exception.name;
      } else {
        const bodyObj = body as { message?: string | string[]; error?: string };
        message = bodyObj.message ?? exception.message;
        error = bodyObj.error ?? exception.name;
      }
    } else {
      error = 'Internal Server Error';
      message = isProduction
        ? 'Something went wrong. Please try again.'
        : exception instanceof Error
          ? exception.message
          : 'Unknown error';
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    });
  }
}
