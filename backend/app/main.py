from fastapi import FastAPI
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup - can optionally run migrations here for production
    # from app.database.scripts.run_migrations import run_migrations
    # await run_migrations()  # Uncomment for automatic migrations
    yield
    # Shutdown

app = FastAPI(lifespan=lifespan)

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"} 