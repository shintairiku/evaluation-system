# Codebase Structure

## Root Directory
```
/
├── frontend/          # Next.js application
├── backend/           # FastAPI application  
├── docs/              # Documentation
├── supabase/          # Database schema and migrations
├── tests/             # Cross-cutting tests
├── docker-compose.yml # Development environment
└── CLAUDE.md          # Project instructions
```

## Frontend Structure (/frontend)
```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication routes
│   │   ├── sign-in/
│   │   ├── sign-up/
│   │   └── setup/
│   └── (evaluation)/      # Main application routes
│       ├── (employee)/    # Employee-facing pages
│       ├── (supervisor)/  # Supervisor-facing pages  
│       ├── (admin)/       # Admin pages
│       ├── goal-input/
│       └── user-profiles/
├── components/             # Reusable UI components
│   ├── ui/                # shadcn/ui components
│   ├── auth/              # Auth-related components
│   ├── constants/         # Constants and routes
│   └── display/           # Display components
├── feature/               # Feature-specific components
│   ├── goal-input/
│   ├── setup/
│   ├── evaluation/
│   └── user-profiles/
├── api/                   # API integration layer
│   ├── client/            # HTTP client with Clerk auth
│   ├── constants/         # API endpoints & configuration
│   ├── endpoints/         # 1:1 API endpoint functions
│   ├── server-actions/    # Next.js server actions for SSR
│   ├── types/             # TypeScript interfaces matching backend
│   └── hooks/             # Custom API hooks
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and validation
│   └── validation/        # Zod schemas
└── utils/                 # Helper functions
```

## Backend Structure (/backend)
```
app/
├── main.py               # FastAPI application entry point
├── api/                  # API endpoints (controllers)
├── services/             # Business logic layer
├── database/             # Database models and repositories
├── schemas/              # Pydantic schemas for API
├── core/                 # Core configuration
├── security/             # Security and auth utilities
├── dependencies/         # FastAPI dependencies
└── utils/                # Helper utilities
```

## Architecture Patterns

### Backend Logic Flow
1. **API Endpoints** (`/app/api`) - Handle HTTP requests, minimal logic
2. **Services** (`/app/services`) - Business logic, orchestrate repository calls
3. **Repositories** (`/app/database`) - Database operations only

### Frontend API Integration
- **Server-Side First**: Prioritize server actions for SSR/SEO
- **1:1 Endpoint Mapping**: Each frontend function maps to backend endpoint
- **Type Safety**: TypeScript interfaces match backend Pydantic schemas
- **Centralized Configuration**: API URLs in `/src/api/constants/`