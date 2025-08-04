# Suggested Development Commands

## Docker Environment (Primary)
```bash
# Start all services (recommended for development)
docker-compose up --build -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f [service_name]

# Rebuild specific service
docker-compose up --build [service_name]
```

## Frontend Development (Next.js)
```bash
cd frontend

# Install dependencies
npm install

# Development server (with Turbopack)
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Linting
npm run lint
```

## Backend Development (FastAPI)
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn app.main:app --reload

# Alternative with specific host/port
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Testing Commands
```bash
# Frontend tests (if available)
cd frontend
npm test

# Backend tests
cd backend
pytest

# Run specific test file
pytest tests/test_specific.py

# Run with coverage
pytest --cov=app
```

## Code Quality and Linting
```bash
# Frontend linting
cd frontend
npm run lint

# Backend linting and formatting
cd backend
ruff check .        # Linting
ruff format .       # Formatting

# Type checking
mypy .
```

## System Utilities (macOS/Darwin)
```bash
# File operations
ls -la              # List files with details
find . -name "*.py" # Find Python files
grep -r "pattern"   # Search in files

# Git operations
git status
git add .
git commit -m "message"
git push

# Process management
ps aux | grep python
kill -9 <pid>
```

## Database Operations (via Supabase)
```bash
# Access Supabase dashboard
# Navigate to project URL in browser

# Local development database
# Configure in .env files
```

## Environment Setup
```bash
# Copy environment templates
cp .env.example .env.local        # Frontend
cp .env.example .env             # Backend

# Install global tools (if needed)
npm install -g @next/cli
pip install ruff mypy
```