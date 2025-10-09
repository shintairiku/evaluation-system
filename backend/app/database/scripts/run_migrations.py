#!/usr/bin/env python3
"""
Simple migration runner - no tools, just SQL files
Tracks applied migrations to avoid duplicates
"""
import asyncio
import asyncpg
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def ensure_migration_table(conn):
    """Create migrations table if it doesn't exist"""
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            filename VARCHAR(255) PRIMARY KEY,
            applied_at TIMESTAMP DEFAULT NOW()
        )
    """)

async def get_applied_migrations(conn):
    """Get list of already applied migrations"""
    rows = await conn.fetch("SELECT filename FROM schema_migrations ORDER BY filename")
    return {row['filename'] for row in rows}

async def mark_migration_applied(conn, filename):
    """Mark migration as applied"""
    await conn.execute(
        "INSERT INTO schema_migrations (filename) VALUES ($1)",
        filename
    )

async def run_migrations():
    """Run all pending migrations"""
    
    database_url = os.getenv('DATABASE_URL') or os.getenv('SUPABASE_DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL or SUPABASE_DATABASE_URL not found in environment")
        return False
    
    try:
        print("🚀 Running migrations...")
        conn = await asyncpg.connect(database_url)
        
        # Ensure migration tracking table exists
        await ensure_migration_table(conn)
        
        # Get already applied migrations
        applied_migrations = await get_applied_migrations(conn)
        
        # Find migration files from production and seed directories
        # Get script directory and construct absolute paths
        script_dir = Path(__file__).parent
        migration_dirs = [
            script_dir.parent / "migrations" / "production",
            script_dir.parent / "migrations" / "seeds",
        ]

        migration_files = []
        for migration_dir in migration_dirs:
            if migration_dir.exists():
                migration_files.extend([
                    f for f in migration_dir.glob("*.sql")
                    if f.is_file()
                ])
                print(f"📁 Scanned {migration_dir}")
            else:
                print(f"⚠️ Migration directory not found: {migration_dir}")

        if not migration_files:
            print("❌ No migration files found in any directory")
            return False

        # Sort all migration files
        migration_files = sorted(migration_files)
        
        if not migration_files:
            print("❌ No migration files found")
            return False
        
        # Filter out already applied migrations
        pending_migrations = [
            f for f in migration_files 
            if f.name not in applied_migrations
        ]
        
        if not pending_migrations:
            print("✅ All migrations already applied")
            return True
        
        print(f"📁 Found {len(pending_migrations)} pending migrations:")
        for migration_file in pending_migrations:
            print(f"  - {migration_file.name}")
        print()
        
        # Apply pending migrations
        for i, migration_file in enumerate(pending_migrations, 1):
            filename = migration_file.name
            print(f"📝 Running migration {i}/{len(pending_migrations)}: {filename}")
            
            # Read migration file
            with open(migration_file, 'r') as f:
                sql_content = f.read()
            
            # Execute migration in transaction
            async with conn.transaction():
                try:
                    await conn.execute(sql_content)
                    await mark_migration_applied(conn, filename)
                    print(f"✅ Migration {i} completed: {filename}")
                except Exception as e:
                    print(f"❌ Migration {i} failed: {filename}")
                    print(f"   Error: {e}")
                    raise  # Rollback transaction
        
        # Show final status
        tables = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            AND table_name != 'test_table'
            AND table_name != 'schema_migrations'
            ORDER BY table_name
        """)
        
        print(f"\n📋 Migration completed! Database has {len(tables)} tables:")
        for table in tables:
            print(f"  - {table['table_name']}")
        
        await conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error running migrations: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(run_migrations())
    exit(0 if success else 1)