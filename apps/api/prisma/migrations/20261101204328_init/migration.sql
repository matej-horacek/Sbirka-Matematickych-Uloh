-- CreateEnum
CREATE TYPE "asset_status" AS ENUM ('PENDING', 'READY');

-- CreateEnum
CREATE TYPE "asset_type" AS ENUM ('IMAGE');

-- CreateEnum
CREATE TYPE "attachment_placement" AS ENUM ('BELOW', 'RIGHT');

-- CreateEnum
CREATE TYPE "attachment_size" AS ENUM ('S', 'M', 'L');

-- CreateEnum
CREATE TYPE "audit_target_type" AS ENUM ('PROBLEM', 'WORKSHEET', 'USER', 'CHAPTER', 'TAG', 'REPORT', 'LICENSE', 'LANGUAGE');

-- CreateEnum
CREATE TYPE "citation_audience" AS ENUM ('PUBLIC', 'TEACHER_ONLY');

-- CreateEnum
CREATE TYPE "content_origin" AS ENUM ('OWN', 'LICENSED_USE', 'FREE_USE');

-- CreateEnum
CREATE TYPE "moderation_action" AS ENUM ('APPROVED', 'REJECTED', 'WITHDRAWN', 'BLOCKED', 'UNBLOCKED', 'TEACHER_VERIFIED', 'TRUST_GRANTED', 'TRUST_REVOKED', 'ROLE_CHANGED', 'ACCOUNT_BLOCKED', 'ACCOUNT_UNBLOCKED', 'ACCOUNT_DELETED', 'REPORT_DISMISSED', 'CHAPTER_EDITED', 'TAG_MERGED', 'TAG_RENAMED', 'CODELIST_EDITED');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('CONTENT_APPROVED', 'CONTENT_REJECTED', 'CONTENT_WITHDRAWN', 'CONTENT_BLOCKED', 'CONTENT_UNBLOCKED', 'SET_CHILD_REMOVED', 'WORKSHEET_ITEM_REMOVED', 'ACCOUNT_VERIFIED', 'ROLE_CHANGED');

-- CreateEnum
CREATE TYPE "publish_status" AS ENUM ('PRIVATE', 'REVIEWING', 'PUBLISHED', 'WITHDRAWN', 'BLOCKED');

-- CreateEnum
CREATE TYPE "report_category" AS ENUM ('COPYRIGHT', 'INAPPROPRIATE', 'ILLEGAL', 'OTHER');

-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('OPEN', 'DISMISSED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "report_target_type" AS ENUM ('PROBLEM', 'WORKSHEET', 'USER');

-- CreateEnum
CREATE TYPE "request_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "revision_status" AS ENUM ('REVIEWING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('SUPERADMIN', 'ADMIN', 'TRUSTED_TEACHER', 'VERIFIED_TEACHER', 'REGISTERED_TEACHER');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "worksheet_citation_display" AS ENUM ('INLINE', 'HIDDEN', 'SUMMARY_AT_END');

-- CreateTable
CREATE TABLE "asset" (
    "id" SERIAL NOT NULL,
    "storage_key" TEXT NOT NULL,
    "type" "asset_type" NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "status" "asset_status" NOT NULL DEFAULT 'PENDING',
    "uploaded_by" INTEGER NOT NULL,
    "source_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachment" (
    "problem_id" INTEGER NOT NULL,
    "asset_id" INTEGER NOT NULL,
    "position" VARCHAR(64) NOT NULL,
    "placement" "attachment_placement" NOT NULL DEFAULT 'BELOW',
    "size" "attachment_size" NOT NULL DEFAULT 'M',

    CONSTRAINT "attachment_pkey" PRIMARY KEY ("problem_id","asset_id")
);

-- CreateTable
CREATE TABLE "chapter" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "parent_id" INTEGER,
    "is_global" BOOLEAN NOT NULL,
    "author_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_source" (
    "id" SERIAL NOT NULL,
    "origin_type" "content_origin" NOT NULL,
    "source_citation_text" TEXT,
    "license_id" INTEGER,
    "license_note" TEXT,
    "citation_audience" "citation_audience" NOT NULL DEFAULT 'PUBLIC',
    "show_in_web" BOOLEAN NOT NULL DEFAULT true,
    "show_in_pdf" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "content_source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "language" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(10) NOT NULL,

    CONSTRAINT "language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "requires_attribution" BOOLEAN NOT NULL,
    "allows_modification" BOOLEAN NOT NULL,
    "requires_share_alike" BOOLEAN NOT NULL,
    "allows_publication" BOOLEAN NOT NULL,

    CONSTRAINT "license_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_log" (
    "id" SERIAL NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "actor_role" "user_role" NOT NULL,
    "action" "moderation_action" NOT NULL,
    "target_type" "audit_target_type" NOT NULL,
    "target_id" INTEGER NOT NULL,
    "reason" TEXT,
    "snapshot" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" SERIAL NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "type" "notification_type" NOT NULL,
    "target_type" "audit_target_type" NOT NULL,
    "target_id" INTEGER NOT NULL,
    "moderation_log_id" INTEGER,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problem" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "assignment" TEXT NOT NULL,
    "solution" TEXT,
    "result" TEXT,
    "content_schema_version" INTEGER NOT NULL DEFAULT 1,
    "difficulty" INTEGER,
    "author_id" INTEGER NOT NULL,
    "publish_status" "publish_status" NOT NULL DEFAULT 'PRIVATE',
    "language_id" INTEGER,
    "source_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "lock_version" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "minor_version" INTEGER NOT NULL DEFAULT 0,
    "original_problem_id" INTEGER,
    "original_problem_version" INTEGER,
    "dismissed_update_version" INTEGER,

    CONSTRAINT "problem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problem_chapter" (
    "problem_id" INTEGER NOT NULL,
    "chapter_id" INTEGER NOT NULL,

    CONSTRAINT "problem_chapter_pkey" PRIMARY KEY ("problem_id","chapter_id")
);

-- CreateTable
CREATE TABLE "problem_part" (
    "parent_id" INTEGER NOT NULL,
    "child_id" INTEGER NOT NULL,
    "position" VARCHAR(64) NOT NULL,

    CONSTRAINT "problem_part_pkey" PRIMARY KEY ("parent_id","child_id")
);

-- CreateTable
CREATE TABLE "problem_revision" (
    "id" SERIAL NOT NULL,
    "problem_id" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "content_schema_version" INTEGER NOT NULL,
    "status" "revision_status" NOT NULL DEFAULT 'REVIEWING',
    "reason" TEXT,
    "reviewed_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(6),
    "auto_approved" BOOLEAN NOT NULL DEFAULT false,
    "minor" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "problem_revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problem_share" (
    "problem_id" INTEGER NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "problem_share_pkey" PRIMARY KEY ("problem_id","recipient_id")
);

-- CreateTable
CREATE TABLE "problem_tag" (
    "problem_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "problem_tag_pkey" PRIMARY KEY ("problem_id","tag_id")
);

-- CreateTable
CREATE TABLE "refresh_token" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report" (
    "id" SERIAL NOT NULL,
    "target_id" INTEGER NOT NULL,
    "reporter_id" INTEGER,
    "category" "report_category" NOT NULL,
    "text" TEXT,
    "status" "report_status" NOT NULL DEFAULT 'OPEN',
    "resolved_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),
    "target_type" "report_target_type" NOT NULL,
    "moderation_log_id" INTEGER,

    CONSTRAINT "report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_link" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "worksheet_id" INTEGER,
    "problem_id" INTEGER,
    "created_by" INTEGER NOT NULL,
    "include_solutions" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_event" (
    "id" SERIAL NOT NULL,
    "rule" VARCHAR(50) NOT NULL,
    "target_type" "audit_target_type" NOT NULL,
    "target_id" INTEGER NOT NULL,
    "snapshot" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "is_global" BOOLEAN NOT NULL,
    "author_id" INTEGER,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(100),
    "role" "user_role" NOT NULL DEFAULT 'REGISTERED_TEACHER',
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "language_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anonymized_at" TIMESTAMPTZ(6),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_request" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "status" "request_status" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "resolved_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "verification_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worksheet" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "difficulty" INTEGER,
    "author_id" INTEGER NOT NULL,
    "publish_status" "publish_status" NOT NULL DEFAULT 'PRIVATE',
    "language_id" INTEGER,
    "license_id" INTEGER,
    "citation_display" "worksheet_citation_display" NOT NULL DEFAULT 'INLINE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "original_worksheet_id" INTEGER,
    "original_worksheet_version" INTEGER,
    "dismissed_update_version" INTEGER,

    CONSTRAINT "worksheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worksheet_chapter" (
    "worksheet_id" INTEGER NOT NULL,
    "chapter_id" INTEGER NOT NULL,

    CONSTRAINT "worksheet_chapter_pkey" PRIMARY KEY ("worksheet_id","chapter_id")
);

-- CreateTable
CREATE TABLE "worksheet_problem" (
    "worksheet_id" INTEGER NOT NULL,
    "problem_id" INTEGER NOT NULL,
    "position" VARCHAR(64) NOT NULL,

    CONSTRAINT "worksheet_problem_pkey" PRIMARY KEY ("worksheet_id","problem_id")
);

-- CreateTable
CREATE TABLE "worksheet_share" (
    "worksheet_id" INTEGER NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worksheet_share_pkey" PRIMARY KEY ("worksheet_id","recipient_id")
);

-- CreateTable
CREATE TABLE "worksheet_tag" (
    "worksheet_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "worksheet_tag_pkey" PRIMARY KEY ("worksheet_id","tag_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_storage_key_key" ON "asset"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "asset_source_id_key" ON "asset"("source_id");

-- CreateIndex
CREATE INDEX "asset_sha256_idx" ON "asset"("sha256");

-- CreateIndex
CREATE INDEX "asset_status_created_at_idx" ON "asset"("status", "created_at");

-- CreateIndex
CREATE INDEX "attachment_asset_id_idx" ON "attachment"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "attachment_problem_id_position_idx" ON "attachment"("problem_id", "position");

-- CreateIndex
CREATE INDEX "chapter_parent_id_idx" ON "chapter"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "language_code_key" ON "language"("code");

-- CreateIndex
CREATE INDEX "moderation_log_actor_id_created_at_idx" ON "moderation_log"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "moderation_log_created_at_idx" ON "moderation_log"("created_at");

-- CreateIndex
CREATE INDEX "moderation_log_target_type_target_id_idx" ON "moderation_log"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "notification_recipient_id_read_at_idx" ON "notification"("recipient_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "problem_source_id_key" ON "problem"("source_id");

-- CreateIndex
CREATE INDEX "problem_author_id_idx" ON "problem"("author_id");

-- CreateIndex
CREATE INDEX "problem_original_problem_id_idx" ON "problem"("original_problem_id");

-- CreateIndex
CREATE INDEX "problem_publish_status_created_at_idx" ON "problem"("publish_status", "created_at");

-- CreateIndex
CREATE INDEX "problem_chapter_chapter_id_idx" ON "problem_chapter"("chapter_id");

-- CreateIndex
CREATE UNIQUE INDEX "problem_part_child_id_idx" ON "problem_part"("child_id");

-- CreateIndex
CREATE UNIQUE INDEX "problem_part_parent_id_position_idx" ON "problem_part"("parent_id", "position");

-- CreateIndex
CREATE INDEX "problem_revision_problem_id_idx" ON "problem_revision"("problem_id");

-- CreateIndex
CREATE INDEX "problem_revision_status_created_at_idx" ON "problem_revision"("status", "created_at");

-- CreateIndex
CREATE INDEX "problem_share_recipient_id_idx" ON "problem_share"("recipient_id");

-- CreateIndex
CREATE INDEX "problem_tag_tag_id_idx" ON "problem_tag"("tag_id");

-- CreateIndex
CREATE INDEX "report_status_created_at_idx" ON "report"("status", "created_at");

-- CreateIndex
CREATE INDEX "report_target_type_target_id_idx" ON "report"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "share_link_code_key" ON "share_link"("code");

-- CreateIndex
CREATE INDEX "share_link_created_by_idx" ON "share_link"("created_by");

-- CreateIndex
CREATE INDEX "system_event_created_at_idx" ON "system_event"("created_at");

-- CreateIndex
CREATE INDEX "system_event_target_type_target_id_idx" ON "system_event"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "verification_request_status_created_at_idx" ON "verification_request"("status", "created_at");

-- CreateIndex
CREATE INDEX "worksheet_author_id_idx" ON "worksheet"("author_id");

-- CreateIndex
CREATE INDEX "worksheet_original_worksheet_id_idx" ON "worksheet"("original_worksheet_id");

-- CreateIndex
CREATE INDEX "worksheet_publish_status_created_at_idx" ON "worksheet"("publish_status", "created_at");

-- CreateIndex
CREATE INDEX "worksheet_chapter_chapter_id_idx" ON "worksheet_chapter"("chapter_id");

-- CreateIndex
CREATE UNIQUE INDEX "worksheet_problem_worksheet_id_position_idx" ON "worksheet_problem"("worksheet_id", "position");

-- CreateIndex
CREATE INDEX "worksheet_share_recipient_id_idx" ON "worksheet_share"("recipient_id");

-- CreateIndex
CREATE INDEX "worksheet_tag_tag_id_idx" ON "worksheet_tag"("tag_id");

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "content_source"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "asset"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problem"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "chapter"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "content_source" ADD CONSTRAINT "content_source_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "license"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "moderation_log" ADD CONSTRAINT "moderation_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_moderation_log_id_fkey" FOREIGN KEY ("moderation_log_id") REFERENCES "moderation_log"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "problem" ADD CONSTRAINT "problem_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "problem" ADD CONSTRAINT "problem_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "language"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "problem" ADD CONSTRAINT "problem_original_problem_id_fkey" FOREIGN KEY ("original_problem_id") REFERENCES "problem"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "problem" ADD CONSTRAINT "problem_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "content_source"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "problem_chapter" ADD CONSTRAINT "problem_chapter_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapter"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "problem_chapter" ADD CONSTRAINT "problem_chapter_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problem"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "problem_part" ADD CONSTRAINT "problem_part_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "problem"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "problem_part" ADD CONSTRAINT "problem_part_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "problem"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "problem_revision" ADD CONSTRAINT "problem_revision_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problem"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "problem_revision" ADD CONSTRAINT "problem_revision_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "problem_share" ADD CONSTRAINT "problem_share_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problem"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "problem_share" ADD CONSTRAINT "problem_share_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "problem_tag" ADD CONSTRAINT "problem_tag_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problem"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "problem_tag" ADD CONSTRAINT "problem_tag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_moderation_log_id_fkey" FOREIGN KEY ("moderation_log_id") REFERENCES "moderation_log"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "share_link" ADD CONSTRAINT "share_link_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "share_link" ADD CONSTRAINT "share_link_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problem"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "share_link" ADD CONSTRAINT "share_link_worksheet_id_fkey" FOREIGN KEY ("worksheet_id") REFERENCES "worksheet"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tag" ADD CONSTRAINT "tag_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "language"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "verification_request" ADD CONSTRAINT "verification_request_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "verification_request" ADD CONSTRAINT "verification_request_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "worksheet" ADD CONSTRAINT "worksheet_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "worksheet" ADD CONSTRAINT "worksheet_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "language"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "worksheet" ADD CONSTRAINT "worksheet_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "license"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "worksheet" ADD CONSTRAINT "worksheet_original_worksheet_id_fkey" FOREIGN KEY ("original_worksheet_id") REFERENCES "worksheet"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "worksheet_chapter" ADD CONSTRAINT "worksheet_chapter_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapter"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "worksheet_chapter" ADD CONSTRAINT "worksheet_chapter_worksheet_id_fkey" FOREIGN KEY ("worksheet_id") REFERENCES "worksheet"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "worksheet_problem" ADD CONSTRAINT "worksheet_problem_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problem"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "worksheet_problem" ADD CONSTRAINT "worksheet_problem_worksheet_id_fkey" FOREIGN KEY ("worksheet_id") REFERENCES "worksheet"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "worksheet_share" ADD CONSTRAINT "worksheet_share_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "worksheet_share" ADD CONSTRAINT "worksheet_share_worksheet_id_fkey" FOREIGN KEY ("worksheet_id") REFERENCES "worksheet"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "worksheet_tag" ADD CONSTRAINT "worksheet_tag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "worksheet_tag" ADD CONSTRAINT "worksheet_tag_worksheet_id_fkey" FOREIGN KEY ("worksheet_id") REFERENCES "worksheet"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "problem_revision" ADD CONSTRAINT "revision_auto_no_reviewer"
    CHECK (NOT auto_approved OR (status = 'APPROVED' AND reviewed_by IS NULL));
ALTER TABLE "problem_revision" ADD CONSTRAINT "revision_approved_has_reviewer"
    CHECK (status <> 'APPROVED' OR auto_approved OR reviewed_by IS NOT NULL);
ALTER TABLE "problem_part" ALTER COLUMN "position" TYPE varchar(64) COLLATE "C";