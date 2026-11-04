-- 用户隐私二级密码
--
-- 【背景】工资条等高敏数据的二次验证此前复用登录密码，无法独立设置/修改。
--   新增可独立管理的隐私密码：null = 未设置（验证时回退登录密码，兼容存量用户），
--   设置后仅认隐私密码。忘记时可用登录密码重置（见 auth 域 privacy-password 接口）。

ALTER TABLE `users`
    ADD COLUMN `privacy_password_hash` VARCHAR(255) NULL;
