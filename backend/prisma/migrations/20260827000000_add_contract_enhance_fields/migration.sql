-- 合同管理增强：到期预警/续签/终止/附件
-- 说明：MySQL 不支持 ADD COLUMN IF NOT EXISTS，幂等通过 migration 机制保证（该迁移只执行一次）。
ALTER TABLE `contracts`
  ADD COLUMN `attachment_url` VARCHAR(500) NULL,
  ADD COLUMN `renewal_count` INT NOT NULL DEFAULT 0,
  ADD COLUMN `terminated_by` VARCHAR(100) NULL;