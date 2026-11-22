import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  zCreateWorksheetBody,
  zUpdateWorksheetBody,
  type WorksheetCreate,
  type WorksheetDetail,
  type WorksheetPage,
  type WorksheetPatch,
} from '@matematika/contracts';
import { CurrentUser, type CurrentUserData } from '../../../common/decorators/current-user.decorator.js';
import { ParseIdPipe } from '../../../common/pipes/parse-id.pipe.js';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import { listWorksheetsQuery, type ListWorksheetsQuery } from '../dto/list-worksheets.query.js';
import { WorksheetsService } from '../services/worksheets.service.js';

// Routes, validation, one service call each. No rules here: they live in the service and domain/.
@Controller('worksheets')
export class WorksheetsController {
  constructor(private readonly worksheets: WorksheetsService) {}

  /** listWorksheets – any logged-in teacher; only their own worksheets. */
  @Get()
  async list(
    @CurrentUser() user: CurrentUserData,
    @Query(new ZodValidationPipe(listWorksheetsQuery)) query: ListWorksheetsQuery,
  ): Promise<WorksheetPage> {
    return this.worksheets.list(user, query);
  }

  /** createWorksheet – any logged-in teacher. 201. */
  @Post()
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body(new ZodValidationPipe(zCreateWorksheetBody)) body: WorksheetCreate,
  ): Promise<WorksheetDetail> {
    return this.worksheets.create(user, body);
  }

  /** getWorksheet – the author, or anyone when published. */
  @Get(':id')
  async get(@CurrentUser() user: CurrentUserData, @Param('id', ParseIdPipe) id: number): Promise<WorksheetDetail> {
    return this.worksheets.get(user, id);
  }

  /** updateWorksheet – author only, with lockVersion. */
  @Patch(':id')
  async update(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseIdPipe) id: number,
    @Body(new ZodValidationPipe(zUpdateWorksheetBody)) body: WorksheetPatch,
  ): Promise<WorksheetDetail> {
    return this.worksheets.update(user, id, body);
  }

  /** deleteWorksheet – author only, soft delete. */
  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: CurrentUserData, @Param('id', ParseIdPipe) id: number): Promise<void> {
    await this.worksheets.remove(user, id);
  }
}
