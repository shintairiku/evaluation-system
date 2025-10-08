declare const process: {
  env: {
    [key: string]: string | undefined;
    NEXT_PUBLIC_API_BASE_URL?: string;
    API_BASE_URL_SERVER?: string;
    NODE_ENV?: string;
  };
};

// Detect if we're running on server or client
const isServer = typeof window === 'undefined';

const getApiBaseUrl = () => {
  // Server-side: use Docker internal network (backend:8000)
  if (isServer) {
    const serverUrl = process.env.API_BASE_URL_SERVER;
    if (!serverUrl) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('API_BASE_URL_SERVER is not set for production environment');
      }
      // Default to Docker service name for server-side calls
      return 'http://backend:8000';
    }
    return serverUrl;
  }

  // Client-side: use localhost (browser access via Docker port mapping)
  const clientUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!clientUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('NEXT_PUBLIC_API_BASE_URL is not set for production environment');
    }
    // Default to localhost for browser access
    return 'http://localhost:8000';
  }
  return clientUrl;
};

export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
  API_VERSION: 'v1',
  FULL_URL: `${getApiBaseUrl()}/api/v1`,
  ORG_API_BASE: `${getApiBaseUrl()}/api/org`, // Organization-scoped API base
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second (base delay for exponential backoff)
  MAX_RETRY_DELAY: 30000, // 30 seconds (cap for exponential backoff)
  
  // Environment-specific settings
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  
  // Logging configuration
  ENABLE_REQUEST_LOGGING: process.env.NEXT_PUBLIC_ENABLE_REQUEST_LOGGING === 'true', // Opt-in request logging
  ENABLE_ERROR_LOGGING: true, // Always log errors
  
  // Performance settings
  MAX_CONCURRENT_REQUESTS: 10, // Limit concurrent requests to prevent overload
} as const;

// Helper function to build API URLs (returns relative paths for HTTP client)
export const buildApiUrl = (endpoint: string, version?: string) => {
  const apiVersion = version || API_CONFIG.API_VERSION;
  return `/api/${apiVersion}${endpoint}`;
};

// Helper function to build organization-scoped API URLs (returns relative paths for HTTP client)
export const buildOrgApiUrl = (orgSlug: string, endpoint: string) => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `/api/org/${encodeURIComponent(orgSlug)}${cleanEndpoint}`;
};

export const API_ENDPOINTS = {
  // Auth endpoints (organization-agnostic)
  AUTH: {
    USER_BY_CLERK_ID: (clerkId: string) => buildApiUrl(`/auth/user/${clerkId}/`),
    SIGNUP_PROFILE_OPTIONS: buildApiUrl('/auth/signup/profile-options/'),
    LOGOUT: buildApiUrl('/auth/logout/'),
    // DEV_KEYS: buildApiUrl('/auth/dev-keys/'),
  },

  // User endpoints (organization-scoped)
  USERS: {
    LIST: '/users/',
    BY_ID: (id: string) => `/users/${id}/`,
    CREATE: '/users/',
    UPDATE: (id: string) => `/users/${id}/`,
    UPDATE_STAGE: (id: string) => `/users/${id}/stage/`,
    DELETE: (id: string) => `/users/${id}/`,
    ORG_CHART: '/users/org-chart/',
  },

  // Department endpoints
  DEPARTMENTS: {
    LIST: '/departments/',
    BY_ID: (id: string) => `/departments/${id}/`,
    CREATE: '/departments/',
    UPDATE: (id: string) => `/departments/${id}/`,
    DELETE: (id: string) => `/departments/${id}/`,
  },

  // Role endpoints
  ROLES: {
    LIST: '/roles/',
    BY_ID: (id: string) => `/roles/${id}/`,
    CREATE: '/roles/',
    UPDATE: (id: string) => `/roles/${id}/`,
    DELETE: (id: string) => `/roles/${id}/`,
    REORDER: '/roles/reorder/',
  },

  // Stage endpoints
  STAGES: {
    LIST: '/stages/',
    BY_ID: (id: string) => `/stages/${id}/`,
    CREATE: '/stages/',
    UPDATE: (id: string) => `/stages/${id}/`,
    DELETE: (id: string) => `/stages/${id}/`,
    ADMIN: '/stages/admin/',
  },

  // Evaluation Period endpoints
  EVALUATION_PERIODS: {
    LIST: '/evaluation-periods/',
    BY_ID: (id: string) => `/evaluation-periods/${id}/`,
    CREATE: '/evaluation-periods/',
    UPDATE: (id: string) => `/evaluation-periods/${id}/`,
    DELETE: (id: string) => `/evaluation-periods/${id}/`,
    CURRENT: '/evaluation-periods/current/',
    GOAL_STATISTICS: (id: string) => `/evaluation-periods/${id}/goal-statistics/`,
  },

  // Goal endpoints
  GOALS: {
    LIST: '/goals/',
    BY_ID: (id: string) => `/goals/${id}/`,
    CREATE: '/goals/',
    UPDATE: (id: string) => `/goals/${id}/`,
    DELETE: (id: string) => `/goals/${id}/`,
    SUBMIT: (id: string) => `/goals/${id}/submit/`,
    APPROVE: (id: string) => `/goals/${id}/approve/`,
    REJECT: (id: string) => `/goals/${id}/reject/`,
    // BY_USER: (userId: string) => `/goals/user/${userId}/`,
    // BY_PERIOD: (periodId: string) => `/goals/period/${periodId}/`,
  },

  // Goal Category endpoints
  GOAL_CATEGORIES: {
    LIST: '/goal-categories/',
    BY_ID: (id: string) => `/goal-categories/${id}/`,
    CREATE: '/goal-categories/',
    UPDATE: (id: string) => `/goal-categories/${id}/`,
    DELETE: (id: string) => `/goal-categories/${id}/`,
  },

  // Competency endpoints
  COMPETENCIES: {
    LIST: '/competencies/',
    BY_ID: (id: string) => `/competencies/${id}/`,
    CREATE: '/competencies/',
    UPDATE: (id: string) => `/competencies/${id}/`,
    DELETE: (id: string) => `/competencies/${id}/`,
  },

  // Self Assessment endpoints
  SELF_ASSESSMENTS: {
    LIST: '/self-assessments/',
    BY_ID: (id: string) => `/self-assessments/${id}/`,
    CREATE: '/self-assessments/',
    UPDATE: (id: string) => `/self-assessments/${id}/`,
    DELETE: (id: string) => `/self-assessments/${id}/`,
    BY_USER: (userId: string) => `/self-assessments/user/${userId}/`,
    BY_PERIOD: (periodId: string) => `/self-assessments/period/${periodId}/`,
    BY_GOAL: (goalId: string) => `/self-assessments/goal/${goalId}/`,
    SUBMIT: (id: string) => `/self-assessments/${id}/submit/`,
  },

  // Supervisor Review endpoints
  SUPERVISOR_REVIEWS: {
    LIST: '/supervisor-reviews/',
    BY_ID: (id: string) => `/supervisor-reviews/${id}/`,
    CREATE: '/supervisor-reviews/',
    UPDATE: (id: string) => `/supervisor-reviews/${id}/`,
    DELETE: (id: string) => `/supervisor-reviews/${id}/`,
    PENDING: '/supervisor-reviews/pending/',
    SUBMIT: (id: string) => `/supervisor-reviews/${id}/submit/`,
  },

  // Supervisor Feedback endpoints
  SUPERVISOR_FEEDBACKS: {
    LIST: '/supervisor-feedbacks/',
    BY_ID: (id: string) => `/supervisor-feedbacks/${id}/`,
    CREATE: '/supervisor-feedbacks/',
    UPDATE: (id: string) => `/supervisor-feedbacks/${id}/`,
    DELETE: (id: string) => `/supervisor-feedbacks/${id}/`,
    BY_SUPERVISOR: (supervisorId: string) => `/supervisor-feedbacks/supervisor/${supervisorId}/`,
    BY_EMPLOYEE: (employeeId: string) => `/supervisor-feedbacks/employee/${employeeId}/`,
    BY_ASSESSMENT: (assessmentId: string) => `/supervisor-feedbacks/assessment/${assessmentId}/`,
    SUBMIT: (id: string) => `/supervisor-feedbacks/${id}/submit/`,
    DRAFT: (id: string) => `/supervisor-feedbacks/${id}/draft/`,
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