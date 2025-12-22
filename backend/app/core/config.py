import os
from typing import Optional, List
from enum import Enum


class Environment(str, Enum):
    """Application environment types."""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TESTING = "testing"


class Settings:
    """
    Central configuration for HR Evaluation System with Clerk authentication.
    
    This file should be updated continuously as the application grows.
    All environment-specific settings should be defined here.
    """
    
    # =============================================================================
    # CORE APPLICATION SETTINGS
    # =============================================================================
    APP_NAME: str = "HR Evaluation System"
    APP_VERSION: str = "1.0.0"
    APP_DESCRIPTION: str = "Human Resources Evaluation and Performance Management System"
    
    # Environment configuration
    ENVIRONMENT: Environment = Environment(os.getenv("ENVIRONMENT") or "development")
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    # =============================================================================
    # AUTHENTICATION SETTINGS (Clerk)
    # =============================================================================
    CLERK_SECRET_KEY: Optional[str] = os.getenv("CLERK_SECRET_KEY")
    CLERK_PUBLISHABLE_KEY: Optional[str] = os.getenv("CLERK_PUBLISHABLE_KEY") 
    CLERK_ISSUER: Optional[str] = os.getenv("CLERK_ISSUER")
    CLERK_AUDIENCE: Optional[str] = os.getenv("CLERK_AUDIENCE")
    CLERK_WEBHOOK_SECRET: Optional[str] = os.getenv("CLERK_WEBHOOK_SECRET")
    CLERK_ORGANIZATION_ENABLED: bool = os.getenv("CLERK_ORGANIZATION_ENABLED", "True").lower() == "true"
    # Allow small clock skew between Clerk and backend containers (nbf/exp validation).
    CLERK_JWT_LEEWAY_SECONDS: int = int(os.getenv("CLERK_JWT_LEEWAY_SECONDS", "10"))
    
    # =============================================================================
    # DATABASE SETTINGS (Supabase)
    # =============================================================================
    SUPABASE_DATABASE_URL: Optional[str] = os.getenv("SUPABASE_DATABASE_URL")
    SUPABASE_URL: Optional[str] = os.getenv("SUPABASE_URL")
    SUPABASE_ANON_KEY: Optional[str] = os.getenv("SUPABASE_ANON_KEY")
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    # Database connection settings
    DB_POOL_SIZE: int = int(os.getenv("DB_POOL_SIZE", "10"))
    DB_MAX_OVERFLOW: int = int(os.getenv("DB_MAX_OVERFLOW", "20"))
    DB_POOL_TIMEOUT: int = int(os.getenv("DB_POOL_TIMEOUT", "30"))
    
    # =============================================================================
    # CORS & SECURITY SETTINGS
    # =============================================================================
    ALLOWED_HOSTS: List[str] = ["localhost", "127.0.0.1", "0.0.0.0"]

    # Frontend URL for CORS and redirects
    FRONTEND_URL: Optional[str] = os.getenv("FRONTEND_URL")

    @property
    def CORS_ORIGINS(self) -> List[str]:
        """Dynamic CORS origins based on environment."""
        if self.ENVIRONMENT == Environment.PRODUCTION:
            # Use FRONTEND_URL from environment variable in production
            origins = []
            if self.FRONTEND_URL:
                origins.append(self.FRONTEND_URL)

            # Allow additional origins from environment variable (comma-separated)
            additional_origins = os.getenv("ADDITIONAL_CORS_ORIGINS", "")
            if additional_origins:
                origins.extend([origin.strip() for origin in additional_origins.split(",")])

            # Fallback to default if no origins configured
            if not origins:
                origins = ["https://your-production-domain.vercel.app"]

            return origins
        elif self.ENVIRONMENT == Environment.STAGING:
            origins = []
            if self.FRONTEND_URL:
                origins.append(self.FRONTEND_URL)

            # Always allow localhost in staging
            origins.extend([
                "http://localhost:3000",
                "http://127.0.0.1:3000",
            ])
            return origins
        else:  # development/testing
            return [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:3001",  # For Storybook or additional dev servers
            ]
    
    # =============================================================================
    # API SETTINGS
    # =============================================================================
    API_V1_PREFIX: str = "/api/v1"
    
    @property
    def API_DOCS_URL(self) -> Optional[str]:
        """API docs URL - disabled in production."""
        return "/docs" if self.ENVIRONMENT != Environment.PRODUCTION else None
    
    @property 
    def API_REDOC_URL(self) -> Optional[str]:
        """ReDoc URL - disabled in production."""
        return "/redoc" if self.ENVIRONMENT != Environment.PRODUCTION else None
    
    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
    
    # =============================================================================
    # HR SYSTEM SPECIFIC SETTINGS
    # =============================================================================
    
    # User onboarding settings
    DEFAULT_EMPLOYEE_CODE: str = "0000"
    DEFAULT_ROLE_ID: int = 3  # Employee role (should match database)
    
    # Evaluation periods
    EVALUATION_PERIOD_MONTHS: int = 6  # Semi-annual evaluations
    GOAL_DEADLINE_WARNING_DAYS: int = 30  # Warning X days before goal deadline
    
    # File upload settings
    MAX_FILE_SIZE_MB: int = int(os.getenv("MAX_FILE_SIZE_MB", "10"))
    ALLOWED_FILE_TYPES: List[str] = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"]
    
    # Email notification settings
    SMTP_SERVER: Optional[str] = os.getenv("SMTP_SERVER")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: Optional[str] = os.getenv("SMTP_USERNAME")
    SMTP_PASSWORD: Optional[str] = os.getenv("SMTP_PASSWORD")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "noreply@company.com")
    
    # =============================================================================
    # LOGGING SETTINGS
    # =============================================================================
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s"
    
    # =============================================================================
    # CACHING SETTINGS (for future use)
    # =============================================================================
    REDIS_URL: Optional[str] = os.getenv("REDIS_URL")
    CACHE_TTL_SECONDS: int = int(os.getenv("CACHE_TTL_SECONDS", "300"))  # 5 minutes
    
    # =============================================================================
    # MONITORING & ANALYTICS (for future use)
    # =============================================================================
    SENTRY_DSN: Optional[str] = os.getenv("SENTRY_DSN")
    ANALYTICS_ENABLED: bool = os.getenv("ANALYTICS_ENABLED", "False").lower() == "true"
    
    # =============================================================================
    # COMPUTED PROPERTIES
    # =============================================================================
    
    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.ENVIRONMENT == Environment.DEVELOPMENT
    
    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.ENVIRONMENT == Environment.PRODUCTION
    
    @property
    def is_testing(self) -> bool:
        """Check if running in testing mode."""
        return self.ENVIRONMENT == Environment.TESTING
    
    @property
    def clerk_configured(self) -> bool:
        """Check if Clerk authentication is properly configured."""
        return bool(self.CLERK_SECRET_KEY and self.CLERK_PUBLISHABLE_KEY)
    
    @property
    def clerk_jwt_configured(self) -> bool:
        """Check if Clerk JWT verification is properly configured."""
        return bool(self.CLERK_ISSUER and self.CLERK_AUDIENCE)
    
    @property
    def database_configured(self) -> bool:
        """Check if database is properly configured."""
        return bool(self.SUPABASE_DATABASE_URL)
    
    @property
    def email_configured(self) -> bool:
        """Check if email is properly configured."""
        return bool(self.SMTP_SERVER and self.SMTP_USERNAME and self.SMTP_PASSWORD)
    
    @property
    def redis_configured(self) -> bool:
        """Check if Redis caching is configured."""
        return bool(self.REDIS_URL)
    
    def get_database_url(self) -> str:
        """Get database URL with fallback."""
        if not self.database_configured:
            raise ValueError("Database URL not configured")
        return self.SUPABASE_DATABASE_URL
    
    def validate_configuration(self) -> List[str]:
        """
        Validate critical configuration and return list of issues.
        
        Returns:
            List of configuration issues (empty if all good)
        """
        issues = []
        
        if not self.clerk_configured:
            issues.append("Clerk authentication not configured (missing CLERK_SECRET_KEY or CLERK_PUBLISHABLE_KEY)")
        
        if self.CLERK_ORGANIZATION_ENABLED and not self.clerk_jwt_configured:
            issues.append("Clerk JWT verification not configured for organization support (missing CLERK_ISSUER or CLERK_AUDIENCE)")
        
        if not self.database_configured:
            issues.append("Database not configured (missing SUPABASE_DATABASE_URL)")
        
        if self.is_production and self.DEBUG:
            issues.append("DEBUG=True in production environment")
        
        if self.is_production and not self.email_configured:
            issues.append("Email not configured for production environment")
        
        return issues


# Global settings instance
settings = Settings()


# =============================================================================
# ENVIRONMENT-SPECIFIC CONFIGURATIONS
# =============================================================================

def get_environment_info() -> dict:
    """Get current environment information for debugging."""
    return {
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT.value,
        "debug": settings.DEBUG,
        "clerk_configured": settings.clerk_configured,
        "clerk_jwt_configured": settings.clerk_jwt_configured,
        "clerk_organization_enabled": settings.CLERK_ORGANIZATION_ENABLED,
        "database_configured": settings.database_configured,
        "email_configured": settings.email_configured,
        "cors_origins": settings.CORS_ORIGINS,
    }
