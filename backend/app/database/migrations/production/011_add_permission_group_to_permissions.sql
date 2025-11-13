-- Migration: Add permission_group column and localize permission catalog

BEGIN;

ALTER TABLE permissions
    ADD COLUMN permission_group VARCHAR(64);

WITH localized_permissions(code, permission_group, description) AS (
    VALUES
        ('user:read:all', 'ユーザー', 'すべてのユーザーを閲覧'),
        ('user:read:subordinates', 'ユーザー', '部下ユーザーを閲覧'),
        ('user:read:self', 'ユーザー', '自分のユーザー情報を閲覧'),
        ('user:manage', 'ユーザー', 'ユーザーを管理'),
        ('user:manage:basic', 'ユーザー', '基本ユーザー情報を編集'),
        ('user:manage:plus', 'ユーザー', '基本情報と部下構成を編集'),
        ('hierarchy:manage', 'ユーザー', '階層を管理'),
        ('department:read', '部門', '部門を閲覧'),
        ('department:manage', '部門', '部門を管理'),
        ('role:read:all', 'ロール', 'ロールを閲覧'),
        ('role:manage', 'ロール', 'ロールを管理'),
        ('goal:read:self', '目標', '自分の目標を閲覧'),
        ('goal:read:all', '目標', 'すべての目標を閲覧'),
        ('goal:read:subordinates', '目標', '部下の目標を閲覧'),
        ('goal:manage', '目標', '目標を管理'),
        ('goal:manage:self', '目標', '自分の目標を管理'),
        ('goal:approve', '目標', '目標を承認'),
        ('evaluation:read', '評価', '評価を閲覧'),
        ('evaluation:manage', '評価', '評価を管理'),
        ('evaluation:review', '評価', '評価をレビュー'),
        ('competency:read', 'コンピテンシー', 'コンピテンシーを閲覧'),
        ('competency:read:self', 'コンピテンシー', '自分のコンピテンシーを閲覧'),
        ('competency:manage', 'コンピテンシー', 'コンピテンシーを管理'),
        ('assessment:read:self', '自己評価', '自分の自己評価を閲覧'),
        ('assessment:read:all', '自己評価', 'すべての自己評価を閲覧'),
        ('assessment:read:subordinates', '自己評価', '部下の自己評価を閲覧'),
        ('assessment:manage:self', '自己評価', '自分の自己評価を管理'),
        ('report:access', 'レポート', 'レポートにアクセス'),
        ('stage:read:all', 'ステージ', 'すべてのステージを閲覧'),
        ('stage:read:self', 'ステージ', '自分のステージを閲覧'),
        ('stage:manage', 'ステージ', 'ステージを管理')
)
UPDATE permissions AS p
SET
    permission_group = lp.permission_group,
    description = lp.description
FROM localized_permissions AS lp
WHERE p.code = lp.code;

-- Ensure any remaining permissions, if present, inherit a sensible default
UPDATE permissions
SET permission_group = COALESCE(permission_group, 'その他'),
    description = COALESCE(description, '')
WHERE permission_group IS NULL
   OR description IS NULL;

ALTER TABLE permissions
    ALTER COLUMN permission_group SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_permissions_group_code
    ON permissions(permission_group, code);

COMMIT;
