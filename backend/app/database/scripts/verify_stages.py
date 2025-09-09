#!/usr/bin/env python3
"""
Script to verify if stages were created correctly
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('../../../../.env.local')

async def verify_stages():
    """Verify if all 9 stages were created correctly"""
    
    database_url = os.getenv('SUPABASE_DATABASE_URL')
    if not database_url:
        print("❌ SUPABASE_DATABASE_URL not found in environment")
        return False
    
    try:
        print("🔍 Verifying stages in database...")
        conn = await asyncpg.connect(database_url)
        
        # Verify how many stages exist
        stage_count = await conn.fetchval("SELECT COUNT(*) FROM stages")
        print(f"📊 Total stages found: {stage_count}")
        
        # List all stages
        stages = await conn.fetch("""
            SELECT id, name, description, created_at, updated_at 
            FROM stages 
            ORDER BY name
        """)
        
        print(f"\n📋 Stages found:")
        print("-" * 80)
        for stage in stages:
            print(f"ID: {stage['id']}")
            print(f"Name: {stage['name']}")
            print(f"Description: {stage['description'][:100]}...")
            print(f"Created at: {stage['created_at']}")
            print(f"Updated at: {stage['updated_at']}")
            print("-" * 80)
        
        # Verify we have exactly 9 stages
        if stage_count == 9:
            print("✅ Success! All 9 stages were created correctly!")
            return True
        else:
            print(f"⚠️  Expected 9 stages, but found {stage_count}")
            return False
            
        await conn.close()
        
    except Exception as e:
        print(f"❌ Error verifying stages: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(verify_stages())
    if success:
        print("\n🎉 Verification completed successfully!")
    else:
        print("\n❌ Verification failed!")
