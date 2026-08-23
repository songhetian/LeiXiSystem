-- AlterTable
ALTER TABLE `export_tasks` ADD COLUMN `retry_count` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `max_retries` INTEGER NOT NULL DEFAULT 3;
