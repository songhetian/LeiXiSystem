-- CreateTable
CREATE TABLE `work_attendance_settings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `earlyClockInMinutes` INTEGER NOT NULL DEFAULT 5,
    `lateClockOutMinutes` INTEGER NOT NULL DEFAULT 5,
    `lateMinutes` INTEGER NOT NULL DEFAULT 0,
    `earlyLeaveMinutes` INTEGER NOT NULL DEFAULT 0,
    `absentHours` INTEGER NOT NULL DEFAULT 4,
    `allowMakeup` BOOLEAN NOT NULL DEFAULT true,
    `makeupDeadlineDays` INTEGER NOT NULL DEFAULT 7,
    `requireApprovalForMakeup` BOOLEAN NOT NULL DEFAULT true,
    `notifyOnLate` BOOLEAN NOT NULL DEFAULT true,
    `notifyOnEarlyLeave` BOOLEAN NOT NULL DEFAULT true,
    `notifyOnAbsent` BOOLEAN NOT NULL DEFAULT true,
    `enableTimeCheck` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_holidays` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `year` INTEGER NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'national',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `work_holidays_date_key`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
