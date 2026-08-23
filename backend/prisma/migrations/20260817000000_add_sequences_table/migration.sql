-- CreateTable
CREATE TABLE `sequences` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `current_value` INTEGER NOT NULL DEFAULT 0,
    `step` INTEGER NOT NULL DEFAULT 1,
    `description` VARCHAR(200) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sequences_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
