import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { ErrorCode, type ErrorDetails } from '@matematika/contracts';
import { ApiError } from '../errors/api-error';

const TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  412: 'Precondition Failed',
  500: 'Internal Server Error',
};

const CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  400: ErrorCode.VALIDATION_FAILED,
  401: ErrorCode.UNAUTHENTICATED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
};

/** Every error leaves the API as `application/problem+json` (RFC 9457). */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR as number;
    let code: ErrorCode | undefined;
    let detail: string | undefined;

    if (exception instanceof ApiError) {
      status = exception.getStatus();
      code = exception.code;
      detail = exception.detail;
    } else if (exception instanceof HttpException) {
      // Errors raised by Nest itself, e.g. an unknown route (404) or malformed JSON (400).
      status = exception.getStatus();
      code = CODE_BY_STATUS[status];
      detail = exception.message;
    } else {
      this.logger.error(exception);
    }

    const body: ErrorDetails = {
      type: 'about:blank',
      title: TITLES[status] ?? 'Error',
      status,
      ...(code && { code }),
      ...(detail && { detail }),
      requestId,
    };
    res.status(status).type('application/problem+json').json(body);
  }
}
