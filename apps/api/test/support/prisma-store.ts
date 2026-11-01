import type { Prisma } from '../../src/generated/prisma/client';
import type { PrismaService } from '../../src/database/prisma.service';
import type { ChapterRow, LicenseRow, ProblemRow, TagRow, UserRow } from '../../src/database/mock-database';
import { toUserRow } from '../../src/modules/users/repositories/prisma-users.repository';
import { decodeId } from '../../src/common/utils/ids';
import type { Collection, CountOptions, Id, Rows, StoreProbe, Where } from './store';

/**
 * StoreProbe for DATA_SOURCE=prisma: reads the test database directly through PrismaService
 * (NOT through the repositories, so the tests check what was really stored) and maps the DB rows
 * onto the same row shapes as the mock (see Rows in store.ts).
 *
 * Deliberately simple: every query loads the whole table and filters in code. The test database is tiny.
 */
const PROBLEM_INCLUDE = {
  language: true,
  content_source: true,
  problem_part_problem_part_child_idToproblem: true,
  problem_tag: { include: { tag: true } },
  problem_chapter: { include: { chapter: true } },
} satisfies Prisma.problemInclude;

type DbProblem = Prisma.problemGetPayload<{ include: typeof PROBLEM_INCLUDE }>;

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'cs');

function toProblemRow(p: DbProblem): ProblemRow {
  const part = p.problem_part_problem_part_child_idToproblem;
  const s = p.content_source;
  return {
    id: p.id,
    name: p.name,
    assignment: p.assignment,
    result: p.result,
    languageCode: p.language?.code ?? null,
    difficulty: p.difficulty,
    authorId: p.author_id,
    publishStatus: p.publish_status,
    version: p.version,
    lockVersion: p.lock_version,
    parentId: part?.parent_id ?? null,
    position: part?.position ?? null,
    originalProblemId: p.original_problem_id,
    originalProblemVersion: p.original_problem_version,
    source: {
      originType: s.origin_type,
      sourceCitationText: s.source_citation_text,
      licenseId: s.license_id,
      licenseNote: s.license_note,
      citationAudience: s.citation_audience,
      showInWeb: s.show_in_web,
      showInPdf: s.show_in_pdf,
    },
    // D-04: a problem's tags and chapters are ordered by name.
    tagIds: p.problem_tag.map((pt) => pt.tag).sort(byName).map((t) => t.id),
    chapterIds: p.problem_chapter.map((pc) => pc.chapter).sort(byName).map((c) => c.id),
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    deletedAt: p.deleted_at,
  };
}

export class PrismaStoreProbe implements StoreProbe {
  constructor(private readonly prisma: PrismaService) {}

  toDbId(id: Id): number {
    if (typeof id === 'number') return id;
    const n = decodeId(id);
    if (n === null) throw new Error(`StoreProbe: "${id}" is not a valid Sqid`);
    return n;
  }

  private async all<C extends Collection>(collection: C): Promise<Rows[C][]> {
    const rows: unknown[] = await this.load(collection);
    return rows as Rows[C][];
  }

  private async load(collection: Collection): Promise<unknown[]> {
    switch (collection) {
      case 'problems':
        return (await this.prisma.problem.findMany({ include: PROBLEM_INCLUDE, orderBy: { id: 'asc' } })).map(toProblemRow);
      case 'users':
        return (await this.prisma.user.findMany({ orderBy: { id: 'asc' } })).map((u): UserRow => toUserRow(u));
      case 'tags':
        return (await this.prisma.tag.findMany({ orderBy: { id: 'asc' } })).map(
          (t): TagRow => ({ id: t.id, name: t.name, isGlobal: t.is_global, ownerId: t.author_id }),
        );
      case 'chapters':
        return (await this.prisma.chapter.findMany({ where: { deleted_at: null }, orderBy: { id: 'asc' } })).map(
          (c): ChapterRow => ({ id: c.id, name: c.name, isGlobal: c.is_global, ownerId: c.author_id, parentId: c.parent_id }),
        );
      case 'licenses':
        return (await this.prisma.license.findMany({ orderBy: { id: 'asc' } })).map(
          (l): LicenseRow => ({
            id: l.id,
            name: l.name,
            description: l.description,
            url: l.url,
            requiresAttribution: l.requires_attribution,
            allowsModification: l.allows_modification,
            requiresShareAlike: l.requires_share_alike,
            allowsPublication: l.allows_publication,
          }),
        );
    }
  }

  private static isDeleted(row: unknown): boolean {
    return !!row && typeof row === 'object' && 'deletedAt' in row && (row as { deletedAt: Date | null }).deletedAt !== null;
  }

  async find<C extends Collection>(collection: C, id: Id): Promise<Rows[C] | undefined> {
    const dbId = this.toDbId(id);
    return (await this.all(collection)).find((r) => (r as { id: number }).id === dbId);
  }

  async expectRecord<C extends Collection>(collection: C, id: Id, fields?: Partial<Rows[C]> | Record<string, unknown>) {
    const row = await this.find(collection, id);
    if (!row) throw new Error(`StoreProbe: expected ${collection} #${this.toDbId(id)} (${id}) to exist, but there is no such row`);
    if (PrismaStoreProbe.isDeleted(row)) {
      throw new Error(`StoreProbe: expected ${collection} #${this.toDbId(id)} (${id}) to exist, but it is soft-deleted`);
    }
    if (fields) expect(row).toMatchObject(fields);
    return row;
  }

  async expectNoRecord(collection: Collection, id: Id) {
    const row = await this.find(collection, id);
    if (row) throw new Error(`StoreProbe: expected no ${collection} row #${this.toDbId(id)} (${id}), but it exists`);
  }

  async expectDeleted(collection: 'problems', id: Id) {
    const row = await this.find(collection, id);
    if (!row) throw new Error(`StoreProbe: expected ${collection} #${this.toDbId(id)} to be soft-deleted, but there is no such row`);
    if (!PrismaStoreProbe.isDeleted(row)) throw new Error(`StoreProbe: expected ${collection} #${this.toDbId(id)} to be soft-deleted, but deletedAt is null`);
    return row;
  }

  async countRecords<C extends Collection>(collection: C, where?: Where<C>, options: CountOptions = {}) {
    const match =
      where === undefined
        ? () => true
        : typeof where === 'function'
          ? where
          : (row: Rows[C]) => Object.entries(where).every(([k, v]) => JSON.stringify((row as unknown as Record<string, unknown>)[k]) === JSON.stringify(v));
    return (await this.all(collection)).filter((r) => (options.includeDeleted || !PrismaStoreProbe.isDeleted(r)) && match(r)).length;
  }

  async children(parentId: Id) {
    const pid = this.toDbId(parentId);
    return (await this.all('problems'))
      .filter((p) => p.parentId === pid && p.deletedAt === null)
      // Byte order, like the mock (fractional-indexing keys, R-020).
      .sort((a, b) => ((a.position ?? '') < (b.position ?? '') ? -1 : (a.position ?? '') > (b.position ?? '') ? 1 : 0));
  }
}
