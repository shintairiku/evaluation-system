-- Migration: Populate display_order values for all competencies
-- Purpose: Set display order (1-6) for competencies based on category pattern
-- Pattern: 1=Philosophy, 2=Attitude, 3=Mindset, 4=Skills, 5=Growth, 6=Management
-- Author: System
-- Date: 2025-10-30
-- Total: 192 competencies (54 org1 FT + 54 org2 FT + 42 org1 PT + 42 org2 PT)

-- ===================================================
-- Philosophy Category (理念) - display_order = 1
-- ===================================================
UPDATE competencies SET display_order = 1
WHERE name IN (
    '理念理解',                    -- Stage 1: 自律自走
    '理念共感',                    -- Stage 2: 自己完結
    '理念の浸透/習得',            -- Stage 3: 品質基準のクリア
    '理念の発信',                  -- Stage 4: 成果創出＆小チームリーダー
    '理念体現',                    -- Stage 5: 成果創出＆チームリーダー
    '理念体現の手本',              -- Stage 6: 成果創出＆部門マネジメント
    '理念体現の支援',              -- Stage 7: 成果創出＆複数部門マネジメント
    '理念の伝播',                  -- Stage 8: 全社マネジメント
    '理念体現の象徴',              -- Stage 9: グループ経営
    '会社理解'                      -- Part-time stages (all 6 stages)
);

-- ===================================================
-- Attitude Category (主体性/誠実) - display_order = 2
-- ===================================================
UPDATE competencies SET display_order = 2
WHERE name IN (
    '積極性',                          -- Stage 1: 自律自走
    '誠実な対応',                      -- Stage 2: 自己完結
    '顧客との信頼構築',                -- Stage 3: 品質基準のクリア
    '目標達成へのコミット（小チーム）',  -- Stage 4: 成果創出＆小チームリーダー
    '目標達成へのコミット（複数チーム）', -- Stage 5: 成果創出＆チームリーダー
    '目標達成へのコミット（部門）',    -- Stage 6: 成果創出＆部門マネジメント
    '目標達成へのコミット',            -- Stage 7: 成果創出＆複数部門マネジメント
    '目標達成へのコミット（全社）',    -- Stage 8: 全社マネジメント
    '目標達成へのコミット（グループ）', -- Stage 9: グループ経営
    '仕事の姿勢'                        -- Part-time stages
);

-- ===================================================
-- Mindset Category (マインド/タフさ) - display_order = 3
-- ===================================================
UPDATE competencies SET display_order = 3
WHERE name IN (
    'ストレスコントロール',        -- Stage 1: 自律自走
    'タフさ',                      -- Stage 2: 自己完結
    '粘り強さ',                    -- Stage 3: 品質基準のクリア
    '他者受容（他者貢献）',        -- Stage 4: 成果創出＆小チームリーダー
    'システム思考（標準化への取り組み）', -- Stage 5: 成果創出＆チームリーダー
    'プロフィット（部門利益へのこだわり）', -- Stage 6: 成果創出＆部門マネジメント
    'ファイナンシャル思考',        -- Stage 7: 成果創出＆複数部門マネジメント
    '事業創出',                    -- Stage 8: 全社マネジメント
    '投資思考',                    -- Stage 9: グループ経営
    '考え方'                        -- Part-time stages
);

-- ===================================================
-- Skills Category (スキル/品質) - display_order = 4
-- ===================================================
UPDATE competencies SET display_order = 4
WHERE name IN (
    '伝達力（コミュニケーション力）',  -- Stage 1: 自律自走
    '品質基準のクリア',                -- Stage 2: 自己完結
    'スペシャリティ（専門分野の確立）', -- Stage 3: 品質基準のクリア
    'ゼロベース思考',                  -- Stage 4: 成果創出＆小チームリーダー
    '企画力',                          -- Stage 5: 成果創出＆チームリーダー
    '企画実行力',                      -- Stage 6: 成果創出＆部門マネジメント
    'ビジネスモデル構築力',            -- Stage 7: 成果創出＆複数部門マネジメント
    'ビジョンを実現する戦略策定',      -- Stage 8: 全社マネジメント
    'グループビジョンを実現する戦略策定', -- Stage 9: グループ経営
    '仕事のスキル'                      -- Part-time stages
);

-- ===================================================
-- Growth Category (成長) - display_order = 5
-- ===================================================
UPDATE competencies SET display_order = 5
WHERE name IN (
    '興味・好奇心',                    -- Stage 1: 自律自走
    '成長意欲',                        -- Stage 2: 自己完結
    '情報の活用と共有化',              -- Stage 3: 品質基準のクリア
    '生産性向上',                      -- Stage 4: 成果創出＆小チームリーダー
    'チームの生産性向上',              -- Stage 5: 成果創出＆チームリーダー
    '部門の生産性向上',                -- Stage 6: 成果創出＆部門マネジメント
    '組織の制度設計',                  -- Stage 7: 成果創出＆複数部門マネジメント (missing from initial list, using actual name)
    'グローバル視点',                  -- Stage 8: 全社マネジメント
    'グローバル構築',                  -- Stage 9: グループ経営
    '成長活動'                          -- Part-time stages
);

-- ===================================================
-- Management Category (マネジメント) - display_order = 6
-- ===================================================
UPDATE competencies SET display_order = 6
WHERE name IN (
    '自己管理（セルフマネジメント初級）',  -- Stage 1: 自律自走
    '他者へのサポート',                    -- Stage 2: 自己完結
    'チームワークの率先',                  -- Stage 3: 品質基準のクリア
    'チームマネジメント',                  -- Stage 4: 成果創出＆小チームリーダー
    '人材育成',                            -- Stage 5: 成果創出＆チームリーダー
    '部門の士気向上',                      -- Stage 6: 成果創出＆部門マネジメント
    '自主性発揮の支援',                    -- Stage 7: 成果創出＆複数部門マネジメント
    'マネジメント人材の育成',              -- Stage 8: 全社マネジメント
    '後継者の育成',                        -- Stage 9: グループ経営
    'マネジメント'                          -- Part-time stages
);

-- Verification queries (commented out - run manually if needed):
-- SELECT COUNT(*) as total_with_order FROM competencies WHERE display_order IS NOT NULL;
-- SELECT s.name as stage, c.name as competency, c.display_order
-- FROM competencies c
-- JOIN stages s ON s.id = c.stage_id
-- WHERE c.organization_id = 'org_32a4qh6ZhszNNK1kW1xyNgYimhZ'
-- ORDER BY s.name, c.display_order;
