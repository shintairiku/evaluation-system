import asyncpg
import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv('../../../.env.local')

class DatabaseSession:
    """Database session manager for asyncpg"""
    
    def __init__(self):
        self.database_url = os.getenv('SUPABASE_DATABASE_URL')
        if not self.database_url:
            raise ValueError("SUPABASE_DATABASE_URL environment variable is required")
    
    async def get_connection(self) -> asyncpg.Connection:
        """Get database connection"""
        return await asyncpg.connect(self.database_url)
    
    async def get_pool(self) -> asyncpg.Pool:
        """Get database connection pool"""
        return await asyncpg.create_pool(self.database_url)
    
    async def execute(self, query: str, *args):
        """Execute a query with parameters"""
        conn = await self.get_connection()
        try:
            return await conn.execute(query, *args)
        finally:
            await conn.close()
    
    async def fetch(self, query: str, *args):
        """Fetch rows from a query"""
        conn = await self.get_connection()
        try:
            return await conn.fetch(query, *args)
        finally:
            await conn.close()
    
    async def fetchrow(self, query: str, *args):
        """Fetch a single row from a query"""
        conn = await self.get_connection()
        try:
            return await conn.fetchrow(query, *args)
        finally:
            await conn.close()
    
    async def fetchval(self, query: str, *args):
        """Fetch a single value from a query"""
        conn = await self.get_connection()
        try:
            return await conn.fetchval(query, *args)
        finally:
            await conn.close()

# Global database session instance
db_session = DatabaseSession() 