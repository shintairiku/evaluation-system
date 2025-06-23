-- ===================================================
-- SQL SEEDS - CORRECT INSERTION ORDER
-- ===================================================

-- 1. FIRST: Insert goal categories (no dependencies)
INSERT INTO goal_categories (id, name) VALUES
(1, 'performance'),
(2, 'competency'),
(3, 'core_value')
ON CONFLICT (id) DO NOTHING;

-- 2. SECOND: Insert evaluation periods (no dependencies)
INSERT INTO evaluation_periods (id, name, period_type, start_date, end_date, goal_submission_deadline, evaluation_deadline, status, created_at, updated_at) VALUES 
('a1b2c3d4-e5f6-7890-1234-56789abcdef0', '2024年第1四半期', 'quarterly', '2024-01-01', '2024-03-31', '2024-01-31', '2024-04-15', 'active', NOW(), NOW()),
('b2c3d4e5-f6a7-8901-2345-6789abcdef01', '2024年上半期', 'half-term', '2024-01-01', '2024-06-30', '2024-02-29', '2024-07-15', 'active', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 3. THIRD: Insert sample performance goals (depends on: users, evaluation_periods, goal_categories)
INSERT INTO goals (id, user_id, period_id, goal_category_id, target_data, weight, status, created_at, updated_at) VALUES
('11111111-1111-1111-1111-111111111111', '333e4567-e89b-12d3-a456-426614174002', 'a1b2c3d4-e5f6-7890-1234-56789abcdef0', 1, 
'{"performance_goal_type": "quantitative", "specific_goal_text": "新規機能開発において、バグ発生率を前期比30%削減する", "achievement_criteria_text": "リリース後1ヶ月以内のバグ報告数が前期比30%以下。品質管理システムで測定。", "means_methods_text": "コードレビューの強化、ユニットテストカバレッジ90%以上の維持、テスト駆動開発の実践。"}', 
30, 'approved', NOW(), NOW()),

('22222222-1111-1111-1111-111111111111', '123e4567-e89b-12d3-a456-426614174000', 'a1b2c3d4-e5f6-7890-1234-56789abcdef0', 1,
'{"performance_goal_type": "quantitative", "specific_goal_text": "月次売上目標1200万円を毎月達成する", "achievement_criteria_text": "月末時点での売上実績が1200万円以上。四半期平均で1200万円を維持。", "means_methods_text": "顧客別売上予測の精度向上、月中での進捗確認と軌道修正、既存顧客への追加受注活動。"}', 
35, 'approved', NOW(), NOW()),

('33333333-1111-1111-1111-111111111111', '123e4567-e89b-12d3-a456-426614174000', 'a1b2c3d4-e5f6-7890-1234-56789abcdef0', 1,
'{"performance_goal_type": "qualitative", "specific_goal_text": "顧客満足度調査で平均4.5点以上を獲得する", "achievement_criteria_text": "四半期ごとの顧客満足度アンケートで5点満点中4.5点以上。回答率70%以上を維持。", "means_methods_text": "定期的な顧客訪問とヒアリング強化、課題解決までの迅速な対応体制構築。"}', 
30, 'approved', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 4. FOURTH: Insert sample competency goals (depends on: users, evaluation_periods, goal_categories)
INSERT INTO goals (id, user_id, period_id, goal_category_id, target_data, weight, status, created_at, updated_at) VALUES
('44444444-4444-4444-4444-444444444444', '333e4567-e89b-12d3-a456-426614174002', 'a1b2c3d4-e5f6-7890-1234-56789abcdef0', 2,
'{"competency_id": "cccccccc-dddd-eeee-ffff-333333333333", "action_plan": "複雑な技術課題に対して、体系的なアプローチで解決策を導く能力を向上させる。週1回のテックトークで知見共有、月1回の技術勉強会を主催する。四半期ごとに問題解決事例をまとめ、チーム内で共有する。"}', 
100, 'approved', NOW(), NOW()),

('55555555-5555-5555-5555-555555555555', '223e4567-e89b-12d3-a456-426614174001', 'a1b2c3d4-e5f6-7890-1234-56789abcdef0', 2,
'{"competency_id": "bbbbbbbb-cccc-dddd-eeee-222222222222", "action_plan": "部下のキャリア開発計画を個別に策定し、月1回の1on1面談で進捗確認とフィードバックを実施する。チーム目標達成に向けた戦略立案と実行管理を通じて、リーダーシップスキルを向上させる。"}', 
100, 'pending_approval', NOW(), NOW()),

('66666666-6666-6666-6666-666666666666', '123e4567-e89b-12d3-a456-426614174000', 'a1b2c3d4-e5f6-7890-1234-56789abcdef0', 2,
'{"competency_id": "aaaaaaaa-bbbb-cccc-dddd-111111111111", "action_plan": "チーム内での連携を強化し、協調性を向上させる。週次ミーティングでの積極的な意見交換、他部署との連携プロジェクトへの参加、チームの課題解決に向けた提案を行う。"}', 
100, 'approved', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 5. FIFTH: Insert sample core value goals (depends on: users, evaluation_periods, goal_categories)
INSERT INTO goals (id, user_id, period_id, goal_category_id, target_data, weight, status, created_at, updated_at) VALUES
('77777777-7777-7777-7777-777777777777', '333e4567-e89b-12d3-a456-426614174002', 'a1b2c3d4-e5f6-7890-1234-56789abcdef0', 3,
'{"core_value_theme": "誠実性と責任感", "action_plan": "プロジェクトにおいて約束した期限とクオリティを必ず守る。問題が発生した場合は迅速に報告し、解決策を提案する。チームメンバーとの約束も含め、すべてのコミットメントに対して責任を持って取り組む。"}', 
100, 'approved', NOW(), NOW()),

('88888888-8888-8888-8888-888888888888', '123e4567-e89b-12d3-a456-426614174000', 'a1b2c3d4-e5f6-7890-1234-56789abcdef0', 3,
'{"core_value_theme": "継続的な学習と成長", "action_plan": "業務に関連する新しい知識やスキルの習得に積極的に取り組む。月1回の勉強会参加、業界動向のキャッチアップ、学んだ内容のチーム内共有を継続的に実施する。"}', 
100, 'approved', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 6. SIXTH: Insert sample supervisor reviews (depends on: goals, evaluation_periods, users)
INSERT INTO supervisor_reviews (id, goal_id, period_id, supervisor_id, action, comment, status, reviewed_at, created_at, updated_at) VALUES
('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-1234-56789abcdef0', '223e4567-e89b-12d3-a456-426614174001', 'APPROVED', '目標設定が具体的で測定可能です。バグ削減の取り組みは品質向上に直結する重要な目標であり、実行計画も適切です。', 'submitted', '2024-01-20 11:00:00', NOW(), NOW()),

('b4444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', 'a1b2c3d4-e5f6-7890-1234-56789abcdef0', '223e4567-e89b-12d3-a456-426614174001', 'APPROVED', '問題解決能力向上の計画は素晴らしいです。技術勉強会の主催は他のメンバーにも良い影響を与えるでしょう。', 'submitted', '2024-01-21 09:30:00', NOW(), NOW()),

('c5555555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555', 'a1b2c3d4-e5f6-7890-1234-56789abcdef0', '850e8400-e29b-41d4-a716-446655440001', 'PENDING', 'リーダーシップ向上の取り組みは評価できますが、より具体的な成果指標を設定してください。1on1の頻度や効果測定方法を明確にしましょう。', 'submitted', '2024-01-22 14:15:00', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 7. SEVENTH: Insert sample self assessments (depends on: goals, evaluation_periods)
INSERT INTO self_assessments (id, goal_id, period_id, self_rating, self_comment, status, submitted_at, created_at, updated_at) VALUES 
('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-1234-56789abcdef0', 85, '新規機能の開発を計画通りに完了させ、品質も担保できた。チーム内での連携もスムーズに進み、予定より早く完成させることができました。', 'submitted', '2024-01-25 10:00:00', NOW(), NOW()),

('22222222-1111-1111-1111-111111111111', '22222222-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-1234-56789abcdef0', 75, '月次売上目標は概ね達成できていますが、月によってばらつきがありました。顧客別売上予測の精度向上に取り組んでおり、下半期はより安定した成果を目指します。', 'submitted', '2024-01-26 14:30:00', NOW(), NOW()),

('44444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', 'a1b2c3d4-e5f6-7890-1234-56789abcdef0', 85, '問題解決能力の向上に積極的に取り組みました。複雑な技術課題に対して体系的なアプローチで解決策を導くことができ、チーム内での知見共有も実践できました。', 'submitted', '2024-01-27 16:00:00', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 8. EIGHTH: Insert supervisor feedback (depends on: self_assessments, evaluation_periods, users)
INSERT INTO supervisor_feedback (id, self_assessment_id, period_id, supervisor_id, rating, comment, status, submitted_at, created_at, updated_at) VALUES 
('d1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-1234-56789abcdef0', '223e4567-e89b-12d3-a456-426614174001', 90, '期待を上回る成果を達成しました。特に、技術的課題への対応が見事で、チームメンバーのモチベーション向上にも貢献しています。今後も継続してください。', 'submitted', '2024-02-02 15:00:00', NOW(), NOW()),

('e2222222-1111-1111-1111-111111111111', '22222222-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-1234-56789abcdef0', '223e4567-e89b-12d3-a456-426614174001', 80, '売上目標達成に向けた努力は評価できます。予測精度の向上施策を継続し、より安定した成果を期待しています。顧客との関係構築も良好です。', 'submitted', '2024-02-03 11:30:00', NOW(), NOW()),

('f4444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', 'a1b2c3d4-e5f6-7890-1234-56789abcdef0', '223e4567-e89b-12d3-a456-426614174001', 88, '問題解決能力の向上が顕著に見られます。体系的なアプローチと知見共有の取り組みは素晴らしく、他のメンバーにも良い影響を与えています。', 'submitted', '2024-02-04 09:45:00', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ===================================================
-- DEPENDENCY ORDER SUMMARY:
-- ===================================================
-- 1. goal_categories (independent)
-- 2. evaluation_periods (independent)
-- 3. goals (depends on: users, evaluation_periods, goal_categories)
-- 4. supervisor_reviews (depends on: goals, evaluation_periods, users)
-- 5. self_assessments (depends on: goals, evaluation_periods)
-- 6. supervisor_feedback (depends on: self_assessments, evaluation_periods, users)
-- ===================================================