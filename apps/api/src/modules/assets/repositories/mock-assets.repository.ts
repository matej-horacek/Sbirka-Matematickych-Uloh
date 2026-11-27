import { Injectable } from '@nestjs/common';
import type { AssetsRepository, NewAsset } from './assets.repository.js';
import { MockDatabase, type AssetRow } from '../../../database/mock-database.js';

@Injectable()
export class MockAssetsRepository implements AssetsRepository {
  constructor(private readonly db: MockDatabase) {}
  async findOwned(id: number, userId: number): Promise<AssetRow | undefined> {
    const row = this.db.assets.find((a) => a.id === id && a.uploadedBy === userId);
    return row ? { ...row } : undefined;
  }

  async insert(data: NewAsset): Promise<AssetRow> {
    const date = new Date();
    const assetRow: AssetRow = { ...data, id: this.db.newAssetId(), createdAt: date };
    this.db.assets.push(assetRow);
    return { ...assetRow };
  }
}
