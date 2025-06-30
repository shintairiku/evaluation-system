# Configuration Maintenance Guide

This guide explains how to maintain and update the central `app/core/config.py` file as the HR Evaluation System grows.

## 📁 File Purpose

`config.py` is the **single source of truth** for all application configuration:
- ✅ Environment-specific settings (dev/staging/prod)
- ✅ External service configuration (Clerk, Supabase, SMTP)
- ✅ Application behavior settings
- ✅ Feature flags and business logic constants

## 🔄 When to Update config.py

### ✅ Always Add New Settings For:

1. **New External Services**
   ```python
   # Example: Adding analytics service
   GOOGLE_ANALYTICS_ID: Optional[str] = os.getenv("GOOGLE_ANALYTICS_ID")
   MIXPANEL_TOKEN: Optional[str] = os.getenv("MIXPANEL_TOKEN")
   ```

2. **Environment Variables**
   ```python
   # Example: Adding new environment variable
   NEW_FEATURE_ENABLED: bool = os.getenv("NEW_FEATURE_ENABLED", "False").lower() == "true"
   ```

3. **Business Logic Constants**
   ```python
   # Example: Adding evaluation settings
   PEER_REVIEW_DEADLINE_DAYS: int = 14
   MAX_GOALS_PER_USER: int = 10
   SELF_ASSESSMENT_REMINDER_DAYS: int = 7
   ```

4. **File/Upload Settings**
   ```python
   # Example: Adding new file types
   PROFILE_PHOTO_MAX_SIZE_MB: int = 5
   ALLOWED_PROFILE_PHOTO_TYPES: List[str] = [".jpg", ".jpeg", ".png", ".webp"]
   ```

## 📋 Configuration Sections

The config.py is organized into clear sections:

### 1. Core Application Settings
```python
# =============================================================================
# CORE APPLICATION SETTINGS
# =============================================================================
APP_NAME: str = "HR Evaluation System"
APP_VERSION: str = "1.0.0"  # UPDATE THIS ON RELEASES
```

### 2. Authentication Settings (Clerk)
```python
# =============================================================================
# AUTHENTICATION SETTINGS (Clerk)
# =============================================================================
CLERK_SECRET_KEY: Optional[str] = os.getenv("CLERK_SECRET_KEY")
```

### 3. Database Settings (Supabase)
```python
# =============================================================================
# DATABASE SETTINGS (Supabase)
# =============================================================================
SUPABASE_DATABASE_URL: Optional[str] = os.getenv("SUPABASE_DATABASE_URL")
```

### 4. HR System Specific Settings
```python
# =============================================================================
# HR SYSTEM SPECIFIC SETTINGS
# =============================================================================
DEFAULT_EMPLOYEE_CODE: str = "0000"
EVALUATION_PERIOD_MONTHS: int = 6
```

## 🔧 How to Add New Configuration

### Step 1: Add the Setting
```python
# Add to appropriate section
NEW_SETTING: str = os.getenv("NEW_SETTING", "default_value")
```

### Step 2: Add Validation (if needed)
```python
@property
def new_feature_configured(self) -> bool:
    """Check if new feature is configured."""
    return bool(self.NEW_SETTING)
```

### Step 3: Update validate_configuration()
```python
def validate_configuration(self) -> List[str]:
    issues = []
    
    # Add validation for critical new settings
    if self.is_production and not self.new_feature_configured:
        issues.append("New feature not configured for production")
    
    return issues
```

### Step 4: Update get_environment_info()
```python
def get_environment_info() -> dict:
    return {
        # ... existing fields ...
        "new_feature_configured": settings.new_feature_configured,
    }
```

## 🌍 Environment-Specific Configuration

### Development (.env.local)
```bash
ENVIRONMENT=development
DEBUG=True
CLERK_SECRET_KEY=sk_test_...
SUPABASE_DATABASE_URL=postgresql://localhost...
```

### Staging (.env.staging)
```bash
ENVIRONMENT=staging
DEBUG=False
CLERK_SECRET_KEY=sk_live_...
SUPABASE_DATABASE_URL=postgresql://staging...
```

### Production (.env.production)
```bash
ENVIRONMENT=production
DEBUG=False
CLERK_SECRET_KEY=sk_live_...
SUPABASE_DATABASE_URL=postgresql://prod...
SMTP_SERVER=smtp.company.com
SENTRY_DSN=https://...
```

## 📊 Configuration Validation

Always validate configuration on startup:

```python
# In app/main.py or startup
from app.core.config import settings

@app.on_event("startup")
async def validate_config():
    issues = settings.validate_configuration()
    if issues:
        for issue in issues:
            logger.warning(f"Config issue: {issue}")
```

## 🔍 Testing Configuration

Run the config example to check current status:
```bash
python config_example.py
```

## 📝 Best Practices

### ✅ Do:
- **Group related settings** in sections
- **Use environment variables** for sensitive data
- **Provide sensible defaults** for optional settings
- **Add validation properties** for complex configurations
- **Document environment-specific behavior**
- **Update version number** on releases

### ❌ Don't:
- **Hardcode sensitive values** (API keys, passwords)
- **Mix development and production values**
- **Forget to add new settings to validation**
- **Use magic numbers** throughout code (centralize in config)

## 🚀 Deployment Checklist

When deploying to new environments:

1. [ ] Copy appropriate .env file
2. [ ] Update environment-specific values
3. [ ] Run `python config_example.py` to validate
4. [ ] Check `settings.validate_configuration()` returns empty list
5. [ ] Verify all required environment variables are set

## 📈 Future Enhancements

As the system grows, consider adding:

### Caching Configuration
```python
# Redis for caching
REDIS_URL: Optional[str] = os.getenv("REDIS_URL")
CACHE_USER_PROFILES_TTL: int = 1800  # 30 minutes
CACHE_EVALUATION_DATA_TTL: int = 3600  # 1 hour
```

### Email Templates
```python
# Email template settings
EMAIL_TEMPLATE_DIR: str = "templates/emails"
EVALUATION_REMINDER_TEMPLATE: str = "evaluation_reminder.html"
GOAL_DEADLINE_TEMPLATE: str = "goal_deadline_warning.html"
```

### File Storage
```python
# File storage settings  
STORAGE_BACKEND: str = os.getenv("STORAGE_BACKEND", "local")  # local, s3, gcs
AWS_S3_BUCKET: Optional[str] = os.getenv("AWS_S3_BUCKET")
PROFILE_PHOTOS_PATH: str = "/uploads/profiles"
DOCUMENTS_PATH: str = "/uploads/documents"
```

### Performance Monitoring
```python
# Performance settings
SLOW_QUERY_THRESHOLD_MS: int = 1000
API_RATE_LIMIT_BURST: int = 100
BACKGROUND_TASK_TIMEOUT: int = 300
```

## 🎯 Conclusion

The `config.py` file should evolve with your application. Always:
- Keep it organized and well-documented
- Validate configuration on startup
- Use environment variables for deployment flexibility
- Test configuration changes thoroughly

This approach ensures your HR Evaluation System remains maintainable and deployable across different environments as it grows.