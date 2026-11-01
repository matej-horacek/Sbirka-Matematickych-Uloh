import { Injectable } from '@nestjs/common';
import { seed } from './mock-seed';

// In-memory stand-in for PrismaService (Phase B replaces it with PrismaService
// and real migrations). Rows are shaped like Prisma models: camelCase fields,
// integer ids, relations as id lists. Repositories are the only code that reads it.

export type TrustLevel = 'REGISTERED' | 'VERIFIED' | 'TRUSTED';
export type Role = 'TEACHER' | 'ADMIN';
export type PublishStatus = 'PRIVATE' | 'REVIEWING' | 'PUBLISHED' | 'WITHDRAWN' | 'BLOCKED';
export type OriginType = 'OWN' | 'LICENSED_USE' | 'FREE_USE';

export interface UserRow {
  id: number;
  displayName: string;
  role: Role;
  trust: TrustLevel;
  /** Mock login: `Authorization: Bearer <mockToken>` selects this user. */
  mockToken: string;
}

export interface LicenseRow {
  id: number;
  name: string;
  description: string | null;
  url: string | null;
  requiresAttribution: boolean;
  allowsModification: boolean;
  requiresShareAlike: boolean;
  allowsPublication: boolean;
}

export interface TagRow {
  id: number;
  name: string;
  isGlobal: boolean;
  ownerId: number | null;
}

export interface ChapterRow {
  id: number;
  name: string;
  isGlobal: boolean;
  ownerId: number | null;
  parentId: number | null;
}

/** content_source, 1:1 with a problem (each copy gets its own). */
export interface ContentSourceRow {
  originType: OriginType;
  sourceCitationText: string | null;
  licenseId: number | null;
  licenseNote: string | null;
  citationAudience: 'PUBLIC' | 'TEACHER_ONLY';
  showInWeb: boolean;
  showInPdf: boolean;
}

export interface ProblemRow {
  id: number;
  name: string;
  assignment: string;
  result: string | null;
  /** language_id in the real DB; the mock stores the code directly. */
  languageCode: string | null;
  difficulty: number | null;
  authorId: number;
  publishStatus: PublishStatus;
  version: number;
  lockVersion: number;
  /** problem_part in the real DB; the mock keeps parent + position on the row. */
  parentId: number | null;
  position: string | null;
  originalProblemId: number | null;
  originalProblemVersion: number | null;
  source: ContentSourceRow;
  tagIds: number[];
  chapterIds: number[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

@Injectable()
export class MockDatabase {
  users: UserRow[] = [];
  licenses: LicenseRow[] = [];
  tags: TagRow[] = [];
  chapters: ChapterRow[] = [];
  problems: ProblemRow[] = [];
  private nextProblemId = 1;

  constructor() {
    const data = seed();
    this.users = data.users;
    this.licenses = data.licenses;
    this.tags = data.tags;
    this.chapters = data.chapters;
    this.problems = data.problems;
    this.nextProblemId = Math.max(0, ...this.problems.map((p) => p.id)) + 1;
  }

  newProblemId(): number {
    return this.nextProblemId++;
  }
}
