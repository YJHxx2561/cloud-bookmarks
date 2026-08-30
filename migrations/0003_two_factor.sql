-- 可选双重认证（2FA）开关
-- 默认关闭：用户同时有密码和通行密钥时，两种方式可各自独立登录
-- 开启后：登录必须「密码 + 通行密钥」两步共同验证
-- 执行方式: npx wrangler d1 migrations apply bookmarks-db --remote

ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER NOT NULL DEFAULT 0;
