-- Insert default roles (smallint id as per schema)
INSERT INTO roles (id, name, description) VALUES 
(1, 'admin', 'System administrator with full access'),
(2, 'supervisor', 'Department supervisor with management rights'), 
(3, 'employee', 'Regular employee with basic access'),
(4, 'viewer', 'Read-only access for reports and viewing')
ON CONFLICT (id) DO NOTHING;

-- Insert default departments (uuid id as per schema)
INSERT INTO departments (id, name, description) VALUES 
('650e8400-e29b-41d4-a716-446655440001', 'Sales', 'Sales and business development department'),
('650e8400-e29b-41d4-a716-446655440002', 'Engineering', 'Software engineering and development'),
('650e8400-e29b-41d4-a716-446655440003', 'Human Resources', 'HR and people operations'),
('650e8400-e29b-41d4-a716-446655440004', 'Marketing', 'Marketing and communications')
ON CONFLICT (id) DO NOTHING;

-- Insert default career stages (uuid id as per schema)
INSERT INTO stages (id, name, description) VALUES 
('11111111-2222-3333-4444-555555555555', '新入社員', '入社1-2年目の社員'),
('22222222-3333-4444-5555-666666666666', '中堅社員', '入社3-7年目の中核となる社員'),
('33333333-4444-5555-6666-777777777777', '管理職', 'チームをマネジメントする管理職')
ON CONFLICT (id) DO NOTHING;

-- Insert sample users (uuid id as per schema)
-- Note: Using correct employment_type_enum values
INSERT INTO users (id, clerk_user_id, employee_code, name, email, employment_type, status, department_id, stage_id, job_title, created_at, updated_at) VALUES
('850e8400-e29b-41d4-a716-446655440001', 'user_clerk_admin_1', 'ADM001', '佐藤 管理者', 'admin.sato@example.com', 'auditor', 'active', '650e8400-e29b-41d4-a716-446655440003', '33333333-4444-5555-6666-777777777777', 'システム管理者', NOW(), NOW()),
('123e4567-e89b-12d3-a456-426614174000', 'user_2abcdef1234567890abcdef', 'EMP001', '山田 太郎', 'yamada.taro@company.com', 'employee', 'active', '650e8400-e29b-41d4-a716-446655440001', '22222222-3333-4444-5555-666666666666', '主任', NOW(), NOW()),
('223e4567-e89b-12d3-a456-426614174001', 'user_3bcdef234567890abcdef12', 'EMP002', '佐藤 花子', 'sato.hanako@company.com', 'supervisor', 'active', '650e8400-e29b-41d4-a716-446655440001', '33333333-4444-5555-6666-777777777777', 'マネージャー', NOW(), NOW()),
('333e4567-e89b-12d3-a456-426614174002', 'user_4cdef34567890abcdef123', 'EMP003', '田中 一郎', 'tanaka.ichiro@company.com', 'employee', 'active', '650e8400-e29b-41d4-a716-446655440002', '11111111-2222-3333-4444-555555555555', NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert user roles (uuid user_id, smallint role_id as per schema)
INSERT INTO user_roles (user_id, role_id) VALUES
('850e8400-e29b-41d4-a716-446655440001', 1),
('123e4567-e89b-12d3-a456-426614174000', 3),
('223e4567-e89b-12d3-a456-426614174001', 2),
('333e4567-e89b-12d3-a456-426614174002', 3)
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Insert supervisor relationships (uuid for both user_id and supervisor_id)
INSERT INTO users_supervisors (user_id, supervisor_id, valid_from, created_at, updated_at) VALUES
('123e4567-e89b-12d3-a456-426614174000', '223e4567-e89b-12d3-a456-426614174001', '2024-01-01', NOW(), NOW()),
('333e4567-e89b-12d3-a456-426614174002', '223e4567-e89b-12d3-a456-426614174001', '2024-01-01', NOW(), NOW())
ON CONFLICT (user_id, supervisor_id) DO NOTHING;