-- CreateTable
CREATE TABLE `attendance_exceptions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(191) NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `minutes` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `remark` VARCHAR(191) NULL,
    `userId` INTEGER NOT NULL,
    `departmentId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `attendance_exceptions_userId_date_type_key`(`userId`, `date`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `attendance_exceptions` ADD CONSTRAINT `attendance_exceptions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_exceptions` ADD CONSTRAINT `attendance_exceptions_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
