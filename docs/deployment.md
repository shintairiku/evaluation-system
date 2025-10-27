# 🚀 HR Evaluation System - Complete Deployment Guide

**For First-Time Deployers: A Step-by-Step Guide**

This guide walks you through deploying the HR Evaluation System to production with:
- **Frontend**: Vercel (Next.js)
- **Backend**: Google Cloud Run (FastAPI)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Clerk

**Estimated Time**: 60-90 minutes for first deployment

> **📚 Related Documentation:**
> - **[Development Environment Setup](./development-environment-setup.md)** - Complete guide for setting up local dev, Cloud Run dev, and production environments
> - **[Architecture Overview](./ARCHITECTURE.md)** - System architecture and technical details

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Phase 1: Preparation](#phase-1-preparation)
3. [Phase 2: Backend Deployment (Cloud Run)](#phase-2-backend-deployment-cloud-run)
4. [Phase 3: Frontend Deployment (Vercel)](#phase-3-frontend-deployment-vercel)
5. [Phase 4: Post-Deployment Configuration](#phase-4-post-deployment-configuration)
6. [Development Environment](#development-environment)
7. [Verification & Testing](#verification--testing)
8. [Troubleshooting](#troubleshooting)
9. [Rollback Procedures](#rollback-procedures)

---

## Prerequisites

### Required Accounts & Services

**Before you begin, ensure you have:**

- [x] **Google Cloud Platform** account with billing enabled ([Sign up](https://cloud.google.com/))
- [x] **Vercel** account ([Sign up - Free tier](https://vercel.com/signup))
- [x] **Supabase** account ([Sign up - Free tier](https://app.supabase.com/))
- [x] **Clerk** account ([Sign up - Free tier](https://dashboard.clerk.com/sign-up))
- [x] **GitHub** repository access (admin permissions)

### Required Tools Installation

**macOS/Linux:**
```bash
# 1. Install Google Cloud SDK
brew install google-cloud-sdk  # macOS
# OR
curl https://sdk.cloud.google.com | bash  # Linux

# 2. Install Vercel CLI (optional but recommended)
npm install -g vercel

# 3. Verify installations
gcloud --version
vercel --version
git --version
```

**Windows:**
- Download Google Cloud SDK: https://cloud.google.com/sdk/docs/install
- Install Node.js: https://nodejs.org/ (includes npm)
- Run: `npm install -g vercel`

---

## Phase 1: Preparation

### [x] Step 1.1: Prepare Supabase Production Database

1. **Create Production Project**
   - Go to [Supabase Dashboard](https://app.supabase.com/)
   - Click "New Project"
   - Fill in:
     - Name: `hr-evaluation-prod`
     - Database Password: (Generate a strong password, save it!)
     - Region: Choose closest to your users (e.g., `Northeast Asia (Tokyo)`)
   - Click "Create new project" (takes ~2 minutes)

2. **Get Database Connection Details**
   - Go to Project Settings → Database
   - Copy these values to a notepad:
     ```
     Connection string (URI):
     postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres

     Connection pooling (recommended for serverless):
     postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
     ```
   - Copy API keys:
     - `anon public` key
     - `service_role` key (keep this secret!)

3. **Run Database Migrations** (if you have SQL files)
   - Go to SQL Editor in Supabase
   - Create tables using your schema
   - Or restore from backup if migrating

### [ ] Step 1.2: Prepare Clerk Production Instance

1. **Create Production Application**
   - Go to [Clerk Dashboard](https://dashboard.clerk.com/)
   - Click "Add application"
   - Name: `HR Evaluation - Production`
   - Select authentication methods (Email, Google, etc.)
   - Click "Create application"

2. **Get Production Keys**
   - In your new application dashboard, find:
     - **Publishable key** (starts with `pk_live_`)
     - **Secret key** (starts with `sk_live_`) - Click "Show" to reveal
   - Copy these to your notepad

3. **Configure Organization Settings** (if using multi-tenant)
   - Go to "Organizations" in sidebar
   - Enable organizations
   - Configure roles and permissions

4. **Note JWT Configuration** (for backend)
   - Go to "JWT Templates" → default template
   - Note the **Issuer** URL (e.g., `https://your-app.clerk.accounts.dev`).
   - If your template does not set `aud`, that is acceptable. Our backend can verify either `aud` or `azp` (Authorized Party).
   - We recommend also validating `azp` via a new backend env `CLERK_AUTHORIZED_PARTIES` (comma-separated origins), which should include your production frontend origin (e.g., `your-app.vercel.app`).

> ⚠️ **Important**: We'll configure webhooks AFTER backend deployment (Step 4.2)

### [x] Step 1.3: Prepare Your Environment Variables

Create a checklist of all values you'll need (use the `.env.prod` template):

**Backend (Cloud Run):**
```bash
CLERK_SECRET_KEY=sk_live_xxxxx              # From Clerk
SUPABASE_DATABASE_URL=postgresql://...      # From Supabase (pooler URL)
CLERK_ISSUER=https://xxx.clerk.accounts.dev # From Clerk JWT settings
CLERK_AUDIENCE=your-domain.com              # Your domain or Clerk default
CLERK_AUTHORIZED_PARTIES=your-app.vercel.app # Enforce JWT azp matches frontend origin
CLERK_WEBHOOK_SECRET=whsec_xxxxx            # Will get after webhook setup
```

**Frontend (Vercel):**
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx  # From Clerk
CLERK_SECRET_KEY=sk_live_xxxxx                   # From Clerk (same as backend)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co # From Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...        # From Supabase
NEXT_PUBLIC_API_BASE_URL=https://backend-xxx.run.app  # Will get after backend deploy
```

---

## Phase 2: Backend Deployment (Cloud Run)

**Why Backend First?** The frontend needs the backend URL to build correctly.

### [x] Step 2.1: Set Up Google Cloud Project

**Important**: Have your credit card ready - GCP requires billing to be enabled (free tier available).

```bash
# 1. Login to Google Cloud (opens browser for authentication)
gcloud auth login

# 2. Create a new project (choose a unique project ID)
# Replace 'hr-eval-prod-12345' with your unique project ID
export PROJECT_ID="hr-evaluation-app-474400"
gcloud projects create $PROJECT_ID --name="HR Evaluation System Production"

# 3. Set this as your active project
gcloud config set project $PROJECT_ID

# 4. Link billing account (required for Cloud Run)
# First, list your billing accounts
gcloud billing accounts list

# Then link billing (replace BILLING_ACCOUNT_ID with the ID from above)
gcloud billing projects link $PROJECT_ID --billing-account=BILLING_ACCOUNT_ID

# 5. Enable required APIs (takes ~2-3 minutes)
echo "Enabling required GCP APIs..."
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable secretmanager.googleapis.com

echo "✅ GCP project setup complete!"
```

**Troubleshooting**:
- If billing link fails, go to [GCP Console](https://console.cloud.google.com/) → Billing → Link a billing account
- If you get permission errors, ensure you're using your personal Google account or have Owner role

### [x] Step 2.2: Set Up Secrets in Google Secret Manager

**What are secrets?** Sensitive data (API keys, database passwords) stored securely in GCP.

```bash
# Get your project number (needed for permissions)
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

# Create secrets (replace placeholder values with your actual secrets from Step 1.3)

# 1. Clerk Secret Key
echo -n "sk_live_YOUR_CLERK_SECRET_KEY" | gcloud secrets create clerk-secret-key --data-file=-

<START FROM HERE>

# 2. Database URL (use connection pooling URL from Supabase)
echo -n "postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true" | gcloud secrets create database-url --data-file=-

# 3. Clerk Issuer
echo -n "https://your-app.clerk.accounts.dev" | gcloud secrets create clerk-issuer --data-file=-

# 4. Clerk Audience (your domain if you use `aud`)
echo -n "your-domain.com" | gcloud secrets create clerk-audience --data-file=-

# 4-b. (Recommended) Clerk Authorized Parties (enforce `azp`)
echo -n "your-app.vercel.app" | gcloud secrets create clerk-authorized-parties --data-file=-

# 5. Clerk Webhook Secret (we'll update this later, use placeholder for now)
echo -n "PLACEHOLDER_WILL_UPDATE_LATER" | gcloud secrets create clerk-webhook-secret --data-file=-

# 6. Application Secret Key (generate with: openssl rand -hex 32)
echo -n "$(openssl rand -hex 32)" | gcloud secrets create app-secret-key --data-file=-

echo "✅ Secrets created!"

# Grant Cloud Run service account access to all secrets
echo "Granting Cloud Run access to secrets..."
for secret in clerk-secret-key database-url clerk-issuer clerk-audience clerk-authorized-parties clerk-webhook-secret app-secret-key; do
  gcloud secrets add-iam-policy-binding $secret \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done

echo "✅ Secrets permissions configured!"

# Verify secrets were created
echo "Listing all secrets:"
gcloud secrets list
```

**Troubleshooting**:
- If secret creation fails with "already exists", delete it first: `gcloud secrets delete SECRET_NAME`
- To update a secret: `echo -n "new-value" | gcloud secrets versions add SECRET_NAME --data-file=-`
- To view secret names: `gcloud secrets list`

### Step 2.3: Build and Deploy Backend

**Choose your deployment method:**
- **Option A (Recommended for first deploy)**: Manual deployment - Full control, understand each step
- **Option B (For CI/CD later)**: Automated via Cloud Build - Deploys on git push

#### Option A: Manual Deployment (Recommended)

```bash
# Navigate to project root
cd /path/to/evaluation-system

# Set region (choose one close to your users)
export REGION="asia-northeast1"  # or asia-northeast1 (Tokyo), europe-west1 (Belgium)

# Build the Docker image using production Dockerfile
echo "Building Docker image for AMD64..."
docker build --platform linux/amd64 \
  -t gcr.io/$PROJECT_ID/hr-evaluation-backend:latest \
  -f backend/Dockerfile.prod \
  ./backend

# Configure Docker to authenticate with GCP
gcloud auth configure-docker

# Push image to Google Container Registry (takes ~1-2 minutes)
echo "Pushing image to GCR..."
docker push gcr.io/$PROJECT_ID/hr-evaluation-backend:latest

# Deploy to Cloud Run (takes ~2-3 minutes)
echo "Deploying to Cloud Run..."
gcloud run deploy hr-evaluation-backend \
  --image gcr.io/$PROJECT_ID/hr-evaluation-backend:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "ENVIRONMENT=production,LOG_LEVEL=INFO,DEBUG=False" \
  --set-secrets "CLERK_SECRET_KEY=clerk-secret-key:latest,SUPABASE_DATABASE_URL=database-url:latest,CLERK_ISSUER=clerk-issuer:latest,CLERK_AUDIENCE=clerk-audience:latest,CLERK_AUTHORIZED_PARTIES=clerk-authorized-parties:latest,CLERK_WEBHOOK_SECRET=clerk-webhook-secret:latest,SECRET_KEY=app-secret-key:latest" \
  --min-instances 0 \
  --max-instances 5 \
  --memory 512Mi \
  --cpu 1 \
  --cpu-throttling \
  --timeout 300s \
  --port 8000

# Get and save the backend URL
export BACKEND_URL=$(gcloud run services describe hr-evaluation-backend \
  --region $REGION \
  --format 'value(status.url)')

echo "✅ Backend deployed successfully!"
echo "Backend URL: $BACKEND_URL"
echo ""
echo "⚠️  IMPORTANT: Save this URL! You'll need it for:"
echo "   1. Frontend deployment (NEXT_PUBLIC_API_BASE_URL)"
echo "   2. Clerk webhook configuration"
```

**Expected output:**
```
Service [hr-evaluation-backend] revision [hr-evaluation-backend-00001-abc] has been deployed and is serving 100 percent of traffic.
Service URL: https://hr-evaluation-backend-xxxxx-uc.a.run.app
```

**Test the deployment:**
```bash
# Test health endpoint
curl $BACKEND_URL/health

# Expected response:
# {"status":"healthy"}

# Test API docs (optional)
open $BACKEND_URL/docs  # Opens FastAPI Swagger UI in browser
```

#### Option B: Multi-Environment Deployment (Production + Development)

**This setup deploys:**
- `main` branch → `hr-evaluation-backend` (production)
- `develop` branch → `hr-evaluation-backend-dev` (development)

1. **Create Development Secrets** (separate from production)

```bash
# Create development-specific secrets
echo -n "sk_test_YOUR_CLERK_DEV_SECRET_KEY" | gcloud secrets create clerk-secret-key-dev --data-file=-
echo -n "postgresql://postgres.[DEV-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true" | gcloud secrets create database-url-dev --data-file=-
echo -n "https://your-dev-app.clerk.accounts.dev" | gcloud secrets create clerk-issuer-dev --data-file=-
echo -n "your-dev-domain.com" | gcloud secrets create clerk-audience-dev --data-file=-
echo -n "your-dev-frontend.vercel.app,localhost:3000" | gcloud secrets create clerk-authorized-parties-dev --data-file=-
echo -n "whsec_DEV_WEBHOOK_SECRET" | gcloud secrets create clerk-webhook-secret-dev --data-file=-
echo -n "$(openssl rand -hex 32)" | gcloud secrets create app-secret-key-dev --data-file=-

# Grant permissions for dev secrets
for secret in clerk-secret-key-dev database-url-dev clerk-issuer-dev clerk-audience-dev clerk-authorized-parties-dev clerk-webhook-secret-dev app-secret-key-dev; do
  gcloud secrets add-iam-policy-binding $secret \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

2. **Deploy Development Environment**

```bash
# Build and deploy development version
docker build -t gcr.io/$PROJECT_ID/hr-evaluation-backend-dev:latest -f backend/Dockerfile.prod ./backend
docker push gcr.io/$PROJECT_ID/hr-evaluation-backend-dev:latest

# Deploy to separate Cloud Run service
gcloud run deploy hr-evaluation-backend-dev \
  --image gcr.io/$PROJECT_ID/hr-evaluation-backend-dev:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "ENVIRONMENT=development,LOG_LEVEL=DEBUG,DEBUG=True" \
  --set-secrets "CLERK_SECRET_KEY=clerk-secret-key-dev:latest,SUPABASE_DATABASE_URL=database-url-dev:latest,CLERK_ISSUER=clerk-issuer-dev:latest,CLERK_AUDIENCE=clerk-audience-dev:latest,CLERK_AUTHORIZED_PARTIES=clerk-authorized-parties-dev:latest,CLERK_WEBHOOK_SECRET=clerk-webhook-secret-dev:latest,SECRET_KEY=app-secret-key-dev:latest" \
  --min-instances 0 \
  --max-instances 5 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300s \
  --port 8000

# Get development backend URL
export DEV_BACKEND_URL=$(gcloud run services describe hr-evaluation-backend-dev \
  --region $REGION \
  --format 'value(status.url)')

echo "✅ Development backend deployed!"
echo "Development Backend URL: $DEV_BACKEND_URL"
```

3. **Automated Deployment via GitHub Actions**

Create `.github/workflows/deploy-backend.yml`:

```yaml
name: Deploy Backend to Cloud Run

on:
  push:
    branches: [main, develop]
    paths: ['backend/**']

env:
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  REGION: ${{ secrets.GCP_REGION }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Google Cloud SDK
      uses: google-github-actions/setup-gcloud@v1
      with:
        service_account_key: ${{ secrets.GCP_SA_KEY }}
        project_id: ${{ secrets.GCP_PROJECT_ID }}
    
    - name: Configure Docker
      run: gcloud auth configure-docker
    
    - name: Set environment variables
      run: |
        if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
          echo "SERVICE_NAME=hr-evaluation-backend" >> $GITHUB_ENV
          echo "IMAGE_TAG=prod" >> $GITHUB_ENV
          echo "SECRETS_SUFFIX=" >> $GITHUB_ENV
          echo "ENV_MODE=production" >> $GITHUB_ENV
          echo "DEBUG_MODE=False" >> $GITHUB_ENV
        else
          echo "SERVICE_NAME=hr-evaluation-backend-dev" >> $GITHUB_ENV
          echo "IMAGE_TAG=dev" >> $GITHUB_ENV
          echo "SECRETS_SUFFIX=-dev" >> $GITHUB_ENV
          echo "ENV_MODE=development" >> $GITHUB_ENV
          echo "DEBUG_MODE=True" >> $GITHUB_ENV
        fi
    
    - name: Build Docker image
      run: |
        docker build -t gcr.io/$PROJECT_ID/$SERVICE_NAME:$IMAGE_TAG \
          -f backend/Dockerfile.prod ./backend
    
    - name: Push Docker image
      run: docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:$IMAGE_TAG
    
    - name: Deploy to Cloud Run
      run: |
        gcloud run deploy $SERVICE_NAME \
          --image gcr.io/$PROJECT_ID/$SERVICE_NAME:$IMAGE_TAG \
          --region $REGION \
          --platform managed \
          --allow-unauthenticated \
          --set-env-vars "ENVIRONMENT=$ENV_MODE,LOG_LEVEL=INFO,DEBUG=$DEBUG_MODE" \
          --set-secrets "CLERK_SECRET_KEY=clerk-secret-key$SECRETS_SUFFIX:latest,SUPABASE_DATABASE_URL=database-url$SECRETS_SUFFIX:latest,CLERK_ISSUER=clerk-issuer$SECRETS_SUFFIX:latest,CLERK_AUDIENCE=clerk-audience$SECRETS_SUFFIX:latest,CLERK_AUTHORIZED_PARTIES=clerk-authorized-parties$SECRETS_SUFFIX:latest,CLERK_WEBHOOK_SECRET=clerk-webhook-secret$SECRETS_SUFFIX:latest,SECRET_KEY=app-secret-key$SECRETS_SUFFIX:latest" \
          --min-instances 0 \
          --max-instances 10 \
          --memory 512Mi \
          --cpu 1 \
          --timeout 300s \
          --port 8000
```

4. **Setup GitHub Secrets**

Go to GitHub repository → Settings → Secrets and variables → Actions:

- `GCP_PROJECT_ID`: Your GCP project ID
- `GCP_SA_KEY`: Service account JSON key (create as shown below)
- `GCP_REGION`: Your deployment region (e.g., `asia-northeast1`)

**Create Service Account:**
```bash
# Create service account for GitHub Actions
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Deployment"

# Grant necessary permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Create and download JSON key
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions@$PROJECT_ID.iam.gserviceaccount.com

# Copy contents of github-actions-key.json to GCP_SA_KEY secret
```

5. **Deploy by Pushing to Branches**

```bash
# Deploy to production (main branch)
git checkout main
git add .
git commit -m "Deploy to production"
git push origin main

# Deploy to development (develop branch)
git checkout develop
git add .
git commit -m "Deploy to development"
git push origin develop
```

**Result:**
- `main` branch → `https://hr-evaluation-backend-xxx.run.app` (production)
- `develop` branch → `https://hr-evaluation-backend-dev-xxx.run.app` (development)

---

## Phase 3: Frontend Deployment (Vercel)

**Now that we have the backend URL**, we can deploy the frontend.

### [x] Step 3.1: Prepare for Vercel Deployment

```bash
# Optional: Install Vercel CLI for local testing
npm install -g vercel
vercel login  # Opens browser to login
```

### [x] Step 3.2: Deploy via Vercel Dashboard (Recommended for First Deploy)

**Follow these steps carefully:**

1. **Go to Vercel Dashboard**
   - Visit [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "Add New..." → "Project"

2. **Import Git Repository**
   - Click "Import Git Repository"
   - Select your GitHub organization
   - Find and select `evaluation-system` repository
   - Click "Import"

3. **Configure Build Settings**
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `frontend` ⚠️ **IMPORTANT** - Click "Edit" and enter `frontend`
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` (default)

4. **Set Environment Variables** ⚠️ **DO THIS BEFORE DEPLOYING**

   Click "Environment Variables" and add these **one by one**:

   | Name | Value | Source |
   |------|-------|--------|
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_xxxxx` | From Clerk (Step 1.2) |
   | `CLERK_SECRET_KEY` | `sk_live_xxxxx` | From Clerk (Step 1.2) |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | From Supabase (Step 1.1) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...` | From Supabase (Step 1.1) |
   | `NEXT_PUBLIC_API_BASE_URL` | `https://backend-xxx.run.app` | **From Step 2.3** ⚠️ |

   **For each variable:**
   - Set Environment: `Production`, `Preview`, and `Development` (check all three)
   - Click "Add"

5. **Deploy**
   - Click "Deploy" button
   - Wait 2-3 minutes for build to complete
   - ✅ You'll see "Congratulations!" when done

6. **Get Your Frontend URL**
   - Copy the production URL (e.g., `https://evaluation-system-xxxxx.vercel.app`)
   - **Save this URL** - you'll need it next!

### Step 3.3: Update Backend CORS Settings

Now that frontend is deployed, update backend to allow requests from Vercel:

```bash
# Update Cloud Run with frontend URL for CORS
gcloud run services update hr-evaluation-backend \
  --region $REGION \
  --update-env-vars "CORS_ORIGINS=https://your-app-name.vercel.app"

# Verify the update
gcloud run services describe hr-evaluation-backend \
  --region $REGION \
  --format='value(spec.template.spec.containers[0].env)'

echo "✅ Backend CORS updated to allow frontend requests!"
```

### Step 3.4: Configure Multi-Environment Frontend

**Vercel automatically creates preview deployments for every branch and PR.** Here's how to configure them to use the correct backend:

1. **Set Environment Variables by Environment**

In Vercel Dashboard → Project → Settings → Environment Variables:

**Production Environment** (main branch):
| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://hr-evaluation-backend-xxx.run.app` | Production |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_xxxxx` | Production |
| `CLERK_SECRET_KEY` | `sk_live_xxxxx` | Production |

**Preview Environment** (develop branch & PRs):
| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://hr-evaluation-backend-dev-xxx.run.app` | Preview |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_xxxxx` | Preview |
| `CLERK_SECRET_KEY` | `sk_test_xxxxx` | Preview |

**Development Environment** (local):
| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | Development |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_xxxxx` | Development |
| `CLERK_SECRET_KEY` | `sk_test_xxxxx` | Development |

2. **How Vercel Preview Deployments Work**

```bash
# When you push to develop branch:
git checkout develop
git push origin develop

# Vercel automatically:
# 1. Creates preview deployment: https://your-app-git-develop-username.vercel.app
# 2. Uses "Preview" environment variables
# 3. Connects to development backend: https://hr-evaluation-backend-dev-xxx.run.app
```

3. **Test Multi-Environment Setup**

```bash
# Test production (main branch)
open https://your-app.vercel.app

# Test development (develop branch preview)
open https://your-app-git-develop-username.vercel.app

# Both should work but connect to different backends
```

### [x] Step 3.5: Update Backend CORS for Multiple Environments

```bash
# Update production backend CORS
gcloud run services update hr-evaluation-backend \
  --region $REGION \
  --update-env-vars "CORS_ORIGINS=https://your-app.vercel.app"

# Update development backend CORS
gcloud run services update hr-evaluation-backend-dev \
  --region $REGION \
  --update-env-vars "CORS_ORIGINS=https://your-app-git-develop-username.vercel.app,http://localhost:3000"

echo "✅ CORS updated for both environments!"
```

### Step 3.6: Test Frontend Deployments

```bash
# Test production deployment
open https://your-app.vercel.app

# Test development preview
open https://your-app-git-develop-username.vercel.app

# Test authentication on both (should see Clerk login page)
```

**Expected behavior:**
- ✅ Production: Connects to production backend and Clerk
- ✅ Preview: Connects to development backend and Clerk (test mode)
- ✅ No CORS errors in browser console (F12 → Console)
- ✅ Different data/users in each environment

---

## Multi-Environment Management

### Environment Overview

After following the multi-environment setup, you'll have:

| Environment | Frontend URL | Backend URL | Database | Clerk |
|-------------|--------------|-------------|----------|-------|
| **Production** | `https://your-app.vercel.app` | `https://hr-evaluation-backend-xxx.run.app` | Supabase Prod | Clerk Live |
| **Development** | `https://your-app-git-develop-username.vercel.app` | `https://hr-evaluation-backend-dev-xxx.run.app` | Supabase Dev | Clerk Test |
| **Local** | `http://localhost:3000` | `http://localhost:8000` | Local/Supabase Dev | Clerk Test |

### Branch-Based Deployment Flow

```bash
# Development workflow
git checkout develop
# Make changes
git add .
git commit -m "Add new feature"
git push origin develop
# → Triggers: Vercel preview + Cloud Run dev deployment

# Production deployment
git checkout main
git merge develop
git push origin main
# → Triggers: Vercel production + Cloud Run prod deployment
```

### Environment Variable Management

**Pro Tip**: Use a `.env.template` file to track all required variables:

```bash
# Create environment template
cat > .env.template << 'EOF'
# Frontend Environment Variables
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Backend Environment Variables (Cloud Run Secrets)
CLERK_SECRET_KEY=
SUPABASE_DATABASE_URL=
CLERK_ISSUER=
CLERK_AUDIENCE=
CLERK_WEBHOOK_SECRET=
SECRET_KEY=
EOF
```

### Quick Environment Switching Commands

```bash
# Check current deployments
echo "Production Backend:"
gcloud run services describe hr-evaluation-backend --region $REGION --format='value(status.url)'

echo "Development Backend:"
gcloud run services describe hr-evaluation-backend-dev --region $REGION --format='value(status.url)'

# Check logs for specific environment
alias prod-logs='gcloud run logs read hr-evaluation-backend --region $REGION --limit 50'
alias dev-logs='gcloud run logs read hr-evaluation-backend-dev --region $REGION --limit 50'

# Quick health checks
alias prod-health='curl $(gcloud run services describe hr-evaluation-backend --region $REGION --format="value(status.url)")/health'
alias dev-health='curl $(gcloud run services describe hr-evaluation-backend-dev --region $REGION --format="value(status.url)")/health'
```

### Database Environment Separation

**Option 1: Separate Supabase Projects (Recommended)**
```bash
# Production database
Project: hr-evaluation-prod
URL: https://xxx.supabase.co

# Development database  
Project: hr-evaluation-dev
URL: https://yyy.supabase.co
```

**Option 2: Same Project, Different Schemas**
```sql
-- In same Supabase project, use schemas
CREATE SCHEMA production;
CREATE SCHEMA development;

-- Update connection strings
-- Prod: postgresql://...?options=-c%20search_path%3Dproduction
-- Dev:  postgresql://...?options=-c%20search_path%3Ddevelopment
```

---

## Phase 4: Post-Deployment Configuration

### Step 4.1: Configure Clerk Production Settings

**Now that both frontend and backend are deployed**, complete Clerk configuration:

1. **Add Production Domains to Clerk**
   - Go to [Clerk Dashboard](https://dashboard.clerk.com/)
   - Select your production application
   - Navigate to "Domains" (or "Settings" → "Domains")
   - Add your Vercel domain:
     - Click "Add domain"
     - Enter: `evaluation-system-xxxxx.vercel.app` (your Vercel URL)
     - Click "Add"

2. **Configure Allowed Origins** (for CORS)
   - Still in Clerk Dashboard → "API Keys" or "Advanced"
   - Find "Allowed origins" section
   - Add both:
     - `https://your-app.vercel.app` (frontend)
     - `https://backend-xxxxx.run.app` (backend)

### Step 4.2: Set Up Clerk Webhooks

**Webhooks sync user data from Clerk to your database.**

1. **Create Webhook in Clerk**
   - In Clerk Dashboard → "Webhooks"
   - Click "Add Endpoint"
   - Fill in:
     - **Endpoint URL**: `https://backend-xxxxx.run.app/api/v1/webhooks/clerk`
     - **Events to listen for**: Select these events:
       - ✅ `user.created`
       - ✅ `user.updated`
       - ✅ `user.deleted`
       - ✅ `organization.created` (if using organizations)
       - ✅ `organization.updated` (if using organizations)
       - ✅ `organizationMembership.created` (if using organizations)
       - ✅ `organizationMembership.deleted` (if using organizations)
   - Click "Create"

2. **Get Webhook Signing Secret**
   - After creating webhook, click on it
   - Find "Signing Secret" (starts with `whsec_`)
   - Click "Reveal" and copy the secret

3. **Update Backend with Webhook Secret**
   ```bash
   # Update the webhook secret in GCP Secret Manager
   echo -n "whsec_YOUR_WEBHOOK_SECRET" | gcloud secrets versions add clerk-webhook-secret --data-file=-

   # Restart Cloud Run to pick up new secret
   gcloud run services update hr-evaluation-backend \
     --region $REGION \
     --no-traffic  # Don't change traffic, just trigger update

   echo "✅ Webhook secret updated!"
   ```

4. **Test Webhook**
   - In Clerk Webhook page, click "Send test event"
   - Check backend logs:
     ```bash
     gcloud run logs read hr-evaluation-backend --region $REGION --limit 20
     ```
   - Look for "Webhook received" log entry

### Step 4.3: Update Clerk Redirect URLs (Important for Sign-in Flow)

1. **In Clerk Dashboard → "Paths"**
   - Set redirect URLs:
     - **Sign-in redirect**: `https://your-app.vercel.app/dashboard` (or your post-login page)
     - **Sign-up redirect**: `https://your-app.vercel.app/dashboard`
     - **Sign-out redirect**: `https://your-app.vercel.app/`

2. **Save changes**

---

## Development Environment

### Overview

After completing the production deployment, you can set up a complete development environment that mirrors production. This allows you to safely test changes before deploying to production.

**Development Environment Includes:**
- 🔧 Local development (Docker Compose)
- ☁️ Cloud Run development instance (`hr-evaluation-backend-dev`)
- 🌐 Vercel preview deployments for all non-main branches

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Local Development                                           │
│  ├─ Docker Compose (localhost:3000, localhost:8000)         │
│  └─ ENVIRONMENT=development                                  │
│                                                               │
│  ↓ Push to develop branch                                    │
│                                                               │
│  Cloud Development                                           │
│  ├─ Vercel Preview + Cloud Run Dev                          │
│  └─ ENVIRONMENT=production (with test Clerk/Supabase)       │
│                                                               │
│  ↓ Merge to main                                             │
│                                                               │
│  Production                                                  │
│  ├─ Vercel Production + Cloud Run Prod                      │
│  └─ ENVIRONMENT=production (with live Clerk/Supabase)       │
└─────────────────────────────────────────────────────────────┘
```

### Quick Setup

The development environment is **automatically configured** via GitHub Actions:

1. **Push to `develop` branch** → Triggers:
   - Backend: Deploys to `hr-evaluation-backend-dev` on Cloud Run
   - Frontend: Creates Vercel preview deployment

2. **GitHub Actions Workflow** automatically:
   - Builds separate Docker image for dev
   - Deploys to separate Cloud Run service
   - Uses development-specific secrets (with `-dev` suffix)
   - Configures lower resource limits (3 max instances vs 5)

### Prerequisites

Before first development deployment:

1. **Create GCP Development Secrets** (one-time setup):
   ```bash
   # See detailed instructions in development-environment-setup.md
   # You need to create -dev versions of all secrets:
   # - clerk-secret-key-dev
   # - database-url-dev
   # - clerk-issuer-dev
   # - clerk-audience-dev
   # - clerk-webhook-secret-dev
   # - app-secret-key-dev
   ```

2. **Configure Vercel Preview Environment** (one-time setup):
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Add preview environment variables pointing to dev backend
   - See [Development Environment Setup Guide](./development-environment-setup.md) for details

### Deployment Workflow

```bash
# 1. Create/switch to develop branch
git checkout develop

# 2. Make your changes
# ... edit code ...

# 3. Commit and push (triggers auto-deployment)
git add .
git commit -m "feat: add new feature"
git push origin develop

# 4. Monitor deployments:
# - GitHub Actions: https://github.com/your-org/repo/actions
# - Vercel: https://vercel.com/dashboard

# 5. Test on preview URL
# Get URL from Vercel dashboard or GitHub PR

# 6. After testing, create PR to main for production deployment
gh pr create --title "feat: add new feature" --base main
```

### Environment Differences

| Aspect | Local Dev | Cloud Dev | Production |
|--------|-----------|-----------|------------|
| **Frontend** | localhost:3000 | Vercel Preview | Vercel Production |
| **Backend** | localhost:8000 | Cloud Run Dev | Cloud Run Prod |
| **ENVIRONMENT** | `development` | `production` | `production` |
| **Clerk Mode** | Test keys | Test keys | Live keys |
| **Database** | Dev Supabase | Dev Supabase | Prod Supabase |
| **Trigger** | Manual | Push to develop | Push to main |
| **Auto-deploy** | No | Yes | Yes |

> **Important:** Both Cloud Run instances use `ENVIRONMENT=production` - they differ only in the secrets/credentials used (test vs live).

### Cost Optimization

Both Cloud Run instances scale to zero when idle:
- **Production**: 0-5 instances, ~$10-30/month
- **Development**: 0-3 instances, ~$5-15/month

To completely stop development instance when not in use:
```bash
gcloud run services update hr-evaluation-backend-dev \
  --region $REGION \
  --no-traffic
```

### Complete Setup Guide

For detailed step-by-step instructions including:
- GCP secrets creation commands
- Vercel environment variable configuration
- CORS setup
- Troubleshooting
- Monitoring and logs

**See: [Development Environment Setup Guide](./development-environment-setup.md)**

---

## Verification & Testing

### Quick Health Checks

Run these commands to verify everything is working:

```bash
# 1. Test backend health
curl https://backend-xxxxx.run.app/health
# Expected: {"status":"healthy"}

# 2. Test backend API docs (optional)
open https://backend-xxxxx.run.app/docs

# 3. Test frontend
open https://your-app.vercel.app

# 4. Check backend logs
gcloud run logs read hr-evaluation-backend --region $REGION --limit 50

# 5. Check Vercel logs
vercel logs your-app.vercel.app  # or check in Vercel dashboard
```

### Full Application Test

1. **Test Authentication**
   - Open `https://your-app.vercel.app`
   - Click "Sign In"
   - Create a test account or sign in
   - Verify:
     - ✅ Redirected to dashboard after login
     - ✅ No console errors (F12 → Console)
     - ✅ User appears in Clerk Dashboard → Users

2. **Test Database Integration**
   - After signing in, check Supabase:
     - Go to Supabase Dashboard → Table Editor
     - Find `users` table
     - ✅ Your test user should appear (via webhook)

3. **Test API Calls**
   - Navigate through the app
   - Open browser DevTools (F12) → Network tab
   - Look for API calls to backend:
     - ✅ Requests go to `https://backend-xxxxx.run.app`
     - ✅ Response status 200 (or expected status)
     - ✅ No CORS errors

### Common Issues and Quick Fixes

**Issue**: CORS errors in browser
```bash
# Fix: Update CORS origins
gcloud run services update hr-evaluation-backend \
  --region $REGION \
  --update-env-vars "CORS_ORIGINS=https://your-app.vercel.app"
```

**Issue**: 401 Unauthorized on API calls
- Check Clerk keys match in both frontend and backend
- Verify JWT issuer, audience and authorized parties in backend secrets

**Issue**: Webhook not working
```bash
# Check webhook secret is correct
gcloud secrets versions access latest --secret=clerk-webhook-secret

# Update if needed
echo -n "whsec_correct_secret" | gcloud secrets versions add clerk-webhook-secret --data-file=-

# Force redeploy
gcloud run services update hr-evaluation-backend --region $REGION --no-traffic
```

**Issue**: Database connection errors
- Check database URL secret
- Verify Supabase allows connections from Cloud Run IP range
- Check connection pooling is enabled in database URL

---

## Environment Variables Setup

### Backend Environment Variables (Cloud Run)

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `ENVIRONMENT` | Yes | `production` | Application environment |
| `FRONTEND_URL` | Yes | `https://your-app.vercel.app` | Frontend URL for CORS |
| `CLERK_SECRET_KEY` | Yes | `sk_live_...` | Clerk secret key (Secret Manager) |
| `SUPABASE_DATABASE_URL` | Yes | `postgresql://...` | Database connection string (Secret Manager) |
| `CLERK_ISSUER` | Yes | `https://clerk.your-app.com` | Clerk JWT issuer |
| `CLERK_AUDIENCE` | Yes (if used) | `your-audience` | Clerk JWT audience |
| `CLERK_AUTHORIZED_PARTIES` | Yes | `your-app.vercel.app` | Comma-separated list of allowed `azp` (Authorized Party) origins |
| `CLERK_WEBHOOK_SECRET` | Yes | `whsec_...` | Clerk webhook secret |
| `LOG_LEVEL` | No | `INFO` | Logging level |
| `DEBUG` | No | `false` | Debug mode (should be false) |

### Frontend Environment Variables (Vercel)

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | `https://backend-xxx.run.app` | Backend API URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | `pk_live_...` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Yes | `sk_live_...` | Clerk secret key |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | `https://xxx.supabase.co` | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | `eyJhbGci...` | Supabase anon key |
| `NEXT_PUBLIC_ENABLE_REQUEST_LOGGING` | No | `false` | Enable request logging |

---

## Post-Deployment Steps

### 1. Update Clerk Settings

- Add your Vercel domain to allowed origins
- Update webhook URL to Cloud Run backend
- Test authentication flow

### 2. Test Deployment

```bash
# Test backend health
curl https://hr-evaluation-backend-xxx.run.app/health

# Test frontend
open https://your-app.vercel.app

# Check logs
gcloud run logs read hr-evaluation-backend --region us-central1 --limit 50
```

### 3. Set Up Custom Domain (Optional)

#### For Backend (Cloud Run)
```bash
gcloud run domain-mappings create \
  --service hr-evaluation-backend \
  --domain api.yourdomain.com \
  --region us-central1
```

#### For Frontend (Vercel)
- Go to Vercel project settings → Domains
- Add your custom domain
- Update DNS records as instructed

### 4. Enable Monitoring

- Set up Google Cloud Monitoring alerts
- Configure Vercel analytics
- Enable error tracking (Sentry, if configured)

### 5. Database Backup

```bash
# Set up automated backups in Supabase dashboard
# Enable Point-in-Time Recovery (PITR)
```

---

## Troubleshooting

### Backend Issues

**Problem**: Service won't start
```bash
# Check logs
gcloud run logs read hr-evaluation-backend --region us-central1 --limit 100

# Check environment variables
gcloud run services describe hr-evaluation-backend --region us-central1 --format=yaml
```

**Problem**: Database connection errors
- Verify `SUPABASE_DATABASE_URL` is correct
- Check Supabase firewall settings
- Ensure Cloud Run has internet access

**Problem**: CORS errors
- Verify `FRONTEND_URL` matches Vercel deployment
- Check `CORS_ORIGINS` in backend logs
- Ensure frontend sends correct `Origin` header

### Frontend Issues

**Problem**: API calls failing
- Check `NEXT_PUBLIC_API_BASE_URL` is set correctly
- Verify backend is accessible (CORS configured)
- Check browser console for errors

**Problem**: Authentication errors
- Verify Clerk keys match between frontend and backend
- Check Clerk dashboard for allowed domains
- Ensure webhook URL is correct

**Problem**: Build failures
- Check build logs in Vercel dashboard
- Verify all environment variables are set
- Test build locally: `npm run build`

---

## Rollback Procedures

### Backend Rollback

```bash
# List previous revisions
gcloud run revisions list --service hr-evaluation-backend --region us-central1

# Route all traffic to previous revision
gcloud run services update-traffic hr-evaluation-backend \
  --to-revisions REVISION_NAME=100 \
  --region us-central1
```

### Frontend Rollback

1. Go to Vercel dashboard
2. Navigate to Deployments
3. Find previous successful deployment
4. Click "Promote to Production"

### Database Rollback

```bash
# Use Supabase point-in-time recovery
# Or restore from backup in Supabase dashboard
```

---

## 📋 Complete Deployment Checklist

Use this checklist to ensure you've completed all steps correctly.

### Phase 1: Preparation ✅

- [ ] Created Supabase production database
- [ ] Copied Supabase connection URL (pooler URL) and API keys
- [ ] Created Clerk production application
- [ ] Copied Clerk publishable key and secret key
- [ ] Noted Clerk JWT issuer, audience (if used), and authorized parties (`azp`)
- [ ] Created `.env.prod` file with all variables documented

### Phase 2: Backend Deployment ✅

- [ ] Installed and configured Google Cloud SDK (`gcloud`)
- [ ] Created GCP project and enabled billing
- [ ] Enabled required APIs (Cloud Run, Container Registry, Cloud Build, Secret Manager)
- [ ] Created all secrets in Secret Manager:
  - [ ] `clerk-secret-key`
  - [ ] `database-url`
  - [ ] `clerk-issuer`
  - [ ] `clerk-audience`
  - [ ] `clerk-authorized-parties`
  - [ ] `clerk-webhook-secret` (placeholder)
  - [ ] `app-secret-key`
- [ ] Granted Cloud Run access to secrets
- [ ] Built Docker image using `backend/Dockerfile.prod`
- [ ] Pushed image to Google Container Registry
- [ ] Deployed backend to Cloud Run
- [ ] Tested backend health endpoint (`/health`)
- [ ] Saved backend URL for frontend deployment

### Phase 3: Frontend Deployment ✅

- [ ] Created Vercel account
- [ ] Imported GitHub repository to Vercel
- [ ] Set root directory to `frontend`
- [ ] Added all environment variables in Vercel:
  - [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - [ ] `CLERK_SECRET_KEY`
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `NEXT_PUBLIC_API_BASE_URL` (backend URL)
- [ ] Deployed frontend successfully
- [ ] Saved Vercel deployment URL
- [ ] Updated backend CORS with Vercel URL

### Phase 4: Post-Deployment Configuration ✅

- [ ] Added Vercel domain to Clerk allowed domains
- [ ] Added frontend and backend URLs to Clerk allowed origins
- [ ] Created Clerk webhook pointing to backend
- [ ] Selected webhook events (user.created, user.updated, etc.)
- [ ] Updated `clerk-webhook-secret` in GCP Secret Manager
- [ ] Redeployed backend to pick up webhook secret
- [ ] Tested webhook with test event
- [ ] Set Clerk redirect URLs (sign-in, sign-up, sign-out)

### Verification & Testing ✅

- [ ] Backend health check passes
- [ ] Backend API docs accessible (`/docs`)
- [ ] Frontend loads without errors
- [ ] Sign-in/sign-up flow works
- [ ] User created in Clerk appears in database (via webhook)
- [ ] No CORS errors in browser console
- [ ] API calls from frontend to backend succeed
- [ ] Backend logs show no errors
- [ ] Vercel deployment logs show no errors

### Optional: Production Enhancements 🚀

- [ ] Set up custom domain for backend (Cloud Run)
- [ ] Set up custom domain for frontend (Vercel)
- [ ] Configure Google Cloud Monitoring alerts
- [ ] Enable Vercel Analytics
- [ ] Set up error tracking (Sentry)
- [ ] Configure automated backups for Supabase
- [ ] Enable Point-in-Time Recovery (PITR) on Supabase
- [ ] Set up CI/CD pipeline (GitHub Actions or Cloud Build triggers)
- [ ] Document deployment process for team
- [ ] Create runbook for common issues

---

## Monitoring & Maintenance

### Multi-Environment Monitoring Setup

1. **Google Cloud Monitoring Alerts**

```bash
# Create alerting policy for production
gcloud alpha monitoring policies create --policy-from-file=- <<EOF
{
  "displayName": "HR Evaluation Backend - Production Health",
  "conditions": [
    {
      "displayName": "Cloud Run service is down",
      "conditionThreshold": {
        "filter": "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"hr-evaluation-backend\"",
        "comparison": "COMPARISON_LESS_THAN",
        "thresholdValue": 1,
        "duration": "300s"
      }
    }
  ],
  "alertStrategy": {
    "autoClose": "1800s"
  },
  "enabled": true
}
EOF

# Create similar alert for development
# Replace "hr-evaluation-backend" with "hr-evaluation-backend-dev"
```

2. **Vercel Analytics & Monitoring**

```bash
# Enable Vercel Analytics (in Vercel dashboard)
# Go to Project → Analytics → Enable

# Set up Vercel monitoring webhooks
# Project → Settings → Git → Deploy Hooks
```

3. **Health Check Endpoints**

Add to your monitoring system:
```bash
# Production health checks
curl https://hr-evaluation-backend-xxx.run.app/health
curl https://your-app.vercel.app/api/health

# Development health checks  
curl https://hr-evaluation-backend-dev-xxx.run.app/health
curl https://your-app-git-develop-username.vercel.app/api/health
```

### Cost Monitoring

**Google Cloud Run Costs:**
```bash
# Check current month costs
gcloud billing budgets list --billing-account=BILLING_ACCOUNT_ID

# Set up budget alerts
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="HR Evaluation Monthly Budget" \
  --budget-amount=50USD \
  --threshold-rules-percent=50,90,100
```

**Vercel Usage:**
- Check dashboard for bandwidth and function invocations
- Free tier: 100GB bandwidth, 100GB-hours serverless functions

**Supabase Usage:**
- Free tier: 500MB database, 2GB bandwidth
- Monitor in Supabase dashboard → Settings → Usage

### Backup & Recovery Strategy

1. **Database Backups**

```bash
# Supabase automatic backups (Pro plan)
# Or manual backup via pg_dump

# For development database
pg_dump "postgresql://postgres.[DEV-REF]:[PASSWORD]@db.[DEV-REF].supabase.co:5432/postgres" > backup-dev-$(date +%Y%m%d).sql

# For production database  
pg_dump "postgresql://postgres.[PROD-REF]:[PASSWORD]@db.[PROD-REF].supabase.co:5432/postgres" > backup-prod-$(date +%Y%m%d).sql
```

2. **Code & Configuration Backups**

```bash
# Environment variables backup
echo "# Production Environment Variables - $(date)" > env-backup-prod.txt
gcloud secrets list --format="table(name)" >> env-backup-prod.txt

echo "# Development Environment Variables - $(date)" > env-backup-dev.txt  
gcloud secrets list --filter="name:*-dev" --format="table(name)" >> env-backup-dev.txt

# Store in secure location (not in git!)
```

### Deployment Rollback Procedures

**Backend Rollback (Cloud Run):**
```bash
# List recent revisions
gcloud run revisions list --service hr-evaluation-backend --region $REGION

# Rollback production to previous revision
gcloud run services update-traffic hr-evaluation-backend \
  --to-revisions PREVIOUS_REVISION=100 \
  --region $REGION

# Rollback development  
gcloud run services update-traffic hr-evaluation-backend-dev \
  --to-revisions PREVIOUS_REVISION=100 \
  --region $REGION
```

**Frontend Rollback (Vercel):**
```bash
# Via Vercel CLI
vercel rollback https://your-app.vercel.app

# Or via dashboard: Deployments → Previous deployment → Promote to Production
```

**Database Rollback:**
```bash
# Restore from backup
psql "postgresql://..." < backup-prod-20241007.sql

# Or use Supabase Point-in-Time Recovery (Pro plan)
```

### Environment Synchronization

**Sync development with production data (sanitized):**
```bash
# 1. Export production schema (structure only)
pg_dump --schema-only "postgresql://prod-connection" > schema.sql

# 2. Apply to development
psql "postgresql://dev-connection" < schema.sql

# 3. Sync sanitized data (remove PII)
# Use custom script to copy non-sensitive data
```

**Sync environment variables:**
```bash
# Script to sync non-secret environment variables
# (Never sync secrets between environments!)

# List production env vars
gcloud run services describe hr-evaluation-backend \
  --region $REGION \
  --format='value(spec.template.spec.containers[0].env[].name)'

# Apply same structure to development (with dev values)
```

---

## 🆘 Troubleshooting Guide

### Issue: Build fails on Vercel

**Symptoms**: Vercel build fails with "Missing required environment variables"

**Solution**:
```bash
# Ensure all NEXT_PUBLIC_* variables are set BEFORE deploying
# Check Vercel project → Settings → Environment Variables
# All variables must be set for: Production, Preview, Development
```

### Issue: 500 Internal Server Error on backend

**Symptoms**: API calls return 500 errors

**Solution**:
```bash
# Check backend logs for detailed error
gcloud run logs read hr-evaluation-backend --region $REGION --limit 100

# Common causes:
# - Database connection string incorrect
# - Missing environment variables
# - Clerk JWT configuration mismatch
```

### Issue: CORS errors in browser

**Symptoms**: "Access-Control-Allow-Origin" errors in console

**Solution**:
```bash
# Update CORS origins in Cloud Run
gcloud run services update hr-evaluation-backend \
  --region $REGION \
  --update-env-vars "CORS_ORIGINS=https://your-exact-vercel-url.vercel.app"

# Make sure URL matches EXACTLY (no trailing slash)
```

### Issue: Authentication fails (401 Unauthorized)

**Symptoms**: "Unauthorized" errors when accessing protected routes

**Solution**:
1. Verify Clerk keys match in frontend and backend
2. Check JWT issuer/audience/authorized parties in backend:
   ```bash
   gcloud secrets versions access latest --secret=clerk-issuer
   gcloud secrets versions access latest --secret=clerk-audience
   gcloud secrets versions access latest --secret=clerk-authorized-parties
   ```
3. Ensure Clerk domains include your Vercel URL

### Issue: Webhooks not syncing users to database

**Symptoms**: Users created in Clerk don't appear in database

**Solution**:
```bash
# 1. Verify webhook URL is correct
# Production: https://backend-xxx.run.app/api/v1/webhooks/clerk
# Development: https://backend-dev-xxx.run.app/api/v1/webhooks/clerk

# 2. Check webhook secret matches environment
gcloud secrets versions access latest --secret=clerk-webhook-secret        # Production
gcloud secrets versions access latest --secret=clerk-webhook-secret-dev    # Development

# 3. Test webhook in Clerk dashboard
# 4. Check backend logs for webhook events
gcloud run logs read hr-evaluation-backend --region $REGION --limit 50 | grep webhook     # Production
gcloud run logs read hr-evaluation-backend-dev --region $REGION --limit 50 | grep webhook # Development
```

### Issue: Wrong backend URL in preview deployments

**Symptoms**: Vercel preview deployments calling production backend instead of development

**Solution**:
```bash
# 1. Check Vercel environment variables
# Go to Vercel Dashboard → Project → Settings → Environment Variables
# Ensure "Preview" environment has development backend URL

# 2. Verify branch-specific deployment
# Preview deployments should use: https://hr-evaluation-backend-dev-xxx.run.app
# Production deployments should use: https://hr-evaluation-backend-xxx.run.app

# 3. Force redeploy preview
git checkout develop
git commit --allow-empty -m "Force redeploy preview"
git push origin develop
```

### Issue: Environment variable conflicts

**Symptoms**: Development environment using production secrets or vice versa

**Solution**:
```bash
# 1. List all secrets to identify conflicts
gcloud secrets list --format="table(name)" | grep -E "(clerk|database|webhook)"

# 2. Verify secret naming convention
# Production secrets: clerk-secret-key, database-url, etc.
# Development secrets: clerk-secret-key-dev, database-url-dev, etc.

# 3. Check Cloud Run service configurations
gcloud run services describe hr-evaluation-backend --region $REGION --format=yaml | grep -A 20 secrets
gcloud run services describe hr-evaluation-backend-dev --region $REGION --format=yaml | grep -A 20 secrets

# 4. Update if needed
gcloud run services update hr-evaluation-backend-dev \
  --region $REGION \
  --set-secrets "CLERK_SECRET_KEY=clerk-secret-key-dev:latest"
```

### Issue: Database connection mixing between environments

**Symptoms**: Development backend connecting to production database

**Solution**:
```bash
# 1. Verify database URLs in secrets
echo "Production DB:"
gcloud secrets versions access latest --secret=database-url

echo "Development DB:"  
gcloud secrets versions access latest --secret=database-url-dev

# 2. Check they point to different databases
# Production should have different PROJECT_REF than development

# 3. Update development database URL if needed
echo -n "postgresql://postgres.[DEV-REF]:[DEV-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true" | \
  gcloud secrets versions add database-url-dev --data-file=-

# 4. Redeploy development backend
gcloud run services update hr-evaluation-backend-dev --region $REGION --no-traffic
```

### Issue: Clerk authentication failing in specific environment

**Symptoms**: Login works in production but fails in development (or vice versa)

**Solution**:
```bash
# 1. Check Clerk application configuration
# Production app should use pk_live_* and sk_live_* keys
# Development app should use pk_test_* and sk_test_* keys

# 2. Verify Clerk domains are configured correctly
# Production Clerk app → Domains: your-app.vercel.app
# Development Clerk app → Domains: your-app-git-develop-username.vercel.app

# 3. Check JWT issuer/audience/authorized parties match
echo "Production Clerk Issuer:"
gcloud secrets versions access latest --secret=clerk-issuer

echo "Development Clerk Issuer:"
gcloud secrets versions access latest --secret=clerk-issuer-dev

# 4. Update if they're pointing to wrong Clerk application
```

### Issue: CORS errors in specific environment

**Symptoms**: CORS works in production but fails in development previews

**Solution**:
```bash
# 1. Check CORS configuration for both backends
gcloud run services describe hr-evaluation-backend --region $REGION --format='value(spec.template.spec.containers[0].env)' | grep CORS
gcloud run services describe hr-evaluation-backend-dev --region $REGION --format='value(spec.template.spec.containers[0].env)' | grep CORS

# 2. Update CORS for development backend to include preview URLs
gcloud run services update hr-evaluation-backend-dev \
  --region $REGION \
  --update-env-vars "CORS_ORIGINS=https://your-app-git-develop-username.vercel.app,https://your-app-git-feature-branch-username.vercel.app,http://localhost:3000"

# 3. For wildcard preview URLs (if you have many branches)
gcloud run services update hr-evaluation-backend-dev \
  --region $REGION \
  --update-env-vars "CORS_ORIGINS=https://your-app-git-*.vercel.app,http://localhost:3000"
```

---

## 📚 Support & Resources

### Official Documentation
- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Clerk Documentation](https://clerk.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [FastAPI Deployment Guide](https://fastapi.tiangolo.com/deployment/)

### Project-Specific Files
- [`.env.prod`](../.env.prod) - Production environment variables template
- [`backend/Dockerfile.prod`](../backend/Dockerfile.prod) - Production Docker configuration
- [`cloudbuild.yaml`](../cloudbuild.yaml) - Cloud Build configuration for CI/CD
- [`CLAUDE.md`](../CLAUDE.md) - Project structure and conventions

### Getting Help
- **For deployment issues**: Check this troubleshooting guide first
- **For code issues**: See project documentation in `/docs`
- **For bugs**: Create an issue in the GitHub repository
- **For questions**: Contact the development team

---

## 🎉 Congratulations!

You've successfully deployed the HR Evaluation System to production!

**Your deployment URLs:**
- 🌐 Frontend: `https://your-app.vercel.app`
- 🔧 Backend: `https://backend-xxx.run.app`
- 📊 Backend API Docs: `https://backend-xxx.run.app/docs`

**Next Steps:**
1. Share deployment URLs with your team
2. Set up monitoring and alerts
3. Configure custom domains (optional)
4. Set up CI/CD for automated deployments
5. Monitor logs and performance

**Cost Monitoring:**
- Vercel: Check dashboard for usage
- GCP: [Console → Billing](https://console.cloud.google.com/billing)
- Supabase: Check dashboard for database usage

---

## 🔧 Quick Reference: Multi-Environment Commands

### Environment Status Check
```bash
# Check all deployments
echo "=== PRODUCTION ==="
echo "Backend: $(gcloud run services describe hr-evaluation-backend --region $REGION --format='value(status.url)')"
echo "Frontend: https://your-app.vercel.app"
curl -s $(gcloud run services describe hr-evaluation-backend --region $REGION --format='value(status.url)')/health

echo "=== DEVELOPMENT ==="  
echo "Backend: $(gcloud run services describe hr-evaluation-backend-dev --region $REGION --format='value(status.url)')"
echo "Frontend: https://your-app-git-develop-username.vercel.app"
curl -s $(gcloud run services describe hr-evaluation-backend-dev --region $REGION --format='value(status.url)')/health
```

### Quick Deployment Commands
```bash
# Deploy to development
git checkout develop
git add . && git commit -m "Deploy to dev" && git push origin develop

# Deploy to production  
git checkout main
git merge develop && git push origin main

# Emergency rollback production
gcloud run revisions list --service hr-evaluation-backend --region $REGION --limit 5
gcloud run services update-traffic hr-evaluation-backend --to-revisions PREVIOUS_REVISION=100 --region $REGION
```

### Environment Variable Quick Update
```bash
# Update development backend environment
gcloud run services update hr-evaluation-backend-dev \
  --region $REGION \
  --update-env-vars "NEW_VAR=value"

# Update production backend environment
gcloud run services update hr-evaluation-backend \
  --region $REGION \
  --update-env-vars "NEW_VAR=value"
```

### Logs & Debugging
```bash
# Production logs
gcloud run logs read hr-evaluation-backend --region $REGION --limit 50

# Development logs
gcloud run logs read hr-evaluation-backend-dev --region $REGION --limit 50

# Follow logs in real-time
gcloud run logs tail hr-evaluation-backend --region $REGION
gcloud run logs tail hr-evaluation-backend-dev --region $REGION
```

---

## 📋 Multi-Environment Deployment Checklist

### Initial Setup ✅
- [ ] Created separate Supabase projects (prod + dev)
- [ ] Created separate Clerk applications (live + test)
- [ ] Set up GCP secrets with `-dev` suffix for development
- [ ] Configured GitHub Actions for branch-based deployment
- [ ] Set up Vercel environment variables by environment type

### Production Environment ✅
- [ ] `main` branch deploys to `hr-evaluation-backend`
- [ ] Uses production secrets (no `-dev` suffix)
- [ ] Vercel production uses `pk_live_*` Clerk keys
- [ ] CORS allows production Vercel domain
- [ ] Webhooks point to production backend
- [ ] Database is production Supabase project

### Development Environment ✅  
- [ ] `develop` branch deploys to `hr-evaluation-backend-dev`
- [ ] Uses development secrets (with `-dev` suffix)
- [ ] Vercel preview uses `pk_test_*` Clerk keys
- [ ] CORS allows preview domains and localhost
- [ ] Webhooks point to development backend
- [ ] Database is development Supabase project

### Verification ✅
- [ ] Both environments health checks pass
- [ ] Authentication works in both environments
- [ ] Data is isolated between environments
- [ ] Preview deployments use development backend
- [ ] Production deployments use production backend
- [ ] No cross-environment data leakage

Happy deploying! 🚀

---

## 💡 Pro Tips for Multi-Environment Management

1. **Use descriptive branch names**: `feature/user-management`, `hotfix/auth-bug`
2. **Test in development first**: Always test features in development before merging to main
3. **Monitor costs**: Development environment can auto-scale down to 0 instances
4. **Use feature flags**: Toggle features without redeployment
5. **Automate testing**: Set up automated tests that run on both environments
6. **Document environment differences**: Keep a changelog of environment-specific configurations
