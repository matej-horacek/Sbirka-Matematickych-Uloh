import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { zPublishProblemBody, type ProblemDetail, type PublishRequest } from '@matematika/contracts';
import { CurrentUser, type CurrentUserData } from '../../../common/decorators/current-user.decorator.js';
import { ParseIdPipe } from '../../../common/pipes/parse-id.pipe.js';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import { PublicationService } from '../services/publication.service.js';

@Controller('problems')
export class PublicationController {
  constructor(private readonly publication: PublicationService) {}

  /** publishProblem – the author, if verified or trusted. */
  @Post(':id/publish')
  @HttpCode(200)
  async publish(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseIdPipe) id: number,
    @Body(new ZodValidationPipe(zPublishProblemBody)) body: PublishRequest,
  ): Promise<ProblemDetail> {
    return this.publication.publish(user, id, body);
  }
}
