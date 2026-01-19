#!/usr/bin/env python3
"""
Test basic database connection for migration-based workflow
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv
import pytest

# Load environment variables  
load_dotenv('.env.local')
DATABASE_URL = os.getenv('SUPABASE_DATABASE_URL')
pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.skipif(
        not DATABASE_URL,
        reason="SUPABASE_DATABASE_URL is not configured",
    ),
]

async def test_database_connection():
    """Test basic database connection and verify migrated tables"""
    
    database_url = DATABASE_URL
    if not database_url:
        print("❌ SUPABASE_DATABASE_URL not found in environment")
        return False
    
    try:
        print("🔗 Testing database connection...")
        conn = await asyncpg.connect(database_url)
        print("✅ Connected successfully!")
        
        # Test simple query
        result = await conn.fetchval("SELECT 1")
        print(f"✅ Test query result: {result}")
        
        # Check migrated tables
        tables = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            AND table_name IN ('departments', 'stages', 'roles', 'users', 'user_roles', 'users_supervisors')
            ORDER BY table_name
        """)
        
        expected_tables = {'departments', 'roles', 'stages', 'user_roles', 'users', 'users_supervisors'}
        found_tables = {table['table_name'] for table in tables}
        
        if expected_tables == found_tables:
            print(f"✅ All migrated tables found: {', '.join(sorted(found_tables))}")
        else:
            missing = expected_tables - found_tables
            extra = found_tables - expected_tables
            if missing:
                print(f"❌ Missing tables: {', '.join(missing)}")
            if extra:
                print(f"⚠️  Extra tables: {', '.join(extra)}")
            if missing:
                return False
        
        await conn.close()
        print("✅ Database connection test passed!")
        return True
        
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_database_connection())
    exit(0 if success else 1)
