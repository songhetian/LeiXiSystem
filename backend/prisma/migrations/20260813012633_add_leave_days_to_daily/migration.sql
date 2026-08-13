/*
  Warnings:

  - You are about to alter the column `first_punch` on the `attendance_daily` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `last_punch` on the `attendance_daily` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `start_time` on the `overtime_records` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `end_time` on the `overtime_records` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `last_sync_time` on the `punch_devices` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `punch_time` on the `punch_logs` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `last_sync_time` on the `punch_sync_state` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.

*/
-- AlterTable
ALTER TABLE `attendance_daily` ADD COLUMN `leave_days` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    MODIFY `first_punch` DATETIME NULL,
    MODIFY `last_punch` DATETIME NULL;

-- AlterTable
ALTER TABLE `overtime_records` MODIFY `start_time` DATETIME NOT NULL,
    MODIFY `end_time` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `punch_devices` MODIFY `last_sync_time` DATETIME NULL;

-- AlterTable
ALTER TABLE `punch_logs` MODIFY `punch_time` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `punch_sync_state` MODIFY `last_sync_time` DATETIME NOT NULL;
