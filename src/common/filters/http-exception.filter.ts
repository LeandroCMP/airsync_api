import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Erro interno do servidor';
    let code = 'INTERNAL_ERROR';
    let details: any[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res: any = exception.getResponse();
      if (typeof res === 'string') {
        // Use Portuguese fallback for default string responses
        message = this.mapStatusToPtMessage(status);
      } else {
        const responseCode = res.code || this.mapStatusToCode(status);
        let responseMessage: string | undefined;
        let responseDetails: any[] | undefined;

        if (typeof res.message === 'string') {
          responseMessage = res.message;
        } else if (Array.isArray(res.message) && res.message.length > 0) {
          responseMessage = res.message.join(' | ');
          responseDetails = res.details ?? res.message;
        } else if (res.error && typeof res.error === 'string') {
          responseMessage = res.error;
        }

        message = responseMessage || this.mapStatusToPtMessage(status);
        code = responseCode;
        details = responseDetails ?? res.details;
      }
    } else if (exception instanceof Error) {
      message = exception.message || message;
      code = 'UNHANDLED_ERROR';
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(message, (exception as any)?.stack);
    }

    response.status(status).json({
      error: {
        code,
        message,
        details,
        requestId: request.requestId
      }
    });
  }

  private mapStatusToCode(status: number) {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      default:
        return 'HTTP_ERROR';
    }
  }

  private mapStatusToPtMessage(status: number) {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'Erro de validação';
      case HttpStatus.UNAUTHORIZED:
        return 'Não autorizado';
      case HttpStatus.FORBIDDEN:
        return 'Acesso negado';
      case HttpStatus.NOT_FOUND:
        return 'Não encontrado';
      case HttpStatus.CONFLICT:
        return 'Conflito';
      default:
        return 'Erro';
    }
  }
}
