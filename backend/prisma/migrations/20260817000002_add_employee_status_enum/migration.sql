-- AlterTable
ALTER TABLE `employees` MODIFY COLUMN `status` ENUM('active', 'probation', 'resigned', 'retired') NOT NULL DEFAULT 'active';
