#!/usr/bin/env python3
"""
Script to verify if competencies were created correctly
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('../../../../.env.local')

async def verify_competencies():
    """Verify if all 54 competencies were created correctly"""
    
    database_url = os.getenv('SUPABASE_DATABASE_URL')
    if not database_url:
        print("❌ SUPABASE_DATABASE_URL not found in environment")
        return False
    
    try:
        print("🔍 Verifying competencies in database...")
        conn = await asyncpg.connect(database_url)
        
        # Verify total competencies count
        total_competencies = await conn.fetchval("SELECT COUNT(*) FROM competencies")
        print(f"📊 Total competencies found: {total_competencies}")
        
        # Verify competencies per stage
        stage_competencies = await conn.fetch("""
            SELECT 
                s.name as stage_name,
                COUNT(c.id) as competency_count
            FROM stages s
            LEFT JOIN competencies c ON s.id = c.stage_id
            GROUP BY s.id, s.name
            ORDER BY s.name
        """)
        
        print("\n📋 Competencies per Stage:")
        print("-" * 60)
        for row in stage_competencies:
            print(f"Stage: {row['stage_name']} - {row['competency_count']} competencies")
        
        # Verify JSONB structure
        jsonb_check = await conn.fetch("""
            SELECT 
                s.name as stage_name,
                c.name as competency_name,
                jsonb_object_keys(c.description) as description_keys
            FROM stages s
            JOIN competencies c ON s.id = c.stage_id
            ORDER BY s.name, c.name
            LIMIT 5
        """)
        
        print("\n🔍 JSONB structure example (first 5):")
        print("-" * 60)
        for row in jsonb_check:
            print(f"Stage: {row['stage_name']}")
            print(f"Competency: {row['competency_name']}")
            print(f"Keys: {list(row['description_keys'])}")
            print()
        
        # Verify all competencies have 5 points
        invalid_competencies = await conn.fetch("""
            SELECT 
                s.name as stage_name,
                c.name as competency_name,
                jsonb_object_keys(c.description) as keys
            FROM stages s
            JOIN competencies c ON s.id = c.stage_id
            WHERE array_length(array(SELECT jsonb_object_keys(c.description)), 1) != 5
        """)
        
        if invalid_competencies:
            print("⚠️  Competencies with incorrect number of points:")
            for row in invalid_competencies:
                print(f"  - {row['stage_name']}: {row['competency_name']}")
        else:
            print("✅ All competencies have exactly 5 points")
        
        await conn.close()
        
        if total_competencies == 54:
            print(f"\n🎉 Success! All {total_competencies} competencies were created correctly!")
            return True
        else:
            print(f"\n❌ Error! Expected 54 competencies, found {total_competencies}")
            return False
            
    except Exception as e:
        print(f"❌ Error verifying competencies: {e}")
        return False

if __name__ == "__main__":
    asyncio.run(verify_competencies())
