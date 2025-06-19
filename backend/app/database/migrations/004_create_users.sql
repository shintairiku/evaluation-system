CREATE TYPE employment_type_enum AS ENUM ('auditor', 'supervisor', 'employee', 'parttime');
CREATE TYPE user_status_enum AS ENUM ('active', 'inactive');

CREATE TABLE users (
  id UUID PRIMARY KEY,
  department_id UUID REFERENCES departments(id),
  stage_id UUID REFERENCES stages(id),
  clerk_user_id TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  employee_code TEXT UNIQUE NOT NULL,
  employment_type employment_type_enum NOT NULL,
  status user_status_enum NOT NULL,
  password TEXT,
  job_title TEXT,
  hashed_refresh_token TEXT,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);