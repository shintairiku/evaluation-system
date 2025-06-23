-- Remove from users table
ALTER TABLE users DROP COLUMN employment_type;
DROP TYPE employment_type_enum;