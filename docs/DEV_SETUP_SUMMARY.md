# Development Environment Setup — develop Branch (Revised)

## What Was Implemented

### 1. Branch & Environments

- Git workflow
  - `main` → Production (frontend + backend)
  - `develop` → Development (frontend preview + Cloud Run dev)
- Cloud Run services
  - `hr-evaluation-backend` (prod) ← deploys from `main`
  - `hr-evaluation-backend-dev` (dev) ← deploys from `develop`
- Clerk tenants
  - Production: Clerk Live mode (real users/organizations)
  - Development: Clerk Test mode (engineers only)

### 2. GitHub Actions Workflow Updated

**File:** [`.github/workflows/deploy-backend.yml`](../.github/workflows/deploy-backend.yml)

**Changes:**
- ✅ Added `develop` branch to deployment triggers
- ✅ Dynamic service name selection based on branch
  - `main` → `hr-evaluation-backend` (production)
  - `develop` → `hr-evaluation-backend-dev` (development)
- ✅ Dynamic secret selection with `-dev` suffix for Clerk secrets
- ✅ **IMPORTANT:** Both environments use the SAME `database-url` secret (no `-dev` suffix)
- ✅ Different resource limits (5 instances for prod, 3 for dev)
- ✅ Separate Docker images for each environment

### 3. Architecture Decision: Single Production Database

**Key Change:** Instead of separate dev and production databases, we use:
- **Single Supabase production database**
- **"test-company" organization** for development and testing
- **Real company organizations** for production

**Why This Is Better:**
1. ✅ Tests real multi-tenant security in production environment
2. ✅ Validates organization isolation works correctly
3. ✅ No schema drift between environments
4. ✅ Simpler setup (no database synchronization)
5. ✅ Lower costs (no separate dev database)
6. ✅ More realistic testing with production data volume

## Updated Architecture

```
┌────────────────────────────────────────────────────┐
│  Single Production Database (Supabase)              │
│  ├─ Organization: "test-company" (for testing)     │
│  │   └─ Used by: Local dev + Cloud Run dev        │
│  ├─ Organization: "real-company-1"                 │
│  │   └─ Used by: Production only                   │
│  └─ Organization: "real-company-2"                 │
│       └─ More real companies...                    │
└────────────────────────────────────────────────────┘
         ↑                           ↑
         │                           │
    Cloud Run Dev              Cloud Run Prod
    (Clerk Test mode)          (Clerk Live mode)
```

## What You Need to Do Next

This revision focuses on making the `develop` branch a full development application: preview frontend on Vercel and a separate Cloud Run dev backend, authenticated via Clerk Test mode without changing Clerk’s JWT template.

### Step 1: Clerk — No JWT Template Changes Needed

We keep Clerk’s default `aud` behavior. The backend now accepts multiple audiences by reading a comma‑separated `CLERK_AUDIENCE` and verifying against a list. This avoids switching JWT templates between prod and dev.

What to do:
- Use Clerk Test mode for development users as before.
- Do not change the JWT template.
- Provide the dev backend with a list of allowed audiences that matches the origins you use (stable Vercel preview domain and localhost).

## One-Page Terminal Runbook (Copy/Paste)

Run the following commands in order to create the development container first, then wire the preview environment. Replace placeholder values as noted.

```bash
# --- 0) Set context ---
gcloud auth login
export PROJECT_ID="hr-evaluation-app-474400"
export REGION="asia-northeast1"

# --- 1) Helper for idempotent secrets ---
ensure_secret() {
  local NAME="$1"; local VALUE="$2"
  if gcloud secrets describe "$NAME" --project="$PROJECT_ID" >/dev/null 2>&1; then
    printf "%s" "$VALUE" | gcloud secrets versions add "$NAME" --data-file=- --project="$PROJECT_ID"
  else
    printf "%s" "$VALUE" | gcloud secrets create "$NAME" --data-file=- --replication-policy="automatic" --project="$PROJECT_ID"
  fi
}

# --- 2) Dev secrets (no database-url-dev) ---
ensure_secret clerk-secret-key-dev "sk_test_your_clerk_secret_key"
ensure_secret clerk-issuer-dev "https://your-test-app.clerk.accounts.dev"
ensure_secret clerk-audience-dev "evaluation-system-dev.vercel.app,localhost:3000"
# Optional hardening (JWT azp allow-list)
ensure_secret clerk-authorized-parties-dev "evaluation-system-dev.vercel.app,localhost:3000"
ensure_secret clerk-webhook-secret-dev "whsec_your_dev_webhook_secret"
# App secret key (random)
python3 -c "import secrets; print(secrets.token_urlsafe(32))" | while read SK; do ensure_secret app-secret-key-dev "$SK"; done

# --- 3) Grant Cloud Run service account secret access ---
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
export SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
for SECRET in \
  clerk-secret-key-dev clerk-issuer-dev clerk-audience-dev \
  clerk-authorized-parties-dev clerk-webhook-secret-dev app-secret-key-dev \
  database-url; do
  gcloud secrets add-iam-policy-binding "$SECRET" \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor" \
    --project="$PROJECT_ID"
done

# --- 4) Enable required Google APIs (idempotent) ---
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com \
  secretmanager.googleapis.com \
  serviceusage.googleapis.com \
  cloudresourcemanager.googleapis.com

# --- 5) Build and push dev image with Cloud Build (uses backend/Dockerfile.prod) ---
# Use a custom substitution that starts with an underscore (Cloud Build requirement)
TAG="manual-$(date +%Y%m%d-%H%M%S)"
cat > /tmp/cloudbuild.backend.yaml << 'YAML'
steps:
- name: 'gcr.io/cloud-builders/docker'
  args: ['build','-f','Dockerfile.prod','-t','gcr.io/$PROJECT_ID/hr-evaluation-backend-dev:${_TAG}','.']
images:
- 'gcr.io/$PROJECT_ID/hr-evaluation-backend-dev:${_TAG}'
YAML
# Submit only the backend directory as the build context (smaller upload)
gcloud builds submit backend --config /tmp/cloudbuild.backend.yaml --substitutions _TAG=$TAG

# --- 6) Deploy Cloud Run service (manual initial deploy) ---
gcloud run deploy hr-evaluation-backend-dev \
  --image gcr.io/$PROJECT_ID/hr-evaluation-backend-dev:$TAG \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 3 \
  --memory 512Mi \
  --cpu 1 \
  --port 8000 \
  --set-env-vars "ENVIRONMENT=production,LOG_LEVEL=INFO,DEBUG=False,CLERK_ENFORCE_AZP=false" \
  --set-secrets "CLERK_SECRET_KEY=clerk-secret-key-dev:latest,\
SUPABASE_DATABASE_URL=database-url:latest,\
CLERK_ISSUER=clerk-issuer-dev:latest,\
CLERK_AUDIENCE=clerk-audience-dev:latest,\
CLERK_WEBHOOK_SECRET=clerk-webhook-secret-dev:latest,\
SECRET_KEY=app-secret-key-dev:latest"

# --- 7) Fetch dev backend URL ---
DEV_API=$(gcloud run services describe hr-evaluation-backend-dev \
  --region="$REGION" --format='value(status.url)')
echo "Dev API: $DEV_API"

# --- 8) Set CORS for preview + localhost ---
export PREVIEW_DOMAIN="https://evaluation-system-dev.vercel.app"
gcloud run services update hr-evaluation-backend-dev \
  --region="$REGION" \
  --update-env-vars "ENVIRONMENT=production,\
FRONTEND_URL=${PREVIEW_DOMAIN},\
ADDITIONAL_CORS_ORIGINS=https://*.vercel.app,http://localhost:3000,http://127.0.0.1:3000"

# Optional: enforce authorized parties at runtime (if you created the secret)
gcloud run services update hr-evaluation-backend-dev \
  --region="$REGION" \
  --set-secrets "CLERK_AUTHORIZED_PARTIES=clerk-authorized-parties-dev:latest"

# --- 9) (Optional) Set Vercel Preview env via CLI ---
# Requires: npm i -g vercel && vercel login
vercel env add NEXT_PUBLIC_API_BASE_URL preview     # paste: $DEV_API
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY preview  # paste: pk_test_...
vercel env add CLERK_SECRET_KEY preview             # paste: sk_test_...
vercel env add NEXT_PUBLIC_SUPABASE_URL preview     # paste: https://xxx.supabase.co
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview # paste: eyJ...
vercel env add NEXT_PUBLIC_APP_ENV preview          # optional: preview

# --- 10) Smoke test ---
curl -I "$DEV_API/health" || true
curl -I "$DEV_API/api/v1/health" || true
```


### Step 2: Create GCP Development Secrets (One-time)

**Important:** We do NOT create `database-url-dev` - both environments share the production database!

```bash
gcloud auth login

export PROJECT_ID="hr-evaluation-app-474400"
export REGION="asia-northeast1"

# [x] 1. Clerk Secret Key (Test mode)
echo -n "sk_test_your_clerk_secret_key" | \
  gcloud secrets create clerk-secret-key-dev \
  --data-file=- \
  --replication-policy="automatic" \
  --project=$PROJECT_ID

# [x] 2. Clerk Issuer (Test mode)
echo -n "https://your-test-app.clerk.accounts.dev" | \
  gcloud secrets create clerk-issuer-dev \
  --data-file=- \
  --replication-policy="automatic" \
  --project=$PROJECT_ID

# [x] 3. Clerk Audience (comma-separated; matches origins you use)
# Example: stable preview domain + localhost
echo -n "evaluation-system-dev.vercel.app,localhost:3000" | \
  gcloud secrets create clerk-audience-dev \
  --data-file=- \
  --replication-policy="automatic" \
  --project=$PROJECT_ID

# [x] 3-b. Authorized Parties for extra safety (validates JWT 'azp')
# This enforces that the token's 'azp' equals one of these origins.
echo -n "evaluation-system-dev.vercel.app,localhost:3000" | \
  gcloud secrets create clerk-authorized-parties-dev \
  --data-file=- \
  --replication-policy="automatic" \
  --project=$PROJECT_ID

# [x] 4. Clerk Webhook Secret (Test mode)
echo -n "whsec_your_dev_webhook_secret" | \
  gcloud secrets create clerk-webhook-secret-dev \
  --data-file=- \
  --replication-policy="automatic" \
  --project=$PROJECT_ID

# [x] 5. Application Secret Key
python3 -c "import secrets; print(secrets.token_urlsafe(32))" | \
  gcloud secrets create app-secret-key-dev \
  --data-file=- \
  --replication-policy="automatic" \
  --project=$PROJECT_ID

# Grant Cloud Run access to dev secrets
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
export SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for SECRET in clerk-secret-key-dev clerk-issuer-dev \
              clerk-audience-dev clerk-authorized-parties-dev \
              clerk-webhook-secret-dev app-secret-key-dev; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$PROJECT_ID
done

# IMPORTANT: Also grant access to PRODUCTION database-url (shared)
gcloud secrets add-iam-policy-binding database-url \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor" \
  --project=$PROJECT_ID
```

### Step 3: Create "test-company" Organization in Clerk

1. **Create separate Clerk test mode application** (if you don't have one)
   - Go to [Clerk Dashboard](https://dashboard.clerk.com/)
   - Create new application in **Test mode**
   - Enable **Organizations** feature

2. **Create "test-company" organization**
   - In your local app or Clerk dashboard
   - Name: `test-company`
   - This will be used for all development and testing

3. **Your production Clerk should be separate**
   - Use **Live mode** for production
   - Real companies create their organizations here

### Step 4: Configure Vercel — Preview on develop

You do not need to “buy” a domain to test previews. Vercel provides branch previews automatically, e.g. `yourproj-git-develop-<hash>-yourteam.vercel.app`. Optionally, you can add a stable preview alias for `develop` (e.g. `evaluation-system-dev.vercel.app`) in Vercel → Project → Domains.

1) [x] Add a stable Preview domain (optional but recommended)
   - Vercel → Project → Domains → Add → use `evaluation-system-dev.vercel.app` (or your custom domain/subdomain)
   - If using a custom domain you own, add a CNAME to `cname.vercel-dns.com` at your DNS provider
   - Set the domain to “Preview” environment so it binds to `develop` deployments

2) [ ] Environment variables (Vercel → Project → Settings → Environment Variables)

For **Preview** (used by `develop`):
   - `NEXT_PUBLIC_API_BASE_URL` = `https://hr-evaluation-backend-dev-XXX.run.app`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = `pk_test_xxx` (Clerk Test)
   - `CLERK_SECRET_KEY` = `sk_test_xxx` (Clerk Test)
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://xxx.supabase.co` (same as prod)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJxxx` (same as prod)
   - Optional: `NEXT_PUBLIC_APP_ENV` = `preview`

For **Production** (main):
   - Keep existing production Clerk live mode keys
   - Same Supabase credentials

### Step 5: Update Cloud Run Dev — Environment & CORS

After first development deployment, set CORS using variables your code actually reads:

```bash
# Allow preview + localhost
# Code behavior:
# - When ENVIRONMENT=production, it uses FRONTEND_URL plus ADDITIONAL_CORS_ORIGINS (comma-separated)

PREVIEW_DOMAIN="https://evaluation-system-dev.vercel.app"   # your stable preview URL

gcloud run services update hr-evaluation-backend-dev \
  --region=$REGION \
  --update-env-vars "ENVIRONMENT=production,\
FRONTEND_URL=${PREVIEW_DOMAIN},\
ADDITIONAL_CORS_ORIGINS=https://*.vercel.app,http://localhost:3000,http://127.0.0.1:3000"
```

### Step 6: Test the Setup

```bash
# 1. Get the Cloud Run dev URL (if not saved)
DEV_API=$(gcloud run services describe hr-evaluation-backend-dev \
  --region="$REGION" --format='value(status.url)')
echo "Dev API: $DEV_API"

# 2. Smoke test endpoints
curl -I "$DEV_API/health" || true
curl -I "$DEV_API/api/v1/health" || true

# 3. App-level test (after wiring Vercel Preview env)
# Open the Vercel preview, sign in with a Clerk Test user, and verify basic flows.

# 4. Test organization isolation (manual QA)
# Log in as test-company user; verify only test-company data is visible.
```

## Environment Comparison

| Aspect | Local Dev | Cloud Dev | Production |
|--------|-----------|-----------|------------|
| **Frontend** | localhost:3000 | Vercel Preview | Vercel Production |
| **Backend** | localhost:8000 | Cloud Run Dev | Cloud Run Prod |
| **ENVIRONMENT** | `development` | `production` | `production` |
| **Clerk** | Test mode | Test mode | Live mode |
| **Organization** | test-company | test-company | Real companies |
| **Database** | **Prod Supabase** | **Prod Supabase** | **Prod Supabase** |
| **Trigger** | Manual | Push to develop | Push to main |

## Cloud Run (Dev) — One-time Setup Summary

1) Create the dev service (manual initial deployment):

```bash
export PROJECT_ID="hr-evaluation-app-474400"
export REGION="asia-northeast1"

# Build & push image via Cloud Build (uses backend/Dockerfile.prod)
TAG="manual-$(date +%Y%m%d-%H%M%S)"
cat > /tmp/cloudbuild.backend.yaml << 'YAML'
steps:
- name: 'gcr.io/cloud-builders/docker'
  args: ['build','-f','Dockerfile.prod','-t','gcr.io/$PROJECT_ID/hr-evaluation-backend-dev:${_TAG}','.']
images:
- 'gcr.io/$PROJECT_ID/hr-evaluation-backend-dev:${_TAG}'
YAML
gcloud builds submit backend --config /tmp/cloudbuild.backend.yaml --substitutions _TAG=$TAG

gcloud run deploy hr-evaluation-backend-dev \
  --image gcr.io/$PROJECT_ID/hr-evaluation-backend-dev:$TAG \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi --cpu 1 \
  --max-instances 3 --min-instances 0 \
  --set-secrets "CLERK_SECRET_KEY=clerk-secret-key-dev:latest,\
SUPABASE_DATABASE_URL=database-url:latest,\
CLERK_ISSUER=clerk-issuer-dev:latest,\
CLERK_AUDIENCE=clerk-audience-dev:latest,\
CLERK_WEBHOOK_SECRET=clerk-webhook-secret-dev:latest,\
SECRET_KEY=app-secret-key-dev:latest,\
CLERK_AUTHORIZED_PARTIES=clerk-authorized-parties-dev:latest" \
  --set-env-vars "ENVIRONMENT=production,LOG_LEVEL=INFO,CLERK_ENFORCE_AZP=false"

# Then set FRONTEND_URL and ADDITIONAL_CORS_ORIGINS as shown above
```

2) Keep the dev service bound to the `develop` branch via GitHub Actions. The workflow already:
   - Triggers on `develop`
   - Builds an image tagged for dev
   - Deploys to `hr-evaluation-backend-dev`

3) Optional: Use a custom domain for the dev API
   - Reserve, e.g., `api-dev.evaluation-system-one.vercel.app` or `api-dev.yourdomain.com`
   - For custom domain you own: map via Cloud Run Custom Domains (or behind a HTTPS LB)
   - Otherwise, use the generated `https://hr-evaluation-backend-dev-XXX.run.app`

## Key Differences from Original Plan

### Original Plan (Discarded)
- ❌ Separate dev Supabase database
- ❌ `database-url-dev` secret
- ❌ Need to sync schemas between databases
- ❌ Higher costs (2 databases)

### Updated Plan (Implemented)
- ✅ Single production Supabase database
- ✅ Only `database-url` secret (shared)
- ✅ "test-company" organization for testing
- ✅ Tests real multi-tenant security
- ✅ Lower costs, simpler setup

## Access Control for Dev

- Clerk Test mode: Only invited engineers get sessions; real users cannot authenticate.
- Vercel Preview protection (optional): restrict preview URL to team members.
- Cloud Run is public but the API requires valid Clerk Test tokens; that’s sufficient for most teams. For stricter network control, consider Cloud Armor in front of Cloud Run or private ingress behind a load balancer (advanced).

## Security Testing Benefits

With the shared database approach, you can:

1. **Test Organization Isolation**
   ```sql
   -- Verify test-company cannot see other orgs
   SELECT * FROM users WHERE organization_id = 'real-company-id';
   -- Should be blocked by backend auth!
   ```

2. **Validate Multi-Tenancy**
   - Ensures your backend correctly filters by organization_id
   - Tests the ACTUAL production security model
   - Catches bugs before they affect real companies

3. **Realistic Testing**
   - Test with production data volume
   - Same query performance as production
   - No surprises when deploying to production

## Cost Savings

- Production Supabase: **$0** (already exists)
- Development Supabase: **$0** (not needed!)
- Cloud Run Dev: **~$5-15/month** (scales to zero)
- **Total savings:** No extra database costs!

## Next Steps

1. ✅ Create GCP dev secrets (without database-url-dev)
2. ✅ Set up "test-company" in Clerk test mode
3. ✅ Configure Vercel preview environment
4. ✅ Test deployment to develop branch
5. ✅ Verify organization isolation works correctly

## Troubleshooting

### "database-url-dev not found" Error

**This is expected!** Both environments now use `database-url` (no `-dev` suffix). Make sure the Cloud Run service account has access to the production `database-url` secret.

```bash
gcloud secrets add-iam-policy-binding database-url \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"
```

### Can See Other Organizations' Data

**This is a security bug!** Your backend must filter queries by `organization_id`. Check:
1. Auth context extracts org_id from Clerk JWT
2. All database queries include `WHERE organization_id = ?`
3. Backend middleware enforces organization scope

### Schema Migration Issues

Since dev and prod share the database:
1. Test migrations in `test-company` org first
2. Verify migrations don't break existing real company data
3. Use Supabase migration tools carefully

## Resources

- **Detailed Setup Guide**: [docs/dev-env-setup.md](./dev-env-setup.md)
- **Main Deployment Guide**: [docs/deployment.md](./deployment.md)
- **GitHub Actions Workflow**: [.github/workflows/deploy-backend.yml](../.github/workflows/deploy-backend.yml)

## Questions?

The shared database approach is:
- ✅ More realistic (tests actual production environment)
- ✅ Simpler (no database sync needed)
- ✅ Cheaper (no extra database costs)
- ✅ Better security testing (validates multi-tenancy)

Your idea to use "test-company" was **excellent** - it's the industry standard approach for multi-tenant SaaS applications!
