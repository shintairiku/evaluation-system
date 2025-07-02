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
  - `/src/api` - API integration layer
    - `/client` - HTTP client with Clerk auth
    - `/constants` - API endpoints & configuration
    - `/endpoints` - 1:1 API endpoint functions
    - `/server-actions` - Next.js server actions for SSR
    - `/types` - TypeScript interfaces matching backend schemas
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

### Backend Logic Flow
- Endpoints in /app/api must only call services.
- Services in /app/services contain business logic and orchestrate calls to one or more repositories to fulfill a use case. For example, UserService would call both UserRepository and DepartmentRepository to build a detailed user response.
- Repositories in /app/database are responsible only for database queries.

### Frontend API Integration
- **Server-Side First**: Prioritize server-side data fetching using server actions for SSR/SEO benefits
- **1:1 Endpoint Mapping**: Each frontend API function corresponds directly to a backend endpoint
- **Type Safety**: All API interactions use TypeScript interfaces matching backend Pydantic schemas
- **Centralized Configuration**: API base URLs and endpoints defined in `/src/api/constants/`
- **Consistent Error Handling**: Standardized `ApiResponse<T>` format across all API calls
- **Authentication**: Automatic Clerk token injection via HTTP client
- **Usage Patterns**:
  - Use server actions (`/src/api/server-actions/`) for server components and SSR
  - Use endpoint functions (`/src/api/endpoints/`) for client-side interactions when needed
  - All API types are defined in `/src/api/types/` and exported from index

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