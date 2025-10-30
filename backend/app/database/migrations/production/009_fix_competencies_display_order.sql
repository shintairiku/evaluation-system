-- Migration: Fix display_order values for all competencies (correction)
-- Purpose: Update display_order for competencies in Stages 3-9 and part-time stages that were missed in migration 007
-- Author: System
-- Date: 2025-10-30
-- Note: Migration 007 only covered ~46 competencies. This fixes the remaining ~134 competencies.

-- ===================================================
-- Philosophy Category (理念) - display_order = 1
-- ===================================================
-- Stage 3-9 full-time + part-time stages
UPDATE competencies SET display_order = 1
WHERE display_order IS NULL AND name IN (
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
-- Stage 3-9 full-time + part-time stages
UPDATE competencies SET display_order = 2
WHERE display_order IS NULL AND name IN (
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
-- Stage 3-9 full-time + part-time stages
UPDATE competencies SET display_order = 3
WHERE display_order IS NULL AND name IN (
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
-- Stage 3-9 full-time + part-time stages
UPDATE competencies SET display_order = 4
WHERE display_order IS NULL AND name IN (
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
-- Stage 3-9 full-time + part-time stages
UPDATE competencies SET display_order = 5
WHERE display_order IS NULL AND name IN (
    '情報の活用と共有化',              -- Stage 3: 品質基準のクリア
    '生産性向上',                      -- Stage 4: 成果創出＆小チームリーダー
    'チームの生産性向上',              -- Stage 5: 成果創出＆チームリーダー
    '部門の生産性向上',                -- Stage 6: 成果創出＆部門マネジメント
    '組織の制度設計',                  -- Stage 7: 成果創出＆複数部門マネジメント
    'グローバル視点',                  -- Stage 8: 全社マネジメント
    'グローバル構築',                  -- Stage 9: グループ経営
    '成長活動'                          -- Part-time stages
);

-- ===================================================
-- Management Category (マネジメント) - display_order = 6
-- ===================================================
-- Stage 3-9 full-time + part-time stages
UPDATE competencies SET display_order = 6
WHERE display_order IS NULL AND name IN (
    'チームワークの率先',                  -- Stage 3: 品質基準のクリア
    'チームマネジメント',                  -- Stage 4: 成果創出＆小チームリーダー
    '人材育成',                            -- Stage 5: 成果創出＆チームリーダー
    '部門の士気向上',                      -- Stage 6: 成果創出＆部門マネジメント
    '自主性発揮の支援',                    -- Stage 7: 成果創出＆複数部門マネジメント
    'マネジメント人材の育成',              -- Stage 8: 全社マネジメント
    '後継者の育成',                        -- Stage 9: グループ経営
    'マネジメント'                          -- Part-time stages
);

-- Verification: All competencies should now have display_order
-- Expected: 180 competencies total (90 org1 + 90 org2)
-- SELECT COUNT(*) as total_competencies,
--        COUNT(display_order) as with_display_order,
--        COUNT(*) - COUNT(display_order) as missing_display_order
-- FROM competencies;
