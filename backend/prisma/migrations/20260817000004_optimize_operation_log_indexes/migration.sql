-- Drop old single-column indexes
DROP INDEX `operation_logs_user_id_idx` ON `operation_logs`;
DROP INDEX `operation_logs_module_idx` ON `operation_logs`;

-- Create composite indexes for common query patterns
-- (equality column first, range/sort column last - follows leftmost prefix rule)
CREATE INDEX `operation_logs_user_id_created_at_idx` ON `operation_logs`(`user_id`, `created_at`);
CREATE INDEX `operation_logs_module_created_at_idx` ON `operation_logs`(`module`, `created_at`);
CREATE INDEX `operation_logs_action_created_at_idx` ON `operation_logs`(`action`, `created_at`);
CREATE INDEX `operation_logs_status_created_at_idx` ON `operation_logs`(`status`, `created_at`);
