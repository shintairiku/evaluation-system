INSERT INTO users (
  id, clerk_user_id, employee_code, name, email, status,
  department_id, stage_id, job_title, created_at, updated_at
) VALUES
('850e8400-e29b-41d4-a716-446655440001', 'user_clerk_admin_1', 'ADM001', '佐藤 管理者', 'admin.sato@example.com', 'active', '650e8400-e29b-41d4-a716-446655440003', '33333333-4444-5555-6666-777777777777', 'システム管理者', NOW(), NOW()),
('123e4567-e89b-12d3-a456-426614174000', 'user_2abcdef1234567890abcdef', 'EMP001', '山田 太郎', 'yamada.taro@company.com', 'active', '650e8400-e29b-41d4-a716-446655440001', '22222222-3333-4444-5555-666666666666', '主任', NOW(), NOW()),
('223e4567-e89b-12d3-a456-426614174001', 'user_3bcdef234567890abcdef12', 'EMP002', '佐藤 花子', 'sato.hanako@company.com', 'active', '650e8400-e29b-41d4-a716-446655440001', '33333333-4444-5555-6666-777777777777', 'マネージャー', NOW(), NOW()),
('333e4567-e89b-12d3-a456-426614174002', 'user_4cdef34567890abcdef123', 'EMP003', '田中 一郎', 'tanaka.ichiro@company.com', 'active', '650e8400-e29b-41d4-a716-446655440002', '11111111-2222-3333-4444-555555555555', NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
