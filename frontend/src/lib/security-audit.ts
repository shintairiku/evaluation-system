/**
 * Security Audit and Monitoring Utilities
 *
 * This module provides security-focused logging and monitoring capabilities
 * for tracking access attempts, permission checks, and security events.
 */

export interface SecurityEvent {
  timestamp: string;
  userId?: string;
  userAgent?: string;
  ip?: string;
  action: string;
  resource: string;
  resourceId?: string;
  success: boolean;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface AccessAttempt {
  timestamp: string;
  userId?: string;
  userAgent?: string;
  ip?: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime?: number;
  errorMessage?: string;
}

class SecurityAuditor {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private logLevel = process.env.SECURITY_LOG_LEVEL || 'info';

  /**
   * Log security-related events for audit trail
   */
  logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    // In development, log to console
    if (this.isDevelopment) {
      console.log('[SECURITY AUDIT]', securityEvent);
    }

    // In production, you would send this to your security monitoring service
    // Examples: Splunk, DataDog, CloudWatch, etc.
    this.sendToSecurityMonitoring(securityEvent);
  }

  /**
   * Log access attempts (successful and failed)
   */
  logAccessAttempt(attempt: Omit<AccessAttempt, 'timestamp'>): void {
    const accessAttempt: AccessAttempt = {
      ...attempt,
      timestamp: new Date().toISOString(),
    };

    // Log suspicious patterns
    if (this.isSuspiciousAccess(accessAttempt)) {
      this.logSecurityEvent({
        action: 'suspicious_access_pattern',
        resource: 'system',
        success: false,
        reason: 'Multiple failed access attempts detected',
        metadata: { accessAttempt },
      });
    }

    if (this.isDevelopment) {
      console.log('[ACCESS AUDIT]', accessAttempt);
    }

    this.sendToAccessLog(accessAttempt);
  }

  /**
   * Log permission validation attempts
   */
  logPermissionCheck(params: {
    userId?: string;
    requiredPermission: string;
    resource: string;
    resourceId?: string;
    granted: boolean;
    reason?: string;
  }): void {
    this.logSecurityEvent({
      action: 'permission_check',
      resource: params.resource,
      resourceId: params.resourceId,
      success: params.granted,
      reason: params.reason || (params.granted ? 'Permission granted' : 'Permission denied'),
      metadata: {
        requiredPermission: params.requiredPermission,
        userId: params.userId,
      },
    });
  }

  /**
   * Log authentication events
   */
  logAuthEvent(params: {
    userId?: string;
    action: 'login' | 'logout' | 'token_refresh' | 'session_expired';
    success: boolean;
    reason?: string;
    userAgent?: string;
    ip?: string;
  }): void {
    this.logSecurityEvent({
      action: `auth_${params.action}`,
      resource: 'authentication',
      success: params.success,
      reason: params.reason,
      userId: params.userId,
      userAgent: params.userAgent,
      ip: params.ip,
    });
  }

  /**
   * Log sensitive data access
   */
  logDataAccess(params: {
    userId?: string;
    dataType: string;
    action: 'read' | 'write' | 'delete';
    recordCount?: number;
    success: boolean;
    reason?: string;
  }): void {
    this.logSecurityEvent({
      action: `data_${params.action}`,
      resource: params.dataType,
      success: params.success,
      reason: params.reason,
      userId: params.userId,
      metadata: {
        recordCount: params.recordCount,
      },
    });
  }

  /**
   * Detect suspicious access patterns
   */
  private isSuspiciousAccess(attempt: AccessAttempt): boolean {
    // Implement your suspicious activity detection logic here
    // Examples:
    // - Multiple 403/401 responses in short time
    // - Access to admin endpoints from non-admin users
    // - Unusual request patterns

    return attempt.statusCode === 403 || attempt.statusCode === 401;
  }

  /**
   * Send security events to monitoring service
   */
  private sendToSecurityMonitoring(event: SecurityEvent): void {
    // In production, integrate with your security monitoring service
    // Example integrations:

    if (process.env.NODE_ENV === 'production') {
      // Example: Send to external logging service
      // await fetch(process.env.SECURITY_LOG_ENDPOINT, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(event)
      // });
    }

    // For now, we'll use structured console logging
    if (this.logLevel === 'debug' || !event.success) {
      console.log(JSON.stringify({
        level: event.success ? 'info' : 'warn',
        service: 'hr-evaluation-system',
        component: 'security-audit',
        ...event,
      }));
    }
  }

  /**
   * Send access logs to monitoring service
   */
  private sendToAccessLog(attempt: AccessAttempt): void {
    // Similar to security monitoring, but for general access logs
    if (this.logLevel === 'debug' || attempt.statusCode >= 400) {
      console.log(JSON.stringify({
        level: attempt.statusCode >= 400 ? 'warn' : 'info',
        service: 'hr-evaluation-system',
        component: 'access-audit',
        ...attempt,
      }));
    }
  }
}

// Singleton instance
export const securityAuditor = new SecurityAuditor();

/**
 * Decorator for logging function calls with security context
 */
export function withSecurityAudit(
  resource: string,
  action: string
) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      let success = false;
      let errorMessage: string | undefined;

      try {
        const result = await method.apply(this, args);
        success = true;
        return result;
      } catch (error) {
        success = false;
        errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw error;
      } finally {
        const responseTime = Date.now() - startTime;

        securityAuditor.logSecurityEvent({
          action,
          resource,
          success,
          reason: errorMessage,
          metadata: {
            method: propertyName,
            responseTime,
            args: process.env.NODE_ENV === 'development' ? args : undefined,
          },
        });
      }
    };

    return descriptor;
  };
}

/**
 * Helper function to extract security context from request
 */
export function extractSecurityContext(request?: Request): {
  userAgent?: string;
  ip?: string;
  timestamp: string;
} {
  return {
    userAgent: request?.headers.get('user-agent') || undefined,
    ip: request?.headers.get('x-forwarded-for') ||
        request?.headers.get('x-real-ip') ||
        'unknown',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Rate limiting helper for security
 */
export class SecurityRateLimiter {
  private attempts = new Map<string, number[]>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts = 5, windowMs = 15 * 60 * 1000) { // 15 minutes
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  checkRateLimit(identifier: string): { allowed: boolean; remainingAttempts: number } {
    const now = Date.now();
    const userAttempts = this.attempts.get(identifier) || [];

    // Remove old attempts outside the window
    const recentAttempts = userAttempts.filter(time => now - time < this.windowMs);

    if (recentAttempts.length >= this.maxAttempts) {
      securityAuditor.logSecurityEvent({
        action: 'rate_limit_exceeded',
        resource: 'system',
        success: false,
        reason: `Rate limit exceeded for ${identifier}`,
        metadata: { attempts: recentAttempts.length, maxAttempts: this.maxAttempts },
      });

      return { allowed: false, remainingAttempts: 0 };
    }

    // Add current attempt
    recentAttempts.push(now);
    this.attempts.set(identifier, recentAttempts);

    return {
      allowed: true,
      remainingAttempts: this.maxAttempts - recentAttempts.length
    };
  }
}