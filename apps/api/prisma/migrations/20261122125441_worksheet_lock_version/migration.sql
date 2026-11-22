-- lock_version - optimistic lock for PATCH and item operations

-- AlterTable
ALTER TABLE "worksheet" ADD COLUMN     "lock_version" INTEGER NOT NULL DEFAULT 1;
