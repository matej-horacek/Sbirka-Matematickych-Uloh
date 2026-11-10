import { Injectable } from '@nestjs/common';
import { seed } from './mock-seed.js';

// In-memory stand-in for PrismaService (Phase B replaces it with PrismaService
// and real migrations). Rows are shaped like Prisma models: camelCase fields,
// integer ids, relations as id lists. Repositories are the only code that reads it.

export type TrustLevel = 'REGISTERED' | 'VERIFIED' | 'TRUSTED';
export type Role = 'TEACHER' | 'ADMIN';
export type PublishStatus = 'PRIVATE' | 'REVIEWING' | 'PUBLISHED' | 'WITHDRAWN' | 'BLOCKED';
export type OriginType = 'OWN' | 'LICENSED_USE' | 'FREE_USE';

/** user_role of the database; `role` + `trust` below are derived from it. */
export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'TRUSTED_TEACHER' | 'VERIFIED_TEACHER' | 'REGISTERED_TEACHER';

export interface UserRow {
  id: number;
  username: string;
  email: string;
  /** argon2 hash. Never leaves the auth module. */
  passwordHash: string;
  /** COALESCE(display_name, username) (D-05). */
  displayName: string;
  /** Raw database role (what `CurrentUser.role` returns). */
  dbRole: UserRole;
  status: 'ACTIVE' | 'BLOCKED';
  role: Role;
  trust: TrustLevel;
}

/** refresh_token: opaque token stored only as a SHA-256 hash. */
export interface RefreshTokenRow {
  id: number;
  userId: number;
  tokenHash: string;
  /** All tokens of one login chain; reuse of a rotated token revokes the family. */
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
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
  refreshTokens: RefreshTokenRow[] = [];
  private nextProblemId = 1;
  private nextUserId = 1;
  private nextRefreshTokenId = 1;

  constructor() {
    const data = seed();
    this.users = data.users;
    this.licenses = data.licenses;
    this.tags = data.tags;
    this.chapters = data.chapters;
    this.problems = data.problems;
    this.nextProblemId = Math.max(0, ...this.problems.map((p) => p.id)) + 1;
    this.nextUserId = Math.max(0, ...this.users.map((u) => u.id)) + 1;
    for (const p of this.problems) this.sortRelations(p);
  }

  /**
   * D-04: a problem's tags and chapters are ordered by name (there is no position column, so the Prisma
   * repository cannot return any other order). The mock keeps the same order so both behave alike.
   */
  sortRelations(row: ProblemRow): ProblemRow {
    const byName = (items: { id: number; name: string }[]) => (a: number, b: number) =>
      (items.find((i) => i.id === a)?.name ?? '').localeCompare(items.find((i) => i.id === b)?.name ?? '', 'cs');
    row.tagIds = [...row.tagIds].sort(byName(this.tags));
    row.chapterIds = [...row.chapterIds].sort(byName(this.chapters));
    return row;
  }

  newUserId(): number {
    return this.nextUserId++;
  }

  newRefreshTokenId(): number {
    return this.nextRefreshTokenId++;
  }

  newProblemId(): number {
    return this.nextProblemId++;
  }
}
