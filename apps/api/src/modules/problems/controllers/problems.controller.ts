import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  zAddSetChildBody,
  zCreateProblemBody,
  zReorderSetChildBody,
  zUpdateProblemBody,
  type AddChildRequest,
  type ReorderChildRequest,
  type ProblemCreate,
  type ProblemDetail,
  type ProblemList,
  type ProblemPage,
  type ProblemPatch,
} from '@matematika/contracts';
import { CurrentUser, type CurrentUserData } from '../../../common/decorators/current-user.decorator';
import { ParseIdPipe } from '../../../common/pipes/parse-id.pipe';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { listProblemsQuery, type ListProblemsQuery } from '../dto/list-problems.query';
import { ProblemsService } from '../services/problems.service';

// Routes, validation, one service call each. No rules here: they live in services and domain/.
@Controller('problems')
export class ProblemsController {
  constructor(private readonly problems: ProblemsService) {}

  /** listProblems – any logged-in teacher. */
  @Get()
  list(
    @CurrentUser() user: CurrentUserData,
    @Query(new ZodValidationPipe(listProblemsQuery)) query: ListProblemsQuery,
  ): ProblemPage {
    return this.problems.list(user, query);
  }

  /** createProblem – any logged-in teacher. */
  @Post()
  create(
    @CurrentUser() user: CurrentUserData,
    @Body(new ZodValidationPipe(zCreateProblemBody)) body: ProblemCreate,
  ): ProblemDetail {
    return this.problems.create(user, body);
  }

  /** getProblem – the author, or anyone when published. */
  @Get(':id')
  get(@CurrentUser() user: CurrentUserData, @Param('id', ParseIdPipe) id: number): ProblemDetail {
    return this.problems.get(user, id);
  }

  /** updateProblem – author only. 200 applied, 202 waiting for review. */
  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseIdPipe) id: number,
    @Body(new ZodValidationPipe(zUpdateProblemBody)) body: ProblemPatch,
    @Res({ passthrough: true }) res: Response,
  ): ProblemDetail {
    const { accepted, problem } = this.problems.update(user, id, body);
    res.status(accepted ? 202 : 200);
    return problem;
  }

  /** deleteProblem – author only, soft delete. */
  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: CurrentUserData, @Param('id', ParseIdPipe) id: number): void {
    this.problems.remove(user, id);
  }

  /** copyProblem – anyone who can see the problem. */
  @Post(':id/copy')
  copy(@CurrentUser() user: CurrentUserData, @Param('id', ParseIdPipe) id: number): ProblemDetail {
    return this.problems.copy(user, id);
  }

  /** addSetChild – the set's author. 200 applied, 202 waiting for review. */
  @Post(':id/children')
  addChild(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseIdPipe) id: number,
    @Body(new ZodValidationPipe(zAddSetChildBody)) body: AddChildRequest,
    @Res({ passthrough: true }) res: Response,
  ): ProblemDetail {
    const { accepted, problem } = this.problems.addSetChild(user, id, body);
    res.status(accepted ? 202 : 200);
    return problem;
  }

  /** reorderSetChild – the set's author. 200 applied, 202 waiting for review. */
  @Patch(':id/children/:childId')
  reorderChild(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseIdPipe) id: number,
    @Param('childId', ParseIdPipe) childId: number,
    @Body(new ZodValidationPipe(zReorderSetChildBody)) body: ReorderChildRequest,
    @Res({ passthrough: true }) res: Response,
  ): ProblemDetail {
    const { accepted, problem } = this.problems.reorderSetChild(user, id, childId, body);
    res.status(accepted ? 202 : 200);
    return problem;
  }

  /** removeSetChild – the set's author; the lock travels in If-Match. 200 with the whole set. */
  @Delete(':id/children/:childId')
  removeChild(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseIdPipe) id: number,
    @Param('childId', ParseIdPipe) childId: number,
    @Headers('if-match') ifMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): ProblemDetail {
    const { accepted, problem } = this.problems.removeSetChild(user, id, childId, ifMatch);
    res.status(accepted ? 202 : 200);
    return problem;
  }

  /** dissolveSet – author only, only on a set. */
  @Post(':id/dissolve')
  @HttpCode(200)
  dissolve(@CurrentUser() user: CurrentUserData, @Param('id', ParseIdPipe) id: number): ProblemList {
    return this.problems.dissolve(user, id);
  }
}
