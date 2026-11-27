import type { AssetRow } from '../../../database/mock-database.js';

export type NewAsset = Omit<AssetRow, 'id' | 'createdAt'>;

export const ASSETS_REPOSITORY = Symbol('ASSETS_REPOSITORY');

/** Data access for uploaded images. Only queries, no decisions. Implementations: Mock…, Prisma… */
export interface AssetsRepository {
  /** The asset with this id, only if `userId` uploaded it; otherwise undefined (missing and foreign look the same). */
  findOwned(id: number, userId: number): Promise<AssetRow | undefined>;
  insert(data: NewAsset): Promise<AssetRow>;
}
