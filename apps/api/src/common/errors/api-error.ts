import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@matematika/contracts';

/**
 * The only way services report an expected failure. The global filter turns it
 * into an RFC 9457 `ErrorDetails` body with the matching `code`.
 */
export class ApiError extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ErrorCode,
    readonly detail: string,
  ) {
    super(detail, status);
  }

  static badRequest(detail: string) {
    return new ApiError(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, detail);
  }

  static unauthorized(detail = 'You are not logged in.') {
    return new ApiError(HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHENTICATED, detail);
  }

  static forbidden(detail = 'You are not allowed to perform this action.', code: ErrorCode = ErrorCode.FORBIDDEN) {
    return new ApiError(HttpStatus.FORBIDDEN, code, detail);
  }

  static notFound(detail = 'The resource you are looking for was not found.') {
    return new ApiError(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, detail);
  }

  /** 412: the If-Match header (optimistic lock on DELETE) does not match. */
  static preconditionFailed(code: ErrorCode, detail: string) {
    return new ApiError(HttpStatus.PRECONDITION_FAILED, code, detail);
  }

  static conflict(code: ErrorCode, detail: string) {
    return new ApiError(HttpStatus.CONFLICT, code, detail);
  }
}
