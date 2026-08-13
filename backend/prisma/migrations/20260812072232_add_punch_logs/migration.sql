-- CreateTable
CREATE TABLE `punch_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_no` VARCHAR(20) NOT NULL,
    `device_no` VARCHAR(50) NOT NULL,
    `punch_time` DATETIME NOT NULL,
    `punch_type` VARCHAR(10) NULL,
    `source` ENUM('import', 'db', 'api', 'manual') NOT NULL DEFAULT 'import',
    `raw_data` VARCHAR(500) NULL,
    `status` ENUM('pending', 'matched', 'abnormal', 'ignored') NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `punch_logs_punch_time_idx`(`punch_time`),
    INDEX `punch_logs_status_idx`(`status`),
    UNIQUE INDEX `punch_logs_employee_no_punch_time_device_no_key`(`employee_no`, `punch_time`, `device_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
