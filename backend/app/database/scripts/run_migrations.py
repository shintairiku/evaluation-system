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
load_dotenv('../../../../.env.local')

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
    
    database_url = os.getenv('SUPABASE_DATABASE_URL')
    if not database_url:
        print("❌ SUPABASE_DATABASE_URL not found in environment")
        return False
    
    try:
        print("🚀 Running migrations...")
        conn = await asyncpg.connect(database_url)
        
        # Ensure migration tracking table exists
        await ensure_migration_table(conn)
        
        # Get already applied migrations
        applied_migrations = await get_applied_migrations(conn)
        
        # Find all migration files
        migration_dir = Path("../migrations/User")
        if not migration_dir.exists():
            print(f"❌ Migration directory not found: {migration_dir}")
            return False
        
        # Get all .sql files and sort them
        migration_files = sorted([
            f for f in migration_dir.glob("*.sql") 
            if f.is_file()
        ])
        
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