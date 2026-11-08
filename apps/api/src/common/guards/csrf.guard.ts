import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ErrorCode } from '@matematika/contracts';
import { ApiError } from '../errors/api-error.js';

const UNSAFE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * CSRF protection for cookie auth: a cross-site form or <img> cannot add a custom header, and a
 * cross-site fetch with one needs a CORS preflight that only our own origin passes.
 * Every POST/PATCH/DELETE must send `X-Requested-With: XMLHttpRequest` (also login and register).
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (!UNSAFE_METHODS.has(req.method)) return true;
    if (req.header('x-requested-with') !== 'XMLHttpRequest') {
      throw ApiError.forbidden('Missing X-Requested-With header.', ErrorCode.CSRF_CHECK_FAILED);
    }
    return true;
  }
}
