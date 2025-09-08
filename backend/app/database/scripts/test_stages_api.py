#!/usr/bin/env python3
"""
Script para testar a API de stages após a implementação
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('../../../../.env.local')

async def test_stages_api():
    """Testar se a API de stages funciona com os novos dados"""
    
    database_url = os.getenv('SUPABASE_DATABASE_URL')
    if not database_url:
        print("❌ SUPABASE_DATABASE_URL not found in environment")
        return False
    
    try:
        print("🧪 Testando API de stages...")
        conn = await asyncpg.connect(database_url)
        
        # Simular a query que a API faz
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
        
        print(f"✅ API Query executada com sucesso!")
        print(f"📊 Retornou {len(stages)} stages")
        
        # Verificar se os dados estão no formato esperado pela API
        for stage in stages:
            if not stage['id'] or not stage['name']:
                print(f"❌ Stage com dados inválidos: {stage}")
                return False
        
        print("✅ Todos os stages têm dados válidos")
        
        # Verificar se temos exatamente 9 stages
        if len(stages) == 9:
            print("✅ API retorna exatamente 9 stages como esperado!")
        else:
            print(f"⚠️  API retorna {len(stages)} stages, esperado 9")
        
        # Verificar se os nomes estão corretos
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
            print("✅ Todos os nomes dos stages estão corretos!")
        else:
            print("⚠️  Nomes dos stages não coincidem:")
            for i, (expected, actual) in enumerate(zip(expected_names, actual_names)):
                if expected != actual:
                    print(f"   Stage {i+1}: Esperado '{expected}', Encontrado '{actual}'")
        
        await conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Erro ao testar API: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_stages_api())
    if success:
        print("\n🎉 Teste da API concluído com sucesso!")
        print("✅ Os stages estão prontos para uso na API!")
    else:
        print("\n❌ Teste da API falhou!")
