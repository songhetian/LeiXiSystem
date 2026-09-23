-- 薪资调整留痕表：每次改薪写一条，带生效月（YYYY-MM）。
CREATE TABLE `salary_adjustments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `employee_id` INT NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `effective_month` VARCHAR(7) NOT NULL,
  `remark` VARCHAR(255) NULL,
  `changed_by` INT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `salary_adjustments_employee_id_effective_month_idx` (`employee_id`, `effective_month`),
  CONSTRAINT `fk_salary_adjustments_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;