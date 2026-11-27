import path from 'node:path';
import { LocalDisk, type StorageModuleOptions } from '@nestjs/storage';

/**
 * File storage settings, read from the environment on every call (so tests can change them):
 *   STORAGE_ROOT              folder of the local disk; relative paths resolve against the working
 *                             directory (apps/api when started with pnpm); default "storage"
 *   STORAGE_MAX_FILE_BYTES    largest accepted upload; default 5 MiB
 */
export interface StorageConfig {
  root: string;
  maxFileBytes: number;
}

export function storageConfig(): StorageConfig {
  const maxFileBytes = Number(process.env.STORAGE_MAX_FILE_BYTES ?? 5 * 1024 * 1024);
  if (!Number.isInteger(maxFileBytes) || maxFileBytes <= 0) {
    throw new Error('STORAGE_MAX_FILE_BYTES must be a positive whole number of bytes.');
  }
  return {
    root: path.resolve(process.env.STORAGE_ROOT ?? 'storage'),
    maxFileBytes,
  };
}

/**
 * The StorageModule.forRootAsync() factory: Nest calls it once while building the container, so a
 * test can override STORAGE_MODULE_OPTIONS (e.g. with an InMemoryDisk) and this never runs.
 * The local disk keeps files on one machine only, so production refuses to start with it;
 * an S3/R2 disk will be chosen here instead.
 */
export function createStorageOptions(): StorageModuleOptions {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Local file storage is not allowed in production; configure an S3/R2 disk.');
  }
  return {
    default: 'assets',
    disks: { assets: new LocalDisk({ root: storageConfig().root }) },
  };
}
