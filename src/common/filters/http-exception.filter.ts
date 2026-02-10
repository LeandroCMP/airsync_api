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
    let message = 'Erro interno. Tente novamente em instantes.';
    let code = 'INTERNAL_ERROR';
    let details: any[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res: any = exception.getResponse();
      const { resolvedMessage, resolvedCode, resolvedDetails } = this.resolveResponse(res, status);
      message = resolvedMessage;
      code = resolvedCode;
      details = resolvedDetails;
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

  private resolveResponse(res: any, status: number) {
    if (typeof res === 'string') {
      return {
        resolvedMessage: this.mapStatusToPtMessage(status),
        resolvedCode: this.mapStatusToCode(status),
        resolvedDetails: undefined
      };
    }

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

    const userMessage = this.toFriendlyMessage(responseCode, responseMessage, status);
    return {
      resolvedMessage: userMessage,
      resolvedCode: responseCode,
      resolvedDetails: responseDetails ?? res.details
    };
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
        return 'Dados invalidos. Verifique e tente novamente.';
      case HttpStatus.UNAUTHORIZED:
        return 'Login necessario para continuar.';
      case HttpStatus.FORBIDDEN:
        return 'Voce nao tem permissao para esta acao.';
      case HttpStatus.NOT_FOUND:
        return 'Registro nao encontrado.';
      case HttpStatus.CONFLICT:
        return 'Conflito ao processar. Tente novamente.';
      default:
        return 'Erro ao processar sua solicitacao.';
    }
  }

  private toFriendlyMessage(code: string, raw?: string, status?: number) {
    const map: Record<string, string> = {
      VALIDATION_ERROR: 'Dados invalidos. Verifique os campos.',
      ALREADY_PAID: 'Este registro ja foi quitado.',
      OVERPAY: 'Valor informado maior que o saldo.',
      PAYMENT_MISMATCH: 'A soma dos pagamentos deve bater com o total.',
      INSTALLMENT_NOT_FOUND: 'Parcela nao encontrada.',
      NOT_FOUND: 'Registro nao encontrado.',
      UNAUTHORIZED: 'Login necessario para continuar.',
      FORBIDDEN: 'Voce nao tem permissao para esta acao.',
      ACCOUNT_SUSPENDED: 'Conta suspensa por atraso. Regularize para voltar a usar.',
      DUPLICATE_REF: 'Ja existe um lancamento para este identificador.'
    };
    if (map[code]) {
      return map[code];
    }
    if (raw && typeof raw === 'string') {
      return raw;
    }
    if (status) {
      return this.mapStatusToPtMessage(status);
    }
    return 'Erro ao processar sua solicitacao.';
  }
}
