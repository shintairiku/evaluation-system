# 🚀 HR Evaluation System - Complete Deployment Guide

**For First-Time Deployers: A Step-by-Step Guide**

This guide walks you through deploying the HR Evaluation System to production with:
- **Frontend**: Vercel (Next.js)
- **Backend**: Google Cloud Run (FastAPI)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Clerk

**Estimated Time**: 60-90 minutes for first deployment

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Phase 1: Preparation](#phase-1-preparation)
3. [Phase 2: Backend Deployment (Cloud Run)](#phase-2-backend-deployment-cloud-run)
4. [Phase 3: Frontend Deployment (Vercel)](#phase-3-frontend-deployment-vercel)
5. [Phase 4: Post-Deployment Configuration](#phase-4-post-deployment-configuration)
6. [Verification & Testing](#verification--testing)
7. [Troubleshooting](#troubleshooting)
8. [Rollback Procedures](#rollback-procedures)

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
   - Go to "JWT Templates" → "Blank" or default template
   - Note the **Issuer** URL (e.g., `https://your-app.clerk.accounts.dev`)
   - **Audience** can be your domain or leave as is

> ⚠️ **Important**: We'll configure webhooks AFTER backend deployment (Step 4.2)

### [x] Step 1.3: Prepare Your Environment Variables

Create a checklist of all values you'll need (use the `.env.prod` template):

**Backend (Cloud Run):**
```bash
CLERK_SECRET_KEY=sk_live_xxxxx              # From Clerk
SUPABASE_DATABASE_URL=postgresql://...      # From Supabase (pooler URL)
CLERK_ISSUER=https://xxx.clerk.accounts.dev # From Clerk JWT settings
CLERK_AUDIENCE=your-domain.com              # Your domain or Clerk default
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

# 4. Clerk Audience (your domain or Clerk default)
echo -n "your-domain.com" | gcloud secrets create clerk-audience --data-file=-

# 5. Clerk Webhook Secret (we'll update this later, use placeholder for now)
echo -n "PLACEHOLDER_WILL_UPDATE_LATER" | gcloud secrets create clerk-webhook-secret --data-file=-

# 6. Application Secret Key (generate with: openssl rand -hex 32)
echo -n "$(openssl rand -hex 32)" | gcloud secrets create app-secret-key --data-file=-

echo "✅ Secrets created!"

# Grant Cloud Run service account access to all secrets
echo "Granting Cloud Run access to secrets..."
for secret in clerk-secret-key database-url clerk-issuer clerk-audience clerk-webhook-secret app-secret-key; do
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
  --set-secrets "CLERK_SECRET_KEY=clerk-secret-key:latest,SUPABASE_DATABASE_URL=database-url:latest,CLERK_ISSUER=clerk-issuer:latest,CLERK_AUDIENCE=clerk-audience:latest,CLERK_WEBHOOK_SECRET=clerk-webhook-secret:latest,SECRET_KEY=app-secret-key:latest" \
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
echo -n "whsec_DEV_WEBHOOK_SECRET" | gcloud secrets create clerk-webhook-secret-dev --data-file=-
echo -n "$(openssl rand -hex 32)" | gcloud secrets create app-secret-key-dev --data-file=-

# Grant permissions for dev secrets
for secret in clerk-secret-key-dev database-url-dev clerk-issuer-dev clerk-audience-dev clerk-webhook-secret-dev app-secret-key-dev; do
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
  --set-secrets "CLERK_SECRET_KEY=clerk-secret-key-dev:latest,SUPABASE_DATABASE_URL=database-url-dev:latest,CLERK_ISSUER=clerk-issuer-dev:latest,CLERK_AUDIENCE=clerk-audience-dev:latest,CLERK_WEBHOOK_SECRET=clerk-webhook-secret-dev:latest,SECRET_KEY=app-secret-key-dev:latest" \
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
          --set-secrets "CLERK_SECRET_KEY=clerk-secret-key$SECRETS_SUFFIX:latest,SUPABASE_DATABASE_URL=database-url$SECRETS_SUFFIX:latest,CLERK_ISSUER=clerk-issuer$SECRETS_SUFFIX:latest,CLERK_AUDIENCE=clerk-audience$SECRETS_SUFFIX:latest,CLERK_WEBHOOK_SECRET=clerk-webhook-secret$SECRETS_SUFFIX:latest,SECRET_KEY=app-secret-key$SECRETS_SUFFIX:latest" \
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

git add .
git commit -m "Deploy backend to Cloud Run"
git push origin main
```

The GitHub Actions workflow will automatically build and deploy.

---

## Frontend Deployment (Vercel)

### Step 1: Install Vercel CLI (Optional)

```bash
npm install -g vercel
vercel login
```

### Step 2: Deploy via Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

### Step 3: Set Environment Variables in Vercel

In Vercel project settings → Environment Variables:

```bash
# Clerk (Required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# Backend API (REQUIRED! - Build will fail without this)
NEXT_PUBLIC_API_BASE_URL=https://hr-evaluation-backend-xxx.run.app

# Optional
NEXT_PUBLIC_ENABLE_REQUEST_LOGGING=false
```

**⚠️ Important**: `NEXT_PUBLIC_API_BASE_URL` must be set **before** building. Vercel will automatically use this during the build process. If not set, the build will fail with an error message.

### Step 4: Deploy

Click "Deploy" button in Vercel dashboard or:

```bash
cd frontend
vercel --prod
```

### Step 5: Get Deployment URL

Vercel will provide a URL like: `https://your-app.vercel.app`

**Important**: Update backend `FRONTEND_URL` with this URL!

```bash
# Update Cloud Run service with Vercel URL
gcloud run services update hr-evaluation-backend \
  --region us-central1 \
  --update-env-vars "FRONTEND_URL=https://your-app.vercel.app"
```

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
| `CLERK_AUDIENCE` | Yes | `your-audience` | Clerk JWT audience |
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

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing locally
- [ ] Database migrations tested
- [ ] Environment variables documented
- [ ] Secrets created in Secret Manager
- [ ] Clerk production instance configured
- [ ] Supabase production database ready

### Deployment

- [ ] Backend deployed to Cloud Run
- [ ] Frontend deployed to Vercel
- [ ] Environment variables set correctly
- [ ] CORS configured properly
- [ ] Health checks passing

### Post-Deployment

- [ ] Authentication working
- [ ] API endpoints accessible
- [ ] Database connections stable
- [ ] Clerk webhooks configured
- [ ] Monitoring and alerts set up
- [ ] Custom domains configured (if applicable)
- [ ] Team notified of deployment

---

## Support & Resources

- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Clerk Documentation](https://clerk.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)

For issues, contact the development team or create an issue in the GitHub repository.
