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
ENVIRONMENT = os.getenv("ENVIRONMENT", "production")

# Convert PostgreSQL URL to async version for SQLAlchemy
# Handle both postgres:// and postgresql:// URL formats
if DATABASE_URL:
    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
    elif DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://")

# Environment-aware connection pooling configuration
# - Production (Cloud Run): Use NullPool + transaction pooler (port 6543)
# - Development (Local): Use QueuePool + session pooler (port 5432) for better performance
is_transaction_pooler = ":6543/" in DATABASE_URL if DATABASE_URL else False
is_production = ENVIRONMENT.lower() == "production"

if is_production or is_transaction_pooler:
    # Cloud Run or transaction pooler: Use NullPool (required for pgbouncer transaction mode)
    pool_config = {
        "poolclass": NullPool,
    }
    connect_args = {
        "server_settings": {
            "jit": "off",
        },
        # Disable prepared statement caching for pgbouncer transaction pooling compatibility
        # pgbouncer transaction mode rotates backend connections, which breaks prepared statements
        "statement_cache_size": 0,
    }
else:
    # Local development: Use QueuePool for connection reuse and better performance
    pool_config = {
        "pool_size": 5,          # Keep 5 connections open
        "max_overflow": 10,       # Allow up to 15 total connections
        "pool_pre_ping": True,    # Verify connections before using
        "pool_recycle": 3600,     # Recycle connections after 1 hour
    }
    connect_args = {
        "server_settings": {
            "jit": "off",
        },
    }

engine = create_async_engine(
    DATABASE_URL,
    echo=False,  # Disable SQLAlchemy query logging to reduce log verbosity
    connect_args=connect_args,
    **pool_config
)
AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
