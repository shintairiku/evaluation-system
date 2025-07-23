-- Remove authentication-related fields from users table
-- Since we're using Clerk for authentication, these fields are not needed

ALTER TABLE users DROP COLUMN IF EXISTS password;
ALTER TABLE users DROP COLUMN IF EXISTS hashed_refresh_token;
ALTER TABLE users DROP COLUMN IF EXISTS last_login_at;