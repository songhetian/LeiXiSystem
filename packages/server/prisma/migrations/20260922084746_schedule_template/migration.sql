-- CreateTable
CREATE TABLE `schedule_templates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `schedule_templates_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schedule_template_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `templateId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `weekday` INTEGER NOT NULL,
    `shiftId` INTEGER NULL,
    `isRestDay` BOOLEAN NOT NULL DEFAULT false,
    `departmentId` INTEGER NULL,

    UNIQUE INDEX `schedule_template_items_templateId_userId_weekday_key`(`templateId`, `userId`, `weekday`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `schedule_template_items` ADD CONSTRAINT `schedule_template_items_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `schedule_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedule_template_items` ADD CONSTRAINT `schedule_template_items_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedule_template_items` ADD CONSTRAINT `schedule_template_items_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `work_shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedule_template_items` ADD CONSTRAINT `schedule_template_items_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
