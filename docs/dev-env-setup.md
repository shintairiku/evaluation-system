# Development Environment Setup Guide

This guide explains how to set up the complete development environment for the HR Evaluation System, including local development, Cloud Run development instance, and production deployment.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Development Workflow                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Local Development (Docker Compose)                                  │
│  ├─ Frontend: http://localhost:3000                                  │
│  ├─ Backend: http://localhost:8000                                   │
│  ├─ Environment: ENVIRONMENT=development                             │
│  └─ Organization: "test-company" (Clerk test mode)                   │
│                                                                       │
│  ↓ Push to develop branch                                            │
│                                                                       │
│  Development Cloud Deployment                                        │
│  ├─ Frontend: Vercel Preview (https://*-git-develop-*.vercel.app)   │
│  ├─ Backend: Cloud Run Dev (hr-evaluation-backend-dev)              │
│  ├─ Environment: ENVIRONMENT=production                              │
│  └─ Organization: "test-company" (Clerk test mode)                   │
│                                                                       │
│  ↓ Merge to main branch                                              │
│                                                                       │
│  Production Cloud Deployment                                         │
│  ├─ Frontend: Vercel Production (https://evaluation-system.vercel.app)│
│  ├─ Backend: Cloud Run Prod (hr-evaluation-backend)                 │
│  ├─ Environment: ENVIRONMENT=production                              │
│  └─ Organizations: Real companies (Clerk live mode)                  │
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │         Single Production Database (Supabase)                 │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │  Organization: "test-company" (for dev/testing)         │  │  │
│  │  │  ├─ Used by: Local dev + Cloud Run dev                  │  │  │
│  │  │  └─ Clerk: Test mode keys                               │  │  │
│  │  ├─────────────────────────────────────────────────────────┤  │  │
│  │  │  Organization: "real-company-1"                         │  │  │
│  │  │  ├─ Used by: Production only                            │  │  │
│  │  │  └─ Clerk: Live mode keys                               │  │  │
│  │  ├─────────────────────────────────────────────────────────┤  │  │
│  │  │  Organization: "real-company-2"                         │  │  │
│  │  │  └─ ...more real companies                              │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │                                                                 │  │
│  │  ✅ Organization isolation enforced by backend auth logic      │  │
│  │  ✅ Test multi-tenancy security in same database as prod       │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Environment Matrix

| Environment | Frontend | Backend | ENVIRONMENT | Clerk Keys | Organization | Database |
|-------------|----------|---------|-------------|------------|--------------|----------|
| **Local** | localhost:3000 | localhost:8000 | `development` | Test mode | test-company | **Production Supabase** |
| **Cloud Dev** | Vercel Preview | Cloud Run Dev | `production` | Test mode | test-company | **Production Supabase** |
| **Cloud Prod** | Vercel Production | Cloud Run Prod | `production` | Live mode | Real companies | **Production Supabase** |

> **Important:**
> - Both Cloud Run instances use `ENVIRONMENT=production`. The `development` environment is ONLY for local Docker Compose.
> - **All environments use the SAME production Supabase database** with different organizations for isolation.
> - The "test-company" organization is used for development and testing, ensuring multi-tenant security works correctly.

## Why Use a Single Production Database?

### ✅ Advantages of Shared Database with Test Organization

1. **Real Multi-tenancy Testing**
   - Validates that "test-company" cannot see other organizations' data
   - Tests actual production security model
   - Catches organization isolation bugs before real companies are affected

2. **No Schema Drift**
   - Same database schema everywhere
   - No need to sync migrations across databases
   - What works in dev will work in production

3. **Simpler Setup**
   - Only ONE Supabase instance to maintain
   - Fewer secrets to manage (no separate database-url-dev)
   - Lower costs (no separate dev database)

4. **Better Test Coverage**
   - Tests REAL multi-tenant scenarios
   - Verifies organization-scoped queries work correctly
   - Same data access patterns as production

### Security Validation Example

```sql
-- Verify organization isolation directly in production database:
-- When logged in as test-company user:
SELECT * FROM users WHERE organization_id = 'test-company-id';
-- ✅ Returns test-company users

SELECT * FROM users WHERE organization_id = 'real-company-id';
-- ❌ Should be blocked by backend auth context
-- This proves your security model works!
```

## Phase 1: GCP Secrets Setup

### Prerequisites
- Google Cloud SDK installed and authenticated
- **GCP project already set up from [deployment.md](./deployment.md)** Phase 2, Step 2.1
- GCP project with billing enabled
- Secret Manager API enabled (already done in deployment.md)

### Create Development Secrets

> **Note:** Use the same PROJECT_ID and REGION from [deployment.md](./deployment.md) Phase 2, Step 2.1

Run these commands to create development-specific secrets:

```bash
# Set your GCP project (use values from deployment.md)
export PROJECT_ID="hr-evaluation-app-474400"  # Same as production
export REGION="asia-northeast1"  # Same as production (line 167 & 259 in deployment.md)

# 1. Clerk Secret Key (from Clerk Dashboard - Test mode)
echo -n "sk_test_your_clerk_secret_key" | \
  gcloud secrets create clerk-secret-key-dev \
  --data-file=- \
  --replication-policy="automatic" \
  --project=$PROJECT_ID

# 2. Clerk Issuer (from Clerk Dashboard - Test mode)
echo -n "https://your-app.clerk.accounts.dev" | \
  gcloud secrets create clerk-issuer-dev \
  --data-file=- \
  --replication-policy="automatic" \
  --project=$PROJECT_ID

# 3. Clerk Audience (your app domain)
echo -n "localhost:3000" | \
  gcloud secrets create clerk-audience-dev \
  --data-file=- \
  --replication-policy="automatic" \
  --project=$PROJECT_ID

# 4. Clerk Webhook Secret (for dev environment - Test mode)
echo -n "whsec_your_dev_webhook_secret" | \
  gcloud secrets create clerk-webhook-secret-dev \
  --data-file=- \
  --replication-policy="automatic" \
  --project=$PROJECT_ID

# 5. Application Secret Key (generate random key for dev)
python3 -c "import secrets; print(secrets.token_urlsafe(32))" | \
  gcloud secrets create app-secret-key-dev \
  --data-file=- \
  --replication-policy="automatic" \
  --project=$PROJECT_ID
```

> **Note:** We do NOT create `database-url-dev` - development uses the same production database URL!

### Grant Cloud Run Access to Secrets

```bash
# Get the Cloud Run service account email
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
export SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Grant access to development secrets
for SECRET in clerk-secret-key-dev clerk-issuer-dev \
              clerk-audience-dev clerk-webhook-secret-dev app-secret-key-dev; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$PROJECT_ID
done

# Also grant access to PRODUCTION database-url (shared with dev)
gcloud secrets add-iam-policy-binding database-url \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor" \
  --project=$PROJECT_ID
```

### Update GitHub Actions to Use Production Database URL

The GitHub Actions workflow needs a small update:

```yaml
# In .github/workflows/deploy-backend.yml
# For development deployment, use production database-url (no -dev suffix)
secrets: |
  CLERK_SECRET_KEY=clerk-secret-key${{ steps.env-vars.outputs.SECRET_SUFFIX }}:latest
  SUPABASE_DATABASE_URL=database-url:latest  # ← Always use production database
  CLERK_ISSUER=clerk-issuer${{ steps.env-vars.outputs.SECRET_SUFFIX }}:latest
  CLERK_AUDIENCE=clerk-audience${{ steps.env-vars.outputs.SECRET_SUFFIX }}:latest
  CLERK_WEBHOOK_SECRET=clerk-webhook-secret${{ steps.env-vars.outputs.SECRET_SUFFIX }}:latest
  SECRET_KEY=app-secret-key${{ steps.env-vars.outputs.SECRET_SUFFIX }}:latest
```

### Verify Secrets Creation

```bash
# List all secrets
gcloud secrets list --project=$PROJECT_ID

# Expected output should include:
# clerk-secret-key          (production Clerk live mode)
# clerk-secret-key-dev      (development Clerk test mode)
# database-url              (production Supabase - SHARED)
# clerk-issuer
# clerk-issuer-dev
# clerk-audience
# clerk-audience-dev
# clerk-webhook-secret
# clerk-webhook-secret-dev
# app-secret-key
# app-secret-key-dev

# Note: NO database-url-dev (we use production database for all environments)
```

## Phase 2: Clerk Setup - Create Test Organization

### Create Test Mode Application in Clerk

1. Go to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Create a **separate test mode application** (or use existing test app)
3. Enable **Organizations** feature
4. Create organization named `test-company` in test mode

### Create Production Application

1. Create a **separate live mode application** for production
2. Enable **Organizations** feature
3. Real companies will create their organizations here

### Why Separate Clerk Applications?

- **Test mode app**: Used by local dev + Cloud Run dev
  - Organizations: `test-company` only
  - Free tier friendly
  - No risk to production data

- **Live mode app**: Used by Cloud Run production
  - Organizations: Real companies
  - Production billing
  - Production security

## Phase 3: Vercel Environment Variables

### Access Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select your project: `evaluation-system`
3. Navigate to **Settings** → **Environment Variables**

### Configure Production Environment

Add these variables for **Production** environment (main branch):

> **Note:** Get Supabase and Clerk values from [deployment.md](./deployment.md) Phase 1

| Variable Name | Value | Environment |
|---------------|-------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://hr-evaluation-backend-xxx.run.app` (from deployment.md Phase 2) | Production |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_xxx` (from deployment.md Step 1.2) | Production |
| `CLERK_SECRET_KEY` | `sk_live_xxx` (from deployment.md Step 1.2) | Production |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` (from deployment.md Step 1.1) | Production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJxxx` (from deployment.md Step 1.1) | Production |

### Configure Preview Environment

Add these variables for **Preview** environment (develop + all other branches):

| Variable Name | Value | Environment |
|---------------|-------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://hr-evaluation-backend-dev-xxx.run.app` | Preview |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_xxx` (Clerk **Test** mode) | Preview |
| `CLERK_SECRET_KEY` | `sk_test_xxx` (Clerk **Test** mode) | Preview |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` (**SAME** as production) | Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJxxx` (**SAME** as production) | Preview |

> **Key Point:** Supabase credentials are identical - only Clerk changes between environments!

### Get Cloud Run URLs

After deploying to Cloud Run, get the URLs:

```bash
# Production backend URL (from deployment.md Phase 2, Step 2.3)
gcloud run services describe hr-evaluation-backend \
  --region=$REGION \
  --format='value(status.url)'

# Development backend URL (will be available after Phase 5 first deploy)
gcloud run services describe hr-evaluation-backend-dev \
  --region=$REGION \
  --format='value(status.url)'
```

## Phase 4: Update Backend CORS Configuration

### Production Backend CORS

```bash
# Update production backend to allow production Vercel domain
gcloud run services update hr-evaluation-backend \
  --region=$REGION \
  --update-env-vars="CORS_ORIGINS=https://evaluation-system.vercel.app,https://evaluation-system-git-main-xxx.vercel.app" \
  --project=$PROJECT_ID
```

### Development Backend CORS

```bash
# Update development backend to allow all Vercel preview URLs
gcloud run services update hr-evaluation-backend-dev \
  --region=$REGION \
  --update-env-vars="CORS_ORIGINS=https://*.vercel.app,http://localhost:3000" \
  --project=$PROJECT_ID
```

> **Note:** Wildcard `*.vercel.app` allows all Vercel preview deployments to access the dev backend.

## Phase 5: First Deployment

### Trigger Development Deployment

1. Make a change to the backend code
2. Commit and push to `develop` branch:
   ```bash
   git checkout develop
   git add .
   git commit -m "test: trigger dev deployment"
   git push origin develop
   ```

3. Monitor deployment:
   - GitHub Actions: https://github.com/your-org/evaluation-system/actions
   - Expected workflow: Build → Push to GCR → Deploy to Cloud Run Dev

### Verify Deployment

```bash
# Check development backend health
DEV_URL=$(gcloud run services describe hr-evaluation-backend-dev --region=$REGION --format='value(status.url)')
curl -s $DEV_URL/health

# Expected response:
# {"status":"healthy","environment":"production","timestamp":"..."}
```

### Verify Vercel Preview

1. Push to `develop` branch also triggers Vercel preview deployment
2. Check Vercel dashboard for preview URL
3. Visit preview URL and verify it connects to dev backend

## Local Development Setup

### 1. Copy Environment File

```bash
cp .env.local.example .env.local
```

### 2. Update .env.local

```env
# Use test/development credentials (Clerk TEST mode)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_xxx"
CLERK_SECRET_KEY="sk_test_xxx"
CLERK_ISSUER="https://your-test-app.clerk.accounts.dev"
CLERK_AUDIENCE="localhost:3000"
CLERK_WEBHOOK_SECRET="whsec_xxx"
CLERK_ORGANIZATION_ENABLED=true

# Production Supabase (SAME as production!)
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJxxx"
SUPABASE_DATABASE_URL="postgresql://user:pass@db.supabase.co:5432/postgres"

# Local configuration
DEBUG=True
ENVIRONMENT=development
LOG_LEVEL=INFO
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### 3. Start Docker Compose

```bash
# Build and start all services
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### 4. Verify Local Setup

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Backend Health: http://localhost:8000/health
- API Docs: http://localhost:8000/docs

### 5. Create Test Data in "test-company"

1. Sign up using Clerk test mode (in your local app)
2. Create organization: `test-company`
3. Add test users, departments, roles, etc.
4. Test all features with this test organization

## Testing Multi-Tenant Security

### Verify Organization Isolation

Since you're using the production database, you can verify security directly:

```bash
# 1. Log in as a user in "test-company" via Cloud Run dev
# 2. Try to access data - should only see test-company data

# 3. Check database directly (via Supabase Dashboard or SQL)
SELECT organization_id, COUNT(*) as user_count
FROM users
GROUP BY organization_id;

# Should show:
# test-company-org-id | 5
# real-company-1-id   | 20
# real-company-2-id   | 15

# 4. Verify backend correctly filters by organization
# Your backend auth should ensure test-company users only see their data
```

### Test Scenarios

1. **Isolation Test**:
   - Log in as test-company user
   - Attempt to access other organization's data
   - Should be blocked by backend auth logic

2. **Schema Compatibility Test**:
   - Add new feature in dev (with migration)
   - Test in test-company organization
   - Verify real companies' data unaffected

3. **Performance Test**:
   - Run queries in dev environment
   - Measure performance with production data volume
   - More realistic than empty dev database

## Deployment Workflow

### Regular Development Cycle

```bash
# 1. Work on develop branch locally with test-company
git checkout develop
git pull origin develop

# 2. Make changes and test locally
docker-compose up -d
# ... test your changes with test-company org ...

# 3. Commit and push (triggers auto-deployment)
git add .
git commit -m "feat: add new feature"
git push origin develop

# 4. Wait for deployments:
#    - GitHub Actions deploys to Cloud Run Dev
#    - Vercel creates preview deployment

# 5. Test on preview URL with test-company
#    Visit: https://evaluation-system-git-develop-xxx.vercel.app
#    Log in with test-company user from Clerk test mode

# 6. If tests pass, create PR to main
gh pr create --title "feat: add new feature" --base main
```

### Production Deployment

```bash
# 1. Merge PR to main (via GitHub UI)
# 2. Automatic deployments trigger:
#    - GitHub Actions → Cloud Run Production
#    - Vercel → Production deployment
# 3. Monitor deployments
# 4. Verify production: https://evaluation-system.vercel.app
# 5. Real companies use live Clerk mode, unaffected by test-company
```

## Monitoring & Logs

### View Cloud Run Logs

```bash
# Production logs (real companies)
gcloud run logs read hr-evaluation-backend \
  --region=$REGION \
  --limit=50

# Development logs (test-company)
gcloud run logs read hr-evaluation-backend-dev \
  --region=$REGION \
  --limit=50

# Follow logs in real-time
gcloud run logs tail hr-evaluation-backend-dev \
  --region=$REGION
```

### View Vercel Logs

1. Go to Vercel Dashboard
2. Select deployment
3. View **Functions** tab for backend logs
4. View **Build** tab for build logs

## Troubleshooting

### Cloud Run Deployment Fails

```bash
# Check GitHub Actions logs
# Common issues:
# - GCP secrets not found (check secret names match)
# - Service account permissions (check IAM roles)
# - Docker build errors (check Dockerfile.prod)

# Verify secrets exist
gcloud secrets list --filter="name~-dev$" --project=$PROJECT_ID
```

### Vercel Preview Can't Connect to Backend

```bash
# 1. Verify CORS settings on dev backend
gcloud run services describe hr-evaluation-backend-dev \
  --region=$REGION \
  --format='yaml' | grep CORS

# 2. Check Vercel environment variables
# Make sure NEXT_PUBLIC_API_BASE_URL points to dev backend

# 3. Test backend directly
curl -H "Origin: https://evaluation-system-git-develop-xxx.vercel.app" \
  -I https://hr-evaluation-backend-dev-xxx.run.app/health
```

### Local Docker Compose Issues

```bash
# Reset everything
docker-compose down -v
docker-compose up --build

# Check backend logs
docker-compose logs backend

# Check frontend logs
docker-compose logs frontend
```

### Data Isolation Issues

```bash
# If you accidentally see other organization's data:
# 1. Check your backend auth context is correctly filtering by org_id
# 2. Verify Clerk JWT contains correct org_id
# 3. Check database queries include WHERE organization_id = ?

# Test query isolation:
# In your backend, log the SQL queries and verify they include org filter
```

## Cost Optimization

### Cloud Run Instances

Both instances are configured with:
- `min-instances=0` - Scale to zero when idle
- Production: `max-instances=5`
- Development: `max-instances=3`

**Estimated costs:**
- Production: ~$10-30/month (depending on traffic)
- Development: ~$5-15/month (scales to 0 when not in use)
- **Database: $0 extra** (same production Supabase)

### Reduce Development Costs

```bash
# Manually scale development to 0 instances when not needed
gcloud run services update hr-evaluation-backend-dev \
  --region=$REGION \
  --no-traffic

# Re-enable when needed
gcloud run services update hr-evaluation-backend-dev \
  --region=$REGION \
  --traffic=LATEST=100
```

## Security Best Practices

1. **Never commit secrets** - Use `.env.local` (gitignored)
2. **Separate Clerk instances** - Test mode for dev, Live mode for prod
3. **Test organization only** - Never use real company data in test-company
4. **Organization isolation** - Backend must enforce org_id filtering
5. **Restrict CORS** - Production allows only specific domains
6. **Monitor usage** - Set up GCP billing alerts

## Quick Reference Commands

```bash
# Get backend URLs
echo "Production: $(gcloud run services describe hr-evaluation-backend --region=$REGION --format='value(status.url)')"
echo "Development: $(gcloud run services describe hr-evaluation-backend-dev --region=$REGION --format='value(status.url)')"

# Health checks
curl $(gcloud run services describe hr-evaluation-backend --region=$REGION --format='value(status.url)')/health
curl $(gcloud run services describe hr-evaluation-backend-dev --region=$REGION --format='value(status.url)')/health

# View recent logs
gcloud run logs read hr-evaluation-backend --region=$REGION --limit=20
gcloud run logs read hr-evaluation-backend-dev --region=$REGION --limit=20

# List deployments
gcloud run revisions list --service=hr-evaluation-backend --region=$REGION
gcloud run revisions list --service=hr-evaluation-backend-dev --region=$REGION

# Check database organizations
# (Via Supabase Dashboard SQL Editor)
SELECT organization_id, COUNT(*) as count FROM users GROUP BY organization_id;
```

## Next Steps

After completing this setup:

1. ✅ Local development works with Docker Compose + test-company
2. ✅ Develop branch auto-deploys to Cloud Run Dev + Vercel Preview
3. ✅ Main branch auto-deploys to Cloud Run Prod + Vercel Production
4. ✅ Multi-tenant security tested in same database as production
5. ✅ Cost-effective (no separate dev database, both Cloud Run scale to zero)
6. ✅ Realistic testing with production data volume

You can now safely develop and test features on the `develop` branch without affecting production, while ensuring your multi-tenant security model works correctly!
