-- Insert evaluation periods
INSERT INTO evaluation_periods (id, name, period_type, start_date, end_date, goal_submission_deadline, evaluation_deadline, status, created_at, updated_at) VALUES
('a1b2c3d4-e5f6-7890-1234-56789abcdef0', '2024年第1四半期', 'quarterly', '2024-01-01', '2024-03-31', '2024-01-31', '2024-04-15', 'active', NOW(), NOW()),
('b2c3d4e5-f6g7-8901-2345-6789abcdef01', '2024年上半期', 'half-term', '2024-01-01', '2024-06-30', '2024-02-29', '2024-07-15', 'active', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert sample self assessments
INSERT INTO self_assessments (id, goal_id, period_id, self_rating, self_comment, status, submitted_at, created_at, updated_at) VALUES
('sa-11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-1234-56789abcdef0', 85, '新規機能の開発を計画通りに完了させ、品質も担保できた。チーム内での連携もスムーズに進み、予定より早く完成させることができました。', 'submitted', '2024-01-25 10:00:00', NOW(), NOW()),
('sa-22222222-1111-1111-1111-111111111111', '22222222-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-1234-56789abcdef0', 75, '月次売上目標は概ね達成できていますが、月によってばらつきがありました。顧客別売上予測の精度向上に取り組んでおり、下半期はより安定した成果を目指します。', 'submitted', '2024-01-26 14:30:00', NOW(), NOW()),
('sa-44444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', 'a1b2c3d4-e5f6-7890-1234-56789abcdef0', 85, '問題解決能力の向上に積極的に取り組みました。複雑な技術課題に対して体系的なアプローチで解決策を導くことができ、チーム内での知見共有も実践できました。', 'submitted', '2024-01-27 16:00:00', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert supervisor feedback
INSERT INTO supervisor_feedback (id, self_assessment_id, period_id, supervisor_id, rating, comment, status, submitted_at, created_at, updated_at) VALUES
('sf-11111111-1111-1111-1111-111111111111', 'sa-11111111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-1234-56789abcdef0', '223e4567-e89b-12d3-a456-426614174001', 90, '期待を上回る成果を達成しました。特に、技術的課題への対応が見事で、チームメンバーのモチベーション向上にも貢献しています。今後も継続してください。', 'submitted', '2024-02-02 15:00:00', NOW(), NOW()),
('sf-22222222-1111-1111-1111-111111111111', 'sa-22222222-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-1234-56789abcdef0', '223e4567-e89b-12d3-a456-426614174001', 80, '売上目標達成に向けた努力は評価できます。予測精度の向上施策を継続し、より安定した成果を期待しています。顧客との関係構築も良好です。', 'submitted', '2024-02-03 11:30:00', NOW(), NOW()),
('sf-44444444-4444-4444-4444-444444444444', 'sa-44444444-4444-4444-4444-444444444444', 'a1b2c3d4-e5f6-7890-1234-56789abcdef0', '223e4567-e89b-12d3-a456-426614174001', 88, '問題解決能力の向上が顕著に見られます。体系的なアプローチと知見共有の取り組みは素晴らしく、他のメンバーにも良い影響を与えています。', 'submitted', '2024-02-04 09:45:00', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;