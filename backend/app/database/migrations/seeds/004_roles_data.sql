

-- Insert system roles (required for RBAC)
INSERT INTO roles (id, name, description, hierarchy_order, organization_id) VALUES
('10000000-0000-0000-0000-000000000001', 'admin', '管理者', 1, 'org_32a4qh6ZhszNNK1kW1xyNgYimhZ'),
('10000000-0000-0000-0000-000000000002', 'manager', '部門マネジャー', 2, 'org_32a4qh6ZhszNNK1kW1xyNgYimhZ'),
('10000000-0000-0000-0000-000000000003', 'supervisor', '上司', 3, 'org_32a4qh6ZhszNNK1kW1xyNgYimhZ'),
('10000000-0000-0000-0000-000000000004', 'employee', '従業員', 4, 'org_32a4qh6ZhszNNK1kW1xyNgYimhZ'),
('10000000-0000-0000-0000-000000000005', 'viewer', '閲覧者', 5, 'org_32a4qh6ZhszNNK1kW1xyNgYimhZ'),
('10000000-0000-0000-0000-000000000006', 'parttime', 'パートタイム', 6, 'org_32a4qh6ZhszNNK1kW1xyNgYimhZ'),
('20000000-0000-0000-0000-000000000001', 'admin', '管理者', 1, 'org_32lvjKZKHDCKVmRhMhNx4mfP3c5'),
('20000000-0000-0000-0000-000000000002', 'manager', '部門マネジャー', 2, 'org_32lvjKZKHDCKVmRhMhNx4mfP3c5'),
('20000000-0000-0000-0000-000000000003', 'supervisor', '上司', 3, 'org_32lvjKZKHDCKVmRhMhNx4mfP3c5'),
('20000000-0000-0000-0000-000000000004', 'employee', '従業員', 4, 'org_32lvjKZKHDCKVmRhMhNx4mfP3c5'),
('20000000-0000-0000-0000-000000000005', 'viewer', '閲覧者', 5, 'org_32lvjKZKHDCKVmRhMhNx4mfP3c5'),
('20000000-0000-0000-0000-000000000006', 'parttime', 'パートタイム', 6, 'org_32lvjKZKHDCKVmRhMhNx4mfP3c5')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, hierarchy_order = EXCLUDED.hierarchy_order, organization_id = EXCLUDED.organization_id;
