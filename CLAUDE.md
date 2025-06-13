# Claude Code Configuration

## Project Overview
This is an HR Evaluation System (人事評価システム) built with:
- Frontend: Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui
- Backend: FastAPI, Python 3.12
- Database: Supabase(PostgreSQL)
- Authentication: Clerk
- Containerization: Docker

## Development Commands
```bash
# Start services
docker-compose up --build -d

# Stop services
docker-compose down

# Frontend development (if running locally)
cd frontend
npm install
npm run dev

# Backend development (if running locally)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Project Structure
- `/frontend` - Next.js application
  - `/src/app` - App Router pages
  - `/src/components` - Reusable components
  - `/src/feature` - Feature-specific components
- `/backend` - FastAPI application
  - `/app/api` - API endpoints
  - `/app/database` - Database models and repositories
  - `/app/services` - Business logic
- `/docs` - Documentation files

## Key Conventions
- Use TypeScript for frontend code
- Follow Python PEP 8 style for backend code
- Components use shadcn/ui library
- API endpoints follow RESTful conventions

## Testing Commands
```bash
# Frontend tests
cd frontend
npm test

# Backend tests
cd backend
pytest
```

## Linting and Type Checking
```bash
# Frontend
cd frontend
npm run lint
npm run type-check

# Backend
cd backend
ruff check .
mypy .
```