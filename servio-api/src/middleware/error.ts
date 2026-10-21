// error handler
import type { ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from '../env';
import { ApiError, type ErrorBody } from '../lib/errors';

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = c.get('requestId') ?? 'unknown';
  if (err instanceof ApiError) {
    const body: ErrorBody = { error: { code: err.code, message: err.message, requestId } };
    if (err.details !== undefined) body.error.details = err.details;
    return c.json(body, err.status);
  }
  if (err instanceof HTTPException) {
    const body: ErrorBody = { error: { code: err.status === 400 ? 'BAD_REQUEST' : 'HTTP_ERROR', message: err.message || 'Request failed.', requestId } };
    return c.json(body, err.status);
  }
  console.error(JSON.stringify({ requestId, level: 'error', message: err.message, stack: err.stack }));
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.', requestId } } satisfies ErrorBody, 500);
};

export const notFoundHandler: NotFoundHandler<AppEnv> = (c) =>
  c.json({ error: { code: 'NOT_FOUND', message: 'Route not found.', requestId: c.get('requestId') ?? 'unknown' } } satisfies ErrorBody, 404);
