import { NextFunction, Request, Response } from 'express';
import { Logger } from '@nestjs/common';

const httpLogger = new Logger('HTTP');

export function RequestLoggerMiddleware(
  req: Request & { requestId?: string; tenantId?: string; user?: any },
  res: Response,
  next: NextFunction
) {
  const start = Date.now();
  const { method, originalUrl } = req;

  let responsePayload: any;

  const capturePayload = (body: any) => {
    responsePayload = body;
    return body;
  };

  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    return originalJson(capturePayload(body));
  } as typeof res.json;

  const originalSend = res.send.bind(res);
  res.send = function (body: any) {
    return originalSend(capturePayload(body));
  } as typeof res.send;

  const extractErrorMessage = (payload: any): string | undefined => {
    if (!payload) {
      return undefined;
    }
    if (typeof payload === 'string') {
      return payload;
    }
    if (Buffer.isBuffer(payload)) {
      return payload.toString('utf8');
    }
    if (typeof payload === 'object') {
      if (payload.error) {
        return payload.error.message || payload.error.code;
      }
      if (payload.message) {
        if (Array.isArray(payload.message)) {
          return payload.message.join(', ');
        }
        return payload.message;
      }
    }
    return undefined;
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const rid = req.requestId || '-';
    const tenant = req.tenantId || '-';
    const userId = (req.user && (req.user.id || req.user._id)) || '-';
    const errorMessage = statusCode >= 400 ? extractErrorMessage(responsePayload) : undefined;

    const messageParts = [
      `${method} ${originalUrl} ${statusCode} - ${duration}ms`,
      `tenant=${tenant}`,
      `user=${userId}`,
      `rid=${rid}`
    ];

    if (errorMessage) {
      messageParts.push(`err="${errorMessage}"`);
    }

    httpLogger.log(messageParts.join(' | '));
  });

  next();
}
