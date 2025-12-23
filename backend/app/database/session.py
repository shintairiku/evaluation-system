import os
from typing import AsyncGenerator
from fastapi import Request
from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv

# Load environment variables from .env file
# Get the path to the project root (3 levels up from this file)
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
env_path = os.path.join(project_root, '.env')
load_dotenv(env_path)

DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DATABASE_URL")
DATABASE_URL_SESSION = os.getenv("DATABASE_URL_SESSION") or os.getenv("SUPABASE_DATABASE_URL_SESSION")
ENVIRONMENT = os.getenv("ENVIRONMENT", "production")
pool_mode = (os.getenv("DB_POOL_MODE") or "").lower()

# Select DB URL based on pool mode
if pool_mode == "session" and DATABASE_URL_SESSION:
    DATABASE_URL = DATABASE_URL_SESSION
elif pool_mode == "transaction":
    DATABASE_URL = DATABASE_URL

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
is_production = ENVIRONMENT.lower() == "production"
force_queue_pool = pool_mode in {"session", "queue", "queuepool", "session_pooler"}
is_transaction_pooler = ":6543/" in DATABASE_URL if DATABASE_URL else False

# For pgbouncer transaction pooling: disable prepared statements via URL parameter
# This is the most reliable method to prevent prepared statement errors
if (is_production or is_transaction_pooler) and DATABASE_URL:
    if "?" in DATABASE_URL:
        DATABASE_URL += "&prepared_statement_cache_size=0"
    else:
        DATABASE_URL += "?prepared_statement_cache_size=0"

if force_queue_pool:
    # Explicit override to use QueuePool (e.g., when switching to session pooler in production)
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
elif is_production or is_transaction_pooler:
    # Cloud Run or transaction pooler: Use NullPool (required for pgbouncer transaction mode)
    pool_config = {
        "poolclass": NullPool,
    }
    connect_args = {
        "server_settings": {
            "jit": "off",
        },
        # CRITICAL FIX: Use UUID-based prepared statement names to prevent collisions
        # This is the recommended solution from SQLAlchemy docs for pgbouncer transaction mode
        # Each statement gets a unique name, avoiding DuplicatePreparedStatementError
        "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
        # Also disable statement caching as additional safety
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
        # Add timeouts for robustness
        "timeout": 10,
        "command_timeout": 60,
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

async def get_db_session(request: Request = None) -> AsyncGenerator[AsyncSession, None]:
    existing_session = None
    if request is not None:
        existing_session = getattr(request.state, "db_session", None)
    if existing_session is not None:
        yield existing_session
        return

    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
