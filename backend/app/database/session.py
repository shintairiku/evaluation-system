import os
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv

# Load environment variables from .env file
# Get the path to the project root (3 levels up from this file)
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
env_path = os.path.join(project_root, '.env')
load_dotenv(env_path)

DATABASE_URL = os.getenv("SUPABASE_DATABASE_URL")

# Convert PostgreSQL URL to async version for SQLAlchemy
# Handle both postgres:// and postgresql:// URL formats
if DATABASE_URL:
    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
    elif DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://")

engine = create_async_engine(
    DATABASE_URL,
    echo=False,  # Disable SQLAlchemy query logging to reduce log verbosity
    poolclass=NullPool,  # Disable SQLAlchemy pooling when using pgbouncer transaction mode
    connect_args={
        "server_settings": {
            "jit": "off",
        },
        # Disable prepared statement caching for pgbouncer transaction pooling compatibility
        # pgbouncer transaction mode rotates backend connections, which breaks prepared statements
        "statement_cache_size": 0,
    }
)
AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
