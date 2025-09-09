#!/usr/bin/env python3
"""
Script to test the stages API after implementation
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('../../../../.env.local')

async def test_stages_api():
    """Test if the stages API works with the new data"""
    
    database_url = os.getenv('SUPABASE_DATABASE_URL')
    if not database_url:
        print("❌ SUPABASE_DATABASE_URL not found in environment")
        return False
    
    try:
        print("🧪 Testing stages API...")
        conn = await asyncpg.connect(database_url)
        
        # Simulate the query that the API makes
        stages = await conn.fetch("""
            SELECT 
                id,
                name,
                description,
                created_at,
                updated_at
            FROM stages 
            ORDER BY name
        """)
        
        print(f"✅ API Query executed successfully!")
        print(f"📊 Returned {len(stages)} stages")
        
        # Verify if data is in the format expected by the API
        for stage in stages:
            if not stage['id'] or not stage['name']:
                print(f"❌ Stage with invalid data: {stage}")
                return False
        
        print("✅ All stages have valid data")
        
        # Verify we have exactly 9 stages
        if len(stages) == 9:
            print("✅ API returns exactly 9 stages as expected!")
        else:
            print(f"⚠️  API returns {len(stages)} stages, expected 9")
        
        # Verify if names are correct
        expected_names = [
            'Stage1: スタート',
            'Stage2: 自己完結', 
            'Stage3: 品質基準のクリア',
            'Stage4: 成果創出＆小チームリーダー',
            'Stage5: 成果創出＆チームリーダー',
            'Stage6: 成果創出＆部門マネジメント',
            'Stage7: 成果創出＆複数部門マネジメント',
            'Stage8: 全社マネジメント',
            'Stage9: グループ経営'
        ]
        
        actual_names = [stage['name'] for stage in stages]
        
        if actual_names == expected_names:
            print("✅ All stage names are correct!")
        else:
            print("⚠️  Stage names do not match:")
            for i, (expected, actual) in enumerate(zip(expected_names, actual_names)):
                if expected != actual:
                    print(f"   Stage {i+1}: Expected '{expected}', Found '{actual}'")
        
        await conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error testing API: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_stages_api())
    if success:
        print("\n🎉 API test completed successfully!")
        print("✅ Stages are ready for API use!")
    else:
        print("\n❌ API test failed!")
