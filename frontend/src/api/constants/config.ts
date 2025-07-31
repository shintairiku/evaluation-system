declare const process: {
  env: {
    [key: string]: string | undefined;
    NEXT_PUBLIC_API_BASE_URL?: string;
    NODE_ENV?: string;
  };
};

const getApiBaseUrl = () => {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('NEXT_PUBLIC_API_BASE_URL is not set for production environment');
    }
    // In Docker environment, use service name 'backend' instead of 'localhost'
    // This can be detected by checking if we're in a containerized environment
    // For now, we'll use 'backend' as the default for Docker networking
    return 'http://backend:8000';
  }
  return baseUrl;
};

export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
  API_VERSION: 'v1',
  FULL_URL: `${getApiBaseUrl()}/api/v1`,
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second (base delay for exponential backoff)
  MAX_RETRY_DELAY: 30000, // 30 seconds (cap for exponential backoff)
  
  // Environment-specific settings
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  
  // Logging configuration
  ENABLE_REQUEST_LOGGING: process.env.NODE_ENV !== 'production', // Disable in production for performance
  ENABLE_ERROR_LOGGING: true, // Always log errors
  
  // Performance settings
  MAX_CONCURRENT_REQUESTS: 10, // Limit concurrent requests to prevent overload
} as const;

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string, version?: string) => {
  const apiVersion = version || API_CONFIG.API_VERSION;
  return `${API_CONFIG.BASE_URL}/api/${apiVersion}${endpoint}`;
};

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    VERIFY: '/auth/verify',
  },
  USERS: {
    LIST: '/users',
    DETAIL: (id: string) => `/users/${id}`,
    CREATE: '/users',
    UPDATE: (id: string) => `/users/${id}`,
    DELETE: (id: string) => `/users/${id}`,
    ORGANIZATION: '/users/organization',
    HIERARCHY: '/users/hierarchy',
    HIERARCHY_DATA: '/users/hierarchy-data',
  },
  DEPARTMENTS: {
    LIST: '/departments',
    DETAIL: (id: string) => `/departments/${id}`,
    CREATE: '/departments',
    UPDATE: (id: string) => `/departments/${id}`,
    DELETE: (id: string) => `/departments/${id}`,
  },
  STAGES: {
    LIST: '/stages',
    DETAIL: (id: string) => `/stages/${id}`,
    CREATE: '/stages',
    UPDATE: (id: string) => `/stages/${id}`,
    DELETE: (id: string) => `/stages/${id}`,
  },
  ROLES: {
    LIST: '/roles',
    DETAIL: (id: string) => `/roles/${id}`,
    CREATE: '/roles',
    UPDATE: (id: string) => `/roles/${id}`,
    DELETE: (id: string) => `/roles/${id}`,
    REORDER: '/roles/reorder',
  },
  EVALUATION_PERIODS: {
    LIST: '/evaluation-periods',
    DETAIL: (id: string) => `/evaluation-periods/${id}`,
    CREATE: '/evaluation-periods',
    UPDATE: (id: string) => `/evaluation-periods/${id}`,
    DELETE: (id: string) => `/evaluation-periods/${id}`,
  },
  COMPETENCIES: {
    LIST: '/competencies',
    DETAIL: (id: string) => `/competencies/${id}`,
    CREATE: '/competencies',
    UPDATE: (id: string) => `/competencies/${id}`,
    DELETE: (id: string) => `/competencies/${id}`,
  },
  GOALS: {
    LIST: '/goals',
    DETAIL: (id: string) => `/goals/${id}`,
    CREATE: '/goals',
    UPDATE: (id: string) => `/goals/${id}`,
    DELETE: (id: string) => `/goals/${id}`,
  },
  SELF_ASSESSMENTS: {
    LIST: '/self-assessments',
    DETAIL: (id: string) => `/self-assessments/${id}`,
    CREATE: '/self-assessments',
    UPDATE: (id: string) => `/self-assessments/${id}`,
    DELETE: (id: string) => `/self-assessments/${id}`,
  },
  SUPERVISOR_REVIEWS: {
    LIST: '/supervisor-reviews',
    DETAIL: (id: string) => `/supervisor-reviews/${id}`,
    CREATE: '/supervisor-reviews',
    UPDATE: (id: string) => `/supervisor-reviews/${id}`,
    DELETE: (id: string) => `/supervisor-reviews/${id}`,
  },
  SUPERVISOR_FEEDBACK: {
    LIST: '/supervisor-feedback',
    DETAIL: (id: string) => `/supervisor-feedback/${id}`,
    CREATE: '/supervisor-feedback',
    UPDATE: (id: string) => `/supervisor-feedback/${id}`,
    DELETE: (id: string) => `/supervisor-feedback/${id}`,
  },
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error occurred. Please check your connection.',
  UNAUTHORIZED: 'You are not authorized to access this resource.',
  FORBIDDEN: 'Access denied. You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  INTERNAL_ERROR: 'An internal error occurred. Please try again later.',
  TIMEOUT: 'Request timed out. Please try again.',
} as const;