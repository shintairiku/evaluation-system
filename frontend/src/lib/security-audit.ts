/**
 * Simplified Security Audit Utilities
 *
 * Minimal security logging aligned with project needs.
 * Focuses on essential audit trails without overengineering.
 */

export interface SecurityEvent {
  timestamp: string;
  action: string;
  resource: string;
  success: boolean;
  reason?: string;
}

export interface AccessAttempt {
  timestamp: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime?: number;
  errorMessage?: string;
}

class SecurityAuditor {
  /**
   * Log security events in development mode only
   */
  logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    if (process.env.NODE_ENV === 'development') {
      console.log('[SECURITY]', {
        ...event,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Log access attempts for monitoring
   */
  logAccessAttempt(attempt: Omit<AccessAttempt, 'timestamp'>): void {
    if (process.env.NODE_ENV === 'development') {
      console.log('[ACCESS]', {
        ...attempt,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Log permission checks
   */
  logPermissionCheck(params: {
    requiredPermission: string;
    resource: string;
    resourceId?: string;
    granted: boolean;
    reason?: string;
  }): void {
    this.logSecurityEvent({
      action: 'permission_check',
      resource: params.resource,
      success: params.granted,
      reason: params.reason || (params.granted ? 'Permission granted' : 'Permission denied'),
    });
  }

  /**
   * Log data access operations
   */
  logDataAccess(params: {
    dataType: string;
    action: 'read' | 'write' | 'delete';
    success: boolean;
    reason?: string;
  }): void {
    this.logSecurityEvent({
      action: `data_${params.action}`,
      resource: params.dataType,
      success: params.success,
      reason: params.reason,
    });
  }
}

// Singleton instance
export const securityAuditor = new SecurityAuditor();