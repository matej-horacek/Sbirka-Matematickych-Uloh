import { Injectable, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { ApiError } from '../errors/api-error';

/**
 * Validates a body or query with a Zod schema (usually one generated in
 * @matematika/contracts) and returns the parsed, typed value.
 * Usage: `@Body(new ZodValidationPipe(zCreateProblemBody)) body: ProblemCreate`
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value ?? {});
    if (result.success) return result.data;
    const issue = result.error.issues[0];
    const where = issue.path.length ? issue.path.join('.') : 'body';
    throw ApiError.badRequest(`${where}: ${issue.message}`);
  }
}
