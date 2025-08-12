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
  // Auth endpoints
  AUTH: {
    // GET_USER_BY_CLERK_ID: (clerkId: string) => `/auth/user/${clerkId}`,
    // SIGNUP: '/auth/signup',
    // SIGNUP_PROFILE_OPTIONS: '/auth/signup/profile-options',
  },
  
  // User endpoints
  USERS: {
    LIST: '/users',
    BY_ID: (id: string) => `/users/${id}`,
    CREATE: '/users',
    UPDATE: (id: string) => `/users/${id}`,
    DELETE: (id: string) => `/users/${id}`,
    EXISTS: (clerkId: string) => `/users/exists/${clerkId}`,
    PROFILE_OPTIONS: '/users/profile-options',
  },
  
  // Department endpoints
  DEPARTMENTS: {
    LIST: '/departments',
    BY_ID: (id: string) => `/departments/${id}`,
    CREATE: '/departments',
    UPDATE: (id: string) => `/departments/${id}`,
    DELETE: (id: string) => `/departments/${id}`,
  },
  
  // Role endpoints
  ROLES: {
    LIST: '/roles',
    BY_ID: (id: string) => `/roles/${id}`,
    CREATE: '/roles',
    UPDATE: (id: string) => `/roles/${id}`,
    DELETE: (id: string) => `/roles/${id}`,
  },
  
  // Stage endpoints
  STAGES: {
    LIST: '/stages',
    BY_ID: (id: string) => `/stages/${id}`,
    CREATE: '/stages',
    UPDATE: (id: string) => `/stages/${id}`,
    DELETE: (id: string) => `/stages/${id}`,
  },
  
  // Evaluation Period endpoints
  EVALUATION_PERIODS: {
    LIST: '/evaluation-periods',
    BY_ID: (id: string) => `/evaluation-periods/${id}`,
    CREATE: '/evaluation-periods',
    UPDATE: (id: string) => `/evaluation-periods/${id}`,
    DELETE: (id: string) => `/evaluation-periods/${id}`,
    CURRENT: '/evaluation-periods/current',
  },
  
  // Goal endpoints
  GOALS: {
    LIST: '/goals',
    BY_ID: (id: string) => `/goals/${id}`,
    CREATE: '/goals',
    UPDATE: (id: string) => `/goals/${id}`,
    DELETE: (id: string) => `/goals/${id}`,
    BY_USER: (userId: string) => `/goals/user/${userId}`,
    BY_PERIOD: (periodId: string) => `/goals/period/${periodId}`,
    SUBMIT: (id: string) => `/goals/${id}/submit`,
    APPROVE: (id: string) => `/goals/${id}/approve`,
    REJECT: (id: string) => `/goals/${id}/reject`,
    PENDING_SUPERVISOR: '/goals/supervisor/pending',
  },
  
  // Goal Category endpoints
  GOAL_CATEGORIES: {
    LIST: '/goal-categories',
    BY_ID: (id: string) => `/goal-categories/${id}`,
    CREATE: '/goal-categories',
    UPDATE: (id: string) => `/goal-categories/${id}`,
    DELETE: (id: string) => `/goal-categories/${id}`,
  },
  
  // Competency endpoints
  COMPETENCIES: {
    LIST: '/competencies',
    BY_ID: (id: string) => `/competencies/${id}`,
    CREATE: '/competencies',
    UPDATE: (id: string) => `/competencies/${id}`,
    DELETE: (id: string) => `/competencies/${id}`,
  },
  
  // Self Assessment endpoints
  SELF_ASSESSMENTS: {
    LIST: '/self-assessments',
    BY_ID: (id: string) => `/self-assessments/${id}`,
    CREATE: '/self-assessments',
    UPDATE: (id: string) => `/self-assessments/${id}`,
    DELETE: (id: string) => `/self-assessments/${id}`,
    BY_USER: (userId: string) => `/self-assessments/user/${userId}`,
    BY_PERIOD: (periodId: string) => `/self-assessments/period/${periodId}`,
  },
  
  // Supervisor Review endpoints
  SUPERVISOR_REVIEWS: {
    LIST: '/supervisor-reviews',
    BY_ID: (id: string) => `/supervisor-reviews/${id}`,
    CREATE: '/supervisor-reviews',
    UPDATE: (id: string) => `/supervisor-reviews/${id}`,
    DELETE: (id: string) => `/supervisor-reviews/${id}`,
    BY_SUPERVISOR: (supervisorId: string) => `/supervisor-reviews/supervisor/${supervisorId}`,
    BY_EMPLOYEE: (employeeId: string) => `/supervisor-reviews/employee/${employeeId}`,
  },
  
  // Supervisor Feedback endpoints
  SUPERVISOR_FEEDBACKS: {
    LIST: '/supervisor-feedbacks',
    BY_ID: (id: string) => `/supervisor-feedbacks/${id}`,
    CREATE: '/supervisor-feedbacks',
    UPDATE: (id: string) => `/supervisor-feedbacks/${id}`,
    DELETE: (id: string) => `/supervisor-feedbacks/${id}`,
    BY_SUPERVISOR: (supervisorId: string) => `/supervisor-feedbacks/supervisor/${supervisorId}`,
    BY_EMPLOYEE: (employeeId: string) => `/supervisor-feedbacks/employee/${employeeId}`,
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