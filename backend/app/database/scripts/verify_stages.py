#!/usr/bin/env python3
"""
Script para verificar se os stages foram criados corretamente
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('../../../../.env.local')

async def verify_stages():
    """Verificar se os 9 stages foram criados corretamente"""
    
    database_url = os.getenv('SUPABASE_DATABASE_URL')
    if not database_url:
        print("❌ SUPABASE_DATABASE_URL not found in environment")
        return False
    
    try:
        print("🔍 Verificando stages no banco de dados...")
        conn = await asyncpg.connect(database_url)
        
        # Verificar quantos stages existem
        stage_count = await conn.fetchval("SELECT COUNT(*) FROM stages")
        print(f"📊 Total de stages encontrados: {stage_count}")
        
        # Listar todos os stages
        stages = await conn.fetch("""
            SELECT id, name, description, created_at, updated_at 
            FROM stages 
            ORDER BY name
        """)
        
        print(f"\n📋 Stages encontrados:")
        print("-" * 80)
        for stage in stages:
            print(f"ID: {stage['id']}")
            print(f"Nome: {stage['name']}")
            print(f"Descrição: {stage['description'][:100]}...")
            print(f"Criado em: {stage['created_at']}")
            print(f"Atualizado em: {stage['updated_at']}")
            print("-" * 80)
        
        # Verificar se temos exatamente 9 stages
        if stage_count == 9:
            print("✅ Sucesso! Todos os 9 stages foram criados corretamente!")
            return True
        else:
            print(f"⚠️  Esperado 9 stages, mas encontrado {stage_count}")
            return False
            
        await conn.close()
        
    except Exception as e:
        print(f"❌ Erro ao verificar stages: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(verify_stages())
    if success:
        print("\n🎉 Verificação concluída com sucesso!")
    else:
        print("\n❌ Verificação falhou!")
