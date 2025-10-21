import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function RequestIdMiddleware(req: Request & { requestId?: string }, res: Response, next: NextFunction) {
  req.requestId = req.headers['x-request-id'] as string || randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}
