-- AlterTable: employees - add personal and employment fields
ALTER TABLE `employees`
    ADD COLUMN `gender` VARCHAR(10) NULL,
    ADD COLUMN `birth_date` DATE NULL,
    ADD COLUMN `id_card_no` VARCHAR(20) NULL,
    ADD COLUMN `nationality` VARCHAR(50) NULL,
    ADD COLUMN `marital_status` VARCHAR(20) NULL,
    ADD COLUMN `bank_name` VARCHAR(100) NULL,
    ADD COLUMN `bank_account_no` VARCHAR(50) NULL,
    ADD COLUMN `termination_date` DATE NULL,
    ADD COLUMN `termination_type` VARCHAR(50) NULL,
    ADD COLUMN `termination_reason` VARCHAR(500) NULL,
    ADD COLUMN `probation_end_date` DATE NULL,
    ADD COLUMN `contract_sign_date` DATE NULL;

-- CreateTable: employee_emergency_contacts
CREATE TABLE `employee_emergency_contacts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `relationship` VARCHAR(50) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_emergency_contacts_employee_id_idx`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: employee_emergency_contacts -> employees
ALTER TABLE `employee_emergency_contacts`
    ADD CONSTRAINT `employee_emergency_contacts_employee_id_fkey`
    FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: candidates - add personal and salary fields
ALTER TABLE `candidates`
    ADD COLUMN `gender` VARCHAR(10) NULL,
    ADD COLUMN `birth_date` DATE NULL,
    ADD COLUMN `id_card_no` VARCHAR(20) NULL,
    ADD COLUMN `nationality` VARCHAR(50) NULL,
    ADD COLUMN `marital_status` VARCHAR(20) NULL,
    ADD COLUMN `address` VARCHAR(500) NULL,
    ADD COLUMN `expected_salary` DECIMAL(12, 2) NULL,
    ADD COLUMN `current_salary` DECIMAL(12, 2) NULL,
    ADD COLUMN `notice_period_days` INTEGER NULL;

-- AlterTable: helpdesk_tickets - add SLA and feedback fields
ALTER TABLE `helpdesk_tickets`
    ADD COLUMN `sla_deadline` DATETIME(3) NULL,
    ADD COLUMN `resolution` VARCHAR(1000) NULL,
    ADD COLUMN `feedback_rating` INTEGER NULL;

-- AlterTable: performance_reviews - add development and promotion fields
ALTER TABLE `performance_reviews`
    ADD COLUMN `development_plan` VARCHAR(1000) NULL,
    ADD COLUMN `promotion_recommendation` VARCHAR(20) NULL;
