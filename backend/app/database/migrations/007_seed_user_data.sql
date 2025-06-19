INSERT INTO roles (id, name, description) VALUES 
(1, 'admin', 'System administrator with full access'),
(2, 'supervisor', 'Department supervisor with management rights'), 
(3, 'employee', 'Regular employee with basic access'),
(4, 'viewer', 'Read-only access for reports and viewing')
ON CONFLICT (id) DO NOTHING;

-- Insert default departments
INSERT INTO departments (id, name, description) VALUES 
('dept-001-sales', 'Sales', 'Sales and business development department'),
('dept-002-engineering', 'Engineering', 'Software engineering and development'),
('dept-003-hr', 'Human Resources', 'HR and people operations'),
('dept-004-marketing', 'Marketing', 'Marketing and communications')
ON CONFLICT (id) DO NOTHING;

-- Insert default career stages
INSERT INTO stages (id, name, description) VALUES 
('stage-001-newbie', 'S1 - New Employee', 'Newly hired employees (0-1 year)'),
('stage-002-intermediate', 'S2 - Intermediate', 'Intermediate level employees (1-3 years)'),
('stage-003-senior', 'S3 - Senior', 'Senior level employees (3-5 years)'),
('stage-004-manager', 'S4 - Manager', 'Management level (5+ years)')
ON CONFLICT (id) DO NOTHING;

-- Insert sample users
INSERT INTO users (id, clerk_user_id, employee_code, name, email, employment_type, status, department_id, stage_id, job_title, created_at, updated_at) VALUES
('user-001-admin', 'user_clerk_admin_1', 'ADM001', '佐藤 管理者', 'admin.sato@example.com', 'auditor', 'active', 'dept-003-hr', 'stage-004-manager', 'システム管理者', NOW(), NOW()),
('user-002-supervisor', 'user_clerk_supervisor_1', 'EMP001', '山田 太郎', 'taro.yamada@example.com', 'supervisor', 'active', 'dept-002-engineering', 'stage-004-manager', '開発部長', NOW(), NOW()),
('user-003-employee', 'user_clerk_employee_1', 'EMP002', '田中 花子', 'hanako.tanaka@example.com', 'employee', 'active', 'dept-002-engineering', 'stage-002-intermediate', 'ソフトウェアエンジニア', NOW(), NOW()),
('user-004-employee', 'user_clerk_employee_2', 'EMP003', '鈴木 次郎', 'jiro.suzuki@example.com', 'employee', 'active', 'dept-001-sales', 'stage-003-senior', '営業担当', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert user roles
INSERT INTO user_roles (user_id, role_id) VALUES
('user-001-admin', 1),
('user-002-supervisor', 2),
('user-003-employee', 3),
('user-004-employee', 3)
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Insert supervisor relationships
INSERT INTO users_supervisors (user_id, supervisor_id, valid_from, created_at, updated_at) VALUES
('user-003-employee', 'user-002-supervisor', '2024-01-01', NOW(), NOW()),
('user-004-employee', 'user-002-supervisor', '2024-01-01', NOW(), NOW())
ON CONFLICT (user_id, supervisor_id) DO NOTHING;