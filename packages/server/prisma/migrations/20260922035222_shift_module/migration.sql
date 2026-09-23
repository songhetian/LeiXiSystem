-- CreateTable
CREATE TABLE `work_shifts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `workHours` DECIMAL(3, 1) NOT NULL,
    `restDuration` INTEGER NOT NULL DEFAULT 0,
    `lateThreshold` INTEGER NULL,
    `earlyThreshold` INTEGER NULL,
    `useGlobalThreshold` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `departmentId` INTEGER NULL,
    `description` VARCHAR(191) NULL,
    `color` VARCHAR(191) NOT NULL DEFAULT '#3B82F6',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shift_schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `scheduleDate` VARCHAR(191) NOT NULL,
    `isRestDay` BOOLEAN NOT NULL DEFAULT false,
    `userId` INTEGER NOT NULL,
    `shiftId` INTEGER NULL,
    `departmentId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `shift_schedules_userId_scheduleDate_key`(`userId`, `scheduleDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `work_shifts` ADD CONSTRAINT `work_shifts_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shift_schedules` ADD CONSTRAINT `shift_schedules_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shift_schedules` ADD CONSTRAINT `shift_schedules_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `work_shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shift_schedules` ADD CONSTRAINT `shift_schedules_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
