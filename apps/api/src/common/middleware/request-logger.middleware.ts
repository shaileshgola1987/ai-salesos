import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/** Basic request/response logging for observability (PRD §22 Monitoring) — until a real
 * APM (Sentry/DataDog) is wired up, this is what a production incident gets debugged from. */
export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const logger = new Logger('HTTP');
  const start = Date.now();
  res.on('finish', () => {
    logger.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`,
    );
  });
  next();
}
