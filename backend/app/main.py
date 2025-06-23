from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.v1 import api_router

app = FastAPI(
    title="HR Evaluation System API",
    description="API for managing employee evaluations with Clerk authentication",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(api_router)

@app.get("/")
def read_root():
    return {"message": "HR Evaluation System API with Clerk Authentication"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

