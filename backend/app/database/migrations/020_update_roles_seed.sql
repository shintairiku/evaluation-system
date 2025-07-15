-- Update default roles with Japanese names and descriptions
INSERT INTO roles (id, name, description) VALUES 
(1, 'admin', '管理者'),
(2, 'manager', '部門マネジャー'), 
(3, 'supervisor', '上司'), 
(4, 'employee', '従業員'),
(5, 'viewer', '閲覧者')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description; 