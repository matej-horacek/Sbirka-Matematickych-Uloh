import { Injectable, PipeTransform } from '@nestjs/common';
import { decodeId } from '../utils/ids';
import { ApiError } from '../errors/api-error';

/** Path `{id}` (Sqid) → integer id. A malformed id is just "not found". */
@Injectable()
export class ParseIdPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    const id = decodeId(value);
    if (id === null) throw ApiError.notFound();
    return id;
  }
}
