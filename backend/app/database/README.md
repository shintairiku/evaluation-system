# Database Migration System

Simple SQL-only migration system. No tools, no confusion.

## How to Add New Database Changes

### 1. Create Migration File
Add a new `.sql` file in `migrations/User/` with incremental numbering:

```
migrations/User/
  001_create_departments.sql
  002_create_stages.sql  
  003_create_roles.sql
  004_create_users.sql
  005_create_users_roles.sql
  006_create_users_supervisors.sql
  007_your_new_migration.sql  ← Add here
```

### 2. Write Pure SQL

#### Adding New Table
```sql
-- 007_add_projects_table.sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Updating Existing Table
```sql
-- 008_add_status_to_users.sql
ALTER TABLE users ADD COLUMN status_updated_at TIMESTAMP;
ALTER TABLE users ADD COLUMN last_activity TIMESTAMP;
```

#### Adding Indexes
```sql
-- 009_add_user_indexes.sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
```

#### Modifying Columns
```sql
-- 010_update_user_email_length.sql
ALTER TABLE users ALTER COLUMN email TYPE VARCHAR(320);
```

### 3. Run Migrations
```bash
cd backend/app/database/scripts
python run_migrations.py
```

## Features

✅ **Incremental updates** - Only runs new migrations  
✅ **Duplication detection** - Tracks applied migrations in `schema_migrations` table  
✅ **Transaction safety** - Each migration runs in a transaction  
✅ **Simple** - Just SQL files, no tools  

## Common Migration Patterns

### Adding Columns (Safe)
```sql
-- 011_add_user_preferences.sql
ALTER TABLE users ADD COLUMN preferences JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN timezone VARCHAR(50) DEFAULT 'UTC';
```

### Dropping Columns (Careful!)
```sql
-- 012_remove_old_password_field.sql
ALTER TABLE users DROP COLUMN old_password;
```

### Renaming Columns
```sql
-- 013_rename_user_field.sql
ALTER TABLE users RENAME COLUMN old_name TO new_name;
```

### Adding Foreign Keys
```sql
-- 014_add_project_user_fk.sql
ALTER TABLE projects ADD COLUMN user_id UUID;
ALTER TABLE projects ADD CONSTRAINT fk_projects_user 
  FOREIGN KEY (user_id) REFERENCES users(id);
```

### Data Migration
```sql
-- 015_migrate_user_data.sql
UPDATE users SET status = 'active' WHERE status IS NULL;
UPDATE users SET created_at = NOW() WHERE created_at IS NULL;
```

### Seed Data
```sql
-- 016_seed_initial_data.sql
-- Insert default roles
INSERT INTO roles (id, name, description) VALUES 
(1, 'admin', 'System administrator'),
(2, 'supervisor', 'Department supervisor'), 
(3, 'employee', 'Regular employee'),
(4, 'viewer', 'Read-only access')
ON CONFLICT (id) DO NOTHING;

-- Insert default departments
INSERT INTO departments (id, name, description) VALUES 
('dept-001-sales', 'Sales', 'Sales department'),
('dept-002-engineering', 'Engineering', 'Engineering department'),
('dept-003-hr', 'HR', 'Human Resources department')
ON CONFLICT (id) DO NOTHING;

-- Insert default stages
INSERT INTO stages (id, name, description) VALUES 
('stage-001-junior', 'Junior', 'New employee'),
('stage-002-senior', 'Senior', 'Experienced employee'),
('stage-003-manager', 'Manager', 'Management level')
ON CONFLICT (id) DO NOTHING;
```

## Migration Rules

1. **Never edit existing migration files** - Always create new ones
2. **Use incremental numbering** - 001, 002, 003, etc.
3. **Write pure SQL** - No abstractions, no confusion
4. **Test locally first** - Always test before production
5. **For table updates** - Create new migration file with descriptive name
6. **One change per migration** - Easier to debug and rollback

## Production Deployment Safety

### ⚠️ CRITICAL: Never Run Migrations Directly in Production

**Production workflow:**
1. **Test migrations locally** with production-like data
2. **Create database backup** before deployment
3. **Deploy via CI/CD** or controlled deployment process
4. **Run migrations through application startup** or deployment scripts
5. **Monitor and verify** changes before allowing traffic

### Recommended Production Setup

#### Option 1: Application Startup Migration
```python
# In main.py or startup script
async def startup():
    # Run pending migrations automatically on app start
    await run_migrations()
    
app.add_event_handler("startup", startup)
```

#### Option 2: Deployment Pipeline Migration
```bash
# In CI/CD pipeline or deployment script
cd app/database/scripts
python run_migrations.py
# Then deploy application
```

#### Option 3: Manual but Controlled
```bash
# Only by authorized personnel, with backup
# 1. Create backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Run migrations
python run_migrations.py

# 3. Verify and test
python test_connection_user.py
```

### Production Safety Checklist

- [ ] ✅ **Backup created** before migration
- [ ] ✅ **Tested locally** with similar data size  
- [ ] ✅ **Migration is reversible** (can undo if needed)
- [ ] ✅ **Non-breaking change** (won't break running app)
- [ ] ✅ **Monitoring in place** to detect issues
- [ ] ✅ **Rollback plan ready** if something goes wrong

### Safe vs Risky Migrations

#### ✅ Generally Safe
- Adding new tables
- Adding new columns with defaults
- Adding indexes (with care about lock time)
- Inserting reference data

#### ⚠️ Potentially Risky  
- Dropping columns (break existing code)
- Renaming columns (break existing code)
- Changing column types (data loss risk)
- Adding NOT NULL constraints to existing columns

#### 🚨 Very Risky
- Dropping tables
- Large data migrations on big tables
- Complex schema changes during peak hours

## Check Status
```bash
# See which migrations are applied
psql $SUPABASE_DATABASE_URL -c "SELECT * FROM schema_migrations ORDER BY filename;"

# Test connection
python test_connection_user.py
```

That's it. Simple, predictable, no tools needed.