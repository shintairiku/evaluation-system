# Deployment Guide

This guide covers deploying the HR Evaluation System to production with:
- **Frontend**: Vercel
- **Backend**: Google Cloud Run
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Clerk

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Backend Deployment (Cloud Run)](#backend-deployment-cloud-run)
3. [Frontend Deployment (Vercel)](#frontend-deployment-vercel)
4. [Environment Variables Setup](#environment-variables-setup)
5. [Post-Deployment Steps](#post-deployment-steps)
6. [Troubleshooting](#troubleshooting)
7. [Rollback Procedures](#rollback-procedures)

---

## Prerequisites

### Required Accounts & Services

- [ ] Google Cloud Platform account with billing enabled
- [ ] Vercel account (free tier works for small teams)
- [ ] Supabase account (production database)
- [ ] Clerk account (production instance)
- [ ] GitHub repository access

### Required Tools

```bash
# Install Google Cloud SDK
brew install google-cloud-sdk  # macOS
# OR
curl https://sdk.cloud.google.com | bash  # Linux

# Install Vercel CLI (optional)
npm install -g vercel

# Verify installations
gcloud --version
vercel --version
```

### Prepare Supabase Database

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Create a new project (Production)
3. Note down:
   - Database URL (connection string)
   - Anon public key
   - Service role key
4. Run database migrations (if applicable)

### Prepare Clerk Production Instance

1. Go to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Create a production instance
3. Note down:
   - Publishable key
   - Secret key
   - Issuer URL
   - Audience (if using organizations)
4. Configure:
   - Production domains (your Vercel URL)
   - Organization settings (if enabled)
   - Webhooks (point to Cloud Run URL)

---

## Backend Deployment (Cloud Run)

### Step 1: Set Up Google Cloud Project

```bash
# Login to Google Cloud
gcloud auth login

# Create a new project (or use existing)
gcloud projects create hr-evaluation-system --name="HR Evaluation System"

# Set the project
gcloud config set project hr-evaluation-system

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### Step 2: Set Up Secrets in Google Secret Manager

```bash
# Create secrets for sensitive data
echo -n "your-clerk-secret-key" | gcloud secrets create clerk-secret --data-file=-
echo -n "postgresql://..." | gcloud secrets create db-url --data-file=-
echo -n "your-clerk-issuer" | gcloud secrets create clerk-issuer --data-file=-
echo -n "your-clerk-audience" | gcloud secrets create clerk-audience --data-file=-
echo -n "your-webhook-secret" | gcloud secrets create clerk-webhook-secret --data-file=-

# Grant Cloud Run access to secrets
PROJECT_NUMBER=$(gcloud projects describe hr-evaluation-system --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding clerk-secret \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Repeat for all secrets
gcloud secrets add-iam-policy-binding db-url \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding clerk-issuer \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding clerk-audience \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding clerk-webhook-secret \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Step 3: Build and Deploy Backend

#### Option A: Manual Deployment

```bash
# Build the Docker image
cd backend
docker build -t gcr.io/hr-evaluation-system/hr-evaluation-backend:latest -f Dockerfile.prod .

# Configure Docker authentication
gcloud auth configure-docker

# Push to Google Container Registry
docker push gcr.io/hr-evaluation-system/hr-evaluation-backend:latest

# Deploy to Cloud Run
gcloud run deploy hr-evaluation-backend \
  --image gcr.io/hr-evaluation-system/hr-evaluation-backend:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "ENVIRONMENT=production,LOG_LEVEL=INFO,FRONTEND_URL=https://your-app.vercel.app" \
  --set-secrets "CLERK_SECRET_KEY=clerk-secret:latest,SUPABASE_DATABASE_URL=db-url:latest,CLERK_ISSUER=clerk-issuer:latest,CLERK_AUDIENCE=clerk-audience:latest,CLERK_WEBHOOK_SECRET=clerk-webhook-secret:latest" \
  --min-instances 0 \
  --max-instances 10 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300s \
  --port 8000

# Get the service URL
gcloud run services describe hr-evaluation-backend \
  --region us-central1 \
  --format 'value(status.url)'
```

#### Option B: Automated Deployment via GitHub Actions

1. **Create Service Account for GitHub Actions**

```bash
# Create service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Deployment"

# Grant necessary permissions
gcloud projects add-iam-policy-binding hr-evaluation-system \
  --member="serviceAccount:github-actions@hr-evaluation-system.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding hr-evaluation-system \
  --member="serviceAccount:github-actions@hr-evaluation-system.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding hr-evaluation-system \
  --member="serviceAccount:github-actions@hr-evaluation-system.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Create and download JSON key
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions@hr-evaluation-system.iam.gserviceaccount.com
```

2. **Add GitHub Secrets**

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add the following secrets:
- `GCP_PROJECT_ID`: `hr-evaluation-system`
- `GCP_SA_KEY`: Contents of `github-actions-key.json`
- `GCP_REGION`: `us-central1` (or your preferred region)

3. **Push to Deploy**

```bash
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
