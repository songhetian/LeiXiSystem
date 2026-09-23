-- AlterTable
ALTER TABLE `reimburses` ADD COLUMN `categoryId` INTEGER NULL;

-- CreateTable
CREATE TABLE `reimburse_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `reimburse_categories_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reimburse_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reimburseId` INTEGER NOT NULL,
    `categoryId` INTEGER NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `note` VARCHAR(191) NULL,

    INDEX `reimburse_items_reimburseId_idx`(`reimburseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `reimburses` ADD CONSTRAINT `reimburses_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `reimburse_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reimburse_items` ADD CONSTRAINT `reimburse_items_reimburseId_fkey` FOREIGN KEY (`reimburseId`) REFERENCES `reimburses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reimburse_items` ADD CONSTRAINT `reimburse_items_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `reimburse_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
