-- TOTP（验证器应用）第二因素支持（可选绑定）
-- totp_secret: 绑定验证器时的 base32 密钥（未验证前为待确认状态）
-- totp_enabled: 1 = 已绑定并验证，可作为 2FA 第二因素
-- 执行方式: npx wrangler d1 migrations apply bookmarks-db --remote

ALTER TABLE users ADD COLUMN totp_secret TEXT;
ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0;
