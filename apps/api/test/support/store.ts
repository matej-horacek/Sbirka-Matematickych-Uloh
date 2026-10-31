import type {
  ChapterRow,
  LicenseRow,
  MockDatabase,
  ProblemRow,
  TagRow,
  UserRow,
} from '../../src/database/mock-database';
import { decodeId } from '../../src/common/utils/ids';

/**
 * StoreProbe: what the tests may ask the data store directly.
 *
 * Tests use this interface only, never MockDatabase. In Phase B a PrismaStoreProbe implements
 * the same methods (it maps the row shapes below onto the Prisma models), and the tests
 * stay as they are. That is why every method is async even though the mock is synchronous.
 *
 * Ids: pass the Sqid string from an API response (it is decoded here) or a raw integer.
 * Fields: the row shape of the mock (camelCase, like Prisma models): see mock-database.ts.
 * Problems are soft-deleted: `expectRecord` means "exists and not deleted",
 * `expectDeleted` means "exists with deletedAt set", `expectNoRecord` means "no row at all".
 */
export interface Rows {
  problems: ProblemRow;
  tags: TagRow;
  chapters: ChapterRow;
  licenses: LicenseRow;
  users: UserRow;
}
export type Collection = keyof Rows;
export type Id = string | number;
export type Where<C extends Collection> = Partial<Rows[C]> | ((row: Rows[C]) => boolean);

export interface CountOptions {
  /** Count soft-deleted rows too (problems only). Default false. */
  includeDeleted?: boolean;
}

export interface StoreProbe {
  /** Asserts the row exists (and is not soft-deleted) and matches `fields` (toMatchObject). Returns it. */
  expectRecord<C extends Collection>(collection: C, id: Id, fields?: Partial<Rows[C]> | Record<string, unknown>): Promise<Rows[C]>;
  /** Asserts that no row with this id exists at all (not even soft-deleted). */
  expectNoRecord(collection: Collection, id: Id): Promise<void>;
  /** Asserts the row exists but is soft-deleted (problems). */
  expectDeleted(collection: 'problems', id: Id): Promise<Rows['problems']>;
  /** Counts rows matching `where` (fields or a predicate). Soft-deleted problems are excluded by default. */
  countRecords<C extends Collection>(collection: C, where?: Where<C>, options?: CountOptions): Promise<number>;
  /** Reads a row without asserting (undefined when missing). Soft-deleted rows are returned too. */
  find<C extends Collection>(collection: C, id: Id): Promise<Rows[C] | undefined>;
  /** Live children of a set, in position order. */
  children(parentId: Id): Promise<Rows['problems'][]>;
  /** Turns a Sqid from an API response into the store's integer id (throws on an invalid id). */
  toDbId(id: Id): number;
}

export class MockStoreProbe implements StoreProbe {
  constructor(private readonly db: MockDatabase) {}

  toDbId(id: Id): number {
    if (typeof id === 'number') return id;
    const n = decodeId(id);
    if (n === null) throw new Error(`StoreProbe: "${id}" is not a valid Sqid`);
    return n;
  }

  private rows<C extends Collection>(collection: C): Rows[C][] {
    return this.db[collection] as unknown as Rows[C][];
  }

  private static isDeleted(row: unknown): boolean {
    return !!row && typeof row === 'object' && 'deletedAt' in row && (row as { deletedAt: Date | null }).deletedAt !== null;
  }

  async find<C extends Collection>(collection: C, id: Id): Promise<Rows[C] | undefined> {
    const dbId = this.toDbId(id);
    return this.rows(collection).find((r) => (r as { id: number }).id === dbId);
  }

  async expectRecord<C extends Collection>(collection: C, id: Id, fields?: Partial<Rows[C]> | Record<string, unknown>) {
    const row = await this.find(collection, id);
    if (!row) throw new Error(`StoreProbe: expected ${collection} #${this.toDbId(id)} (${id}) to exist, but there is no such row`);
    if (MockStoreProbe.isDeleted(row)) {
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
    if (!MockStoreProbe.isDeleted(row)) throw new Error(`StoreProbe: expected ${collection} #${this.toDbId(id)} to be soft-deleted, but deletedAt is null`);
    return row;
  }

  async countRecords<C extends Collection>(collection: C, where?: Where<C>, options: CountOptions = {}) {
    const match =
      where === undefined
        ? () => true
        : typeof where === 'function'
          ? where
          : (row: Rows[C]) => Object.entries(where).every(([k, v]) => isEqual((row as unknown as Record<string, unknown>)[k], v));
    return this.rows(collection).filter((r) => (options.includeDeleted || !MockStoreProbe.isDeleted(r)) && match(r)).length;
  }

  async children(parentId: Id) {
    const pid = this.toDbId(parentId);
    return this.rows('problems')
      .filter((p) => p.parentId === pid && p.deletedAt === null)
      // Byte order, like fractional-indexing keys and Postgres text with C collation (not localeCompare: R-020).
      .sort((a, b) => ((a.position ?? '') < (b.position ?? '') ? -1 : (a.position ?? '') > (b.position ?? '') ? 1 : 0));
  }
}

function isEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
