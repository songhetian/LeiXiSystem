-- 报销基础字典：一级「报销类型」+ 二级「费用类型」
--
-- 背景：seed-real-data.ts 里有 5 个一级类型，但生产环境不执行种子（SEED_ON_BOOT=false），
-- 报销配置页因此是空列表，报销单选不到类型、流程走不下去。
-- 这里用纯 DML 幂等补齐，线上 `migrate deploy` 即生效。
--
-- 幂等口径：
--   reimbursement_types 有唯一键 code → INSERT ... ON DUPLICATE KEY UPDATE 只刷新名称/描述
--   expense_types 没有业务唯一键 → INSERT ... SELECT ... WHERE NOT EXISTS (按 name 判重)

-- 1) 一级报销类型（与 seed-real-data.ts 的 REIMBURSEMENT_TYPES 保持一致）
INSERT INTO `reimbursement_types` (`code`, `name`, `description`, `status`, `created_at`, `updated_at`)
VALUES
  ('travel',        '差旅费',     '出差交通住宿',       'active', NOW(), NOW()),
  ('entertainment', '业务招待费', '客户接待餐饮',       'active', NOW(), NOW()),
  ('office',        '办公耗材',   '办公设备与耗材',     'active', NOW(), NOW()),
  ('traffic',       '市内交通费', '市内打车公交',       'active', NOW(), NOW()),
  ('welfare',       '员工福利',   '团队建设与福利采购', 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`);

-- 2) 二级费用类型（sort_order 控制配置页展示顺序）
INSERT INTO `expense_types` (`name`, `unit`, `sort_order`, `status`, `created_at`, `updated_at`)
SELECT '飞机票', '张', 10, 'active', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expense_types` WHERE `name` = '飞机票');

INSERT INTO `expense_types` (`name`, `unit`, `sort_order`, `status`, `created_at`, `updated_at`)
SELECT '火车票', '张', 20, 'active', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expense_types` WHERE `name` = '火车票');

INSERT INTO `expense_types` (`name`, `unit`, `sort_order`, `status`, `created_at`, `updated_at`)
SELECT '长途汽车票', '张', 30, 'active', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expense_types` WHERE `name` = '长途汽车票');

INSERT INTO `expense_types` (`name`, `unit`, `sort_order`, `status`, `created_at`, `updated_at`)
SELECT '住宿费', '晚', 40, 'active', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expense_types` WHERE `name` = '住宿费');

INSERT INTO `expense_types` (`name`, `unit`, `sort_order`, `status`, `created_at`, `updated_at`)
SELECT '出差补贴', '天', 50, 'active', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expense_types` WHERE `name` = '出差补贴');

INSERT INTO `expense_types` (`name`, `unit`, `sort_order`, `status`, `created_at`, `updated_at`)
SELECT '市内交通费', '次', 60, 'active', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expense_types` WHERE `name` = '市内交通费');

INSERT INTO `expense_types` (`name`, `unit`, `sort_order`, `status`, `created_at`, `updated_at`)
SELECT '停车费', '次', 70, 'active', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expense_types` WHERE `name` = '停车费');

INSERT INTO `expense_types` (`name`, `unit`, `sort_order`, `status`, `created_at`, `updated_at`)
SELECT '过路费', '次', 80, 'active', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expense_types` WHERE `name` = '过路费');

INSERT INTO `expense_types` (`name`, `unit`, `sort_order`, `status`, `created_at`, `updated_at`)
SELECT '招待餐费', '次', 90, 'active', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expense_types` WHERE `name` = '招待餐费');

INSERT INTO `expense_types` (`name`, `unit`, `sort_order`, `status`, `created_at`, `updated_at`)
SELECT '招待礼品', '份', 100, 'active', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expense_types` WHERE `name` = '招待礼品');

INSERT INTO `expense_types` (`name`, `unit`, `sort_order`, `status`, `created_at`, `updated_at`)
SELECT '办公用品', '件', 110, 'active', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expense_types` WHERE `name` = '办公用品');

INSERT INTO `expense_types` (`name`, `unit`, `sort_order`, `status`, `created_at`, `updated_at`)
SELECT '打印复印', '次', 120, 'active', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expense_types` WHERE `name` = '打印复印');

INSERT INTO `expense_types` (`name`, `unit`, `sort_order`, `status`, `created_at`, `updated_at`)
SELECT '快递费', '单', 130, 'active', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expense_types` WHERE `name` = '快递费');

INSERT INTO `expense_types` (`name`, `unit`, `sort_order`, `status`, `created_at`, `updated_at`)
SELECT '软件订阅', '项', 140, 'active', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expense_types` WHERE `name` = '软件订阅');

INSERT INTO `expense_types` (`name`, `unit`, `sort_order`, `status`, `created_at`, `updated_at`)
SELECT '手机话费', '月', 150, 'active', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expense_types` WHERE `name` = '手机话费');

INSERT INTO `expense_types` (`name`, `unit`, `sort_order`, `status`, `created_at`, `updated_at`)
SELECT '宽带费', '月', 160, 'active', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expense_types` WHERE `name` = '宽带费');

INSERT INTO `expense_types` (`name`, `unit`, `sort_order`, `status`, `created_at`, `updated_at`)
SELECT '团队活动费', '次', 170, 'active', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expense_types` WHERE `name` = '团队活动费');

INSERT INTO `expense_types` (`name`, `unit`, `sort_order`, `status`, `created_at`, `updated_at`)
SELECT '节日礼品', '份', 180, 'active', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expense_types` WHERE `name` = '节日礼品');

INSERT INTO `expense_types` (`name`, `unit`, `sort_order`, `status`, `created_at`, `updated_at`)
SELECT '其他费用', '项', 999, 'active', NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `expense_types` WHERE `name` = '其他费用');
