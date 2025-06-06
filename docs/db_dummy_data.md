### Users（ユーザー情報）
```json
{
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "clerk_user_id": "user_2abcdef1234567890abcdef",
    "employee_code": "EMP001",
    "name": "山田 太郎",
    "email": "yamada.taro@company.com",
    "employment_type": "employee",
    "status": "active",
    "password": null,
    "department_id": "dept-001-sales",
    "stage_id": "22222222-3333-4444-5555-666666666666",  // 中堅社員
    "job_title": "主任",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-15T09:00:00.000Z",
    "lastLoginAt": "2024-01-15T08:30:00.000Z"
}

{
    "id": "223e4567-e89b-12d3-a456-426614174001",
    "clerk_user_id": "user_3bcdef234567890abcdef12",
    "employee_code": "EMP002",
    "name": "佐藤 花子",
    "email": "sato.hanako@company.com",
    "employment_type": "supervisor",
    "status": "active",
    "password": null,
    "department_id": "dept-001-sales",
    "stage_id": "33333333-4444-5555-6666-777777777777",  // 管理職
    "job_title": "マネージャー",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-16T11:00:00.000Z",
    "lastLoginAt": "2024-01-16T10:45:00.000Z"
}

{
    "id": "333e4567-e89b-12d3-a456-426614174002",
    "clerk_user_id": "user_4cdef34567890abcdef123",
    "employee_code": "EMP003",
    "name": "田中 一郎",
    "email": "tanaka.ichiro@company.com",
    "employment_type": "employee",
    "status": "active",
    "password": null,
    "department_id": "dept-002-engineering",
    "stage_id": "11111111-2222-3333-4444-555555555555",  // 新入社員
    "job_title": null,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-16T13:00:00.000Z",
    "lastLoginAt": "2024-01-16T12:30:00.000Z"
}
```

### Stages（ステージ情報）
```json
{
    "id": "11111111-2222-3333-4444-555555555555",
    "name": "新入社員",
    "description": "入社1-2年目の社員",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
}

{
    "id": "22222222-3333-4444-5555-666666666666",
    "name": "中堅社員",
    "description": "入社3-7年目の中核となる社員",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
}

{
    "id": "33333333-4444-5555-6666-777777777777",
    "name": "管理職",
    "description": "チームをマネジメントする管理職",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
}
```

### Competencies（コンピテンシー情報）
```json
{
    "id": "aaaaaaaa-bbbb-cccc-dddd-111111111111",
    "name": "チームワーク・協調性",
    "description": "チーム内での協調性と連携能力",
    "stage_id": "22222222-3333-4444-5555-666666666666",  // 中堅社員
    "default_weight": 100,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
}

{
    "id": "bbbbbbbb-cccc-dddd-eeee-222222222222",
    "name": "リーダーシップ",
    "description": "チームを牽引し成果を出すリーダーシップ",
    "stage_id": "33333333-4444-5555-6666-777777777777",  // 管理職
    "default_weight": 100,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
}

{
    "id": "cccccccc-dddd-eeee-ffff-333333333333",
    "name": "問題解決能力",
    "description": "課題を特定し解決策を立案・実行する能力",
    "stage_id": "11111111-2222-3333-4444-555555555555",  // 新入社員
    "default_weight": 100,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
}

{
    "id": "dddddddd-eeee-ffff-1111-444444444444",
    "name": "コミュニケーション能力",
    "description": "効果的な意思疎通と情報共有",
    "stage_id": "22222222-3333-4444-5555-666666666666",  // 中堅社員
    "default_weight": 100,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
}

{
    "id": "eeeeeeee-ffff-1111-2222-555555555555",
    "name": "戦略的思考",
    "description": "長期的視点で戦略を立案・実行する能力",
    "stage_id": "33333333-4444-5555-6666-777777777777",  // 管理職
    "default_weight": 100,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
}

{
    "id": "ffffffff-1111-2222-3333-666666666666",
    "name": "学習意欲・適応力",
    "description": "新しい知識・スキルの習得と変化への適応",
    "stage_id": "11111111-2222-3333-4444-555555555555",  // 新入社員
    "default_weight": 100,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
}
```

### Goals（目標）
```json
// 業績目標
{
    "id": "11111111-1111-1111-1111-111111111111",
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "period_id": "a1b2c3d4-e5f6-7890-1234-56789abcdef0",
    "goal_category_id": 1,  // goal_categories.id
    "target_data": {
        "performance_goal_type": "quantitative", 
        "specific_goal_text": "新規顧客獲得数を前期比150%にする",
        "achievement_criteria_text": "CRMシステム上で確認できる新規契約顧客数が、指定期間内に目標数を達成した場合。見込み客リストからの転換率も参考指標とする。",
        "means_methods_text": "週次のターゲットリスト見直し会議を実施。新しいマーケティングチャネル（例: SNS広告）を試験導入。既存顧客への紹介キャンペーンを展開。"
    },
    "weight": 25,  // この個別目標の重み（業績目標の場合、同一期間の合計が100%）
    "status": "draft",  // draft: 下書き、pending_approval: 提出済み・承認待ち、approved: 承認済み、rejected: 差し戻し
    "approved_by": null,
    "approved_at": null,
    "created_at": "2024-01-15T09:00:00.000Z",
    "updated_at": "2024-01-15T09:00:00.000Z"
}

{
    "id": "22222222-1111-1111-1111-111111111111",
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "period_id": "a1b2c3d4-e5f6-7890-1234-56789abcdef0",
    "goal_category_id": 1,
    "target_data": {
        "performance_goal_type": "quantitative",
        "specific_goal_text": "月次売上目標1500万円を毎月達成する",
        "achievement_criteria_text": "月末時点での売上実績が1500万円以上。四半期平均で1500万円を維持。売上管理システムでの数値確認により判定。",
        "means_methods_text": "顧客別売上予測の精度向上。月中での進捗確認と軌道修正。高単価商品の提案強化。既存顧客への追加受注活動。"
    },
    "weight": 25,
    "status": "draft",
    "approved_by": null,
    "approved_at": null,
    "created_at": "2024-01-15T09:15:00.000Z",
    "updated_at": "2024-01-15T09:15:00.000Z"
}

{
    "id": "33333333-1111-1111-1111-111111111111",
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "period_id": "a1b2c3d4-e5f6-7890-1234-56789abcdef0",
    "goal_category_id": 1,
    "target_data": {
        "performance_goal_type": "qualitative",
        "specific_goal_text": "顧客満足度調査で平均4.5点以上を獲得する",
        "achievement_criteria_text": "四半期ごとの顧客満足度アンケートで5点満点中4.5点以上。回答率70%以上を維持。苦情件数を前期比50%削減。",
        "means_methods_text": "顧客対応マニュアルの見直しと改善。定期的な顧客訪問とヒアリング強化。課題解決までの迅速な対応体制構築。顧客フィードバックの社内共有システム構築。"
    },
    "weight": 25,
    "status": "draft",
    "approved_by": null,
    "approved_at": null,
    "created_at": "2024-01-15T09:30:00.000Z",
    "updated_at": "2024-01-15T09:30:00.000Z"
}

{
    "id": "44444444-1111-1111-1111-111111111111",
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "period_id": "a1b2c3d4-e5f6-7890-1234-56789abcdef0",
    "goal_category_id": 1,
    "target_data": {
        "performance_goal_type": "qualitative",
        "specific_goal_text": "チーム内コミュニケーション改善により生産性を向上させる",
        "achievement_criteria_text": "チーム内アンケートでコミュニケーション満足度4.0点以上。会議効率化により会議時間を20%短縮。情報共有の遅延をゼロにする。",
        "means_methods_text": "定期的なチームビルディング活動の実施。情報共有ツールの導入と活用促進。会議のファシリテーションスキル向上。チーム内の1on1面談定期実施。"
    },
    "weight": 25,
    "status": "draft",
    "approved_by": null,
    "approved_at": null,
    "created_at": "2024-01-15T09:45:00.000Z",
    "updated_at": "2024-01-15T09:45:00.000Z"
}

// コンピテンシー目標
{
    "id": "44444444-4444-4444-4444-444444444444",
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "period_id": "a1b2c3d4-e5f6-7890-1234-56789abcdef0",
    "goal_category_id": 2,  // goal_categories.id (コンピテンシー)
    "target_data": {
        "competency_id": "aaaaaaaa-bbbb-cccc-dddd-111111111111",  // competencies.idを参照し、competencies.nameを表示する必要あり。
        "action_plan": "週1回のチームミーティングを主導し、メンバー間の意見調整役として積極的に関わる。建設的な議論を促進し、チーム全体の連携強化を図る。四半期ごとにチーム内アンケートを実施し、協調性向上の取り組み効果を測定・改善する。"
    },
    "weight": 100,  // コンピテンシーは固定100%
    "status": "draft",
    "approved_by": null,
    "approved_at": null,
    "created_at": "2024-01-15T10:00:00.000Z",
    "updated_at": "2024-01-15T10:00:00.000Z"
}

{
    "id": "55555555-5555-5555-5555-555555555555",
    "user_id": "223e4567-e89b-12d3-a456-426614174001",
    "period_id": "a1b2c3d4-e5f6-7890-1234-56789abcdef0",
    "goal_category_id": 2,
    "target_data": {
        "competency_id": "bbbbbbbb-cccc-dddd-eeee-222222222222",  // 管理職ステージ用
        "action_plan": "部下のキャリア開発計画を個別に策定し、月1回の1on1面談で進捗確認とフィードバックを実施する。新人メンター制度を導入し、部門全体のスキル向上を図る。チーム目標達成に向けた戦略立案と実行管理を通じて、リーダーシップスキルを向上させる。"
    },
    "weight": 100,
    "status": "pending_approval",
    "approved_by": null,
    "approved_at": null,
    "created_at": "2024-01-16T11:00:00.000Z",
    "updated_at": "2024-01-16T15:30:00.000Z"
}

{
    "id": "66666666-6666-6666-6666-666666666666",
    "user_id": "333e4567-e89b-12d3-a456-426614174002",
    "period_id": "a1b2c3d4-e5f6-7890-1234-56789abcdef0",
    "goal_category_id": 2,
    "target_data": {
        "competency_id": "cccccccc-dddd-eeee-ffff-333333333333",  // 新入社員ステージ用
        "action_plan": "業務で発生した課題について、原因分析から解決策立案まで体系的にアプローチする手法を身につける。月2回の事例検討会に参加し、様々な問題解決パターンを学習する。先輩社員とのペアワークを通じて実践的なスキルを習得し、問題解決プロセスを体系化する。"
    },
    "weight": 100,
    "status": "approved",
    "approved_by": "777e4567-e89b-12d3-a456-426614174003",
    "approved_at": "2024-01-17T09:30:00.000Z",
    "created_at": "2024-01-16T13:00:00.000Z",
    "updated_at": "2024-01-17T09:30:00.000Z"
}

// コアバリュー目標
{
    "id": "77777777-7777-7777-7777-777777777777",
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "period_id": "a1b2c3d4-e5f6-7890-1234-56789abcdef0",
    "goal_category_id": 3,  // goal_categories.id (コアバリュー)
    "target_data": {
        "core_value_theme": "誠実性と責任感",
    },
    "weight": 100,  // コアバリューは固定100%
    "status": "draft",
    "approved_by": null,
    "approved_at": null,
    "created_at": "2024-01-15T10:15:00.000Z",
    "updated_at": "2024-01-15T10:15:00.000Z"
}
```

### Self_Assessments（自己評価）

```json
// 山田太郎の業績目標評価
{
    "id": "sa-11111111-1111-1111-1111-111111111111",
    "goal_id": "11111111-1111-1111-1111-111111111111",
    "period_id": "a1b2c3d4-e5f6-7890-1234-56789abcdef0",
    "self_rating": 85,
    "self_comment": "新規顧客獲得において目標を上回る成果を上げることができました。SNS広告の効果が特に高く、従来のマーケティング手法と組み合わせることで効率的にリードを獲得できました。紹介キャンペーンも好評で、既存顧客との関係強化にもつながりました。",
    "status": "draft",
    "submitted_at": null,
    "created_at": "2024-01-15T09:00:00.000Z",
    "updated_at": "2024-01-20T14:30:00.000Z"
}

{
    "id": "sa-22222222-1111-1111-1111-111111111111",
    "goal_id": "22222222-1111-1111-1111-111111111111",
    "period_id": "a1b2c3d4-e5f6-7890-1234-56789abcdef0",
    "self_rating": 75,
    "self_comment": "月次売上目標は概ね達成できていますが、月によってばらつきがありました。顧客別売上予測の精度向上に取り組んでおり、下半期はより安定した成果を目指します。高単価商品の提案スキルをさらに向上させる必要があると感じています。",
    "status": "draft",
    "submitted_at": null,
    "created_at": "2024-01-15T09:15:00.000Z",
    "updated_at": "2024-01-20T14:35:00.000Z"
}

{
    "id": "sa-33333333-1111-1111-1111-111111111111",
    "goal_id": "33333333-1111-1111-1111-111111111111",
    "period_id": "a1b2c3d4-e5f6-7890-1234-56789abcdef0",
    "self_rating": 90,
    "self_comment": "顧客満足度調査では4.6点という高い評価をいただくことができました。定期的な顧客訪問と迅速な課題解決対応が評価されています。苦情件数も大幅に削減でき、顧客との信頼関係構築に成功しました。今後もこの水準を維持していきます。",
    "status": "draft",
    "submitted_at": null,
    "created_at": "2024-01-15T09:30:00.000Z",
    "updated_at": "2024-01-20T14:40:00.000Z"
}

{
    "id": "sa-44444444-1111-1111-1111-111111111111",
    "goal_id": "44444444-1111-1111-1111-111111111111",
    "period_id": "a1b2c3d4-e5f6-7890-1234-56789abcdef0",
    "self_rating": 80,
    "self_comment": "チーム内のコミュニケーション改善に積極的に取り組みました。情報共有ツールの導入により、情報の透明性が向上し、メンバー間の連携がスムーズになりました。会議時間の短縮も実現でき、より生産的な議論ができるようになりました。",
    "status": "draft",
    "submitted_at": null,
    "created_at": "2024-01-15T09:45:00.000Z",
    "updated_at": "2024-01-20T14:45:00.000Z"
}

// 山田太郎のコンピテンシー評価
{
    "id": "sa-44444444-4444-4444-4444-444444444444",
    "goal_id": "44444444-4444-4444-4444-444444444444",
    "period_id": "a1b2c3d4-e5f6-7890-1234-56789abcdef0",
    "self_rating": 85,
    "self_comment": "チーム内での連携を意識し、積極的に調整役として活動しました。週次ミーティングでは建設的な議論を促進し、メンバー間の意見をうまく調整できたと思います。四半期アンケートでもチームワークの向上が確認でき、継続的な取り組みの成果を実感しています。",
    "status": "draft",
    "submitted_at": null,
    "created_at": "2024-01-15T10:00:00.000Z",
    "updated_at": "2024-01-20T14:50:00.000Z"
}

// 山田太郎のコアバリュー評価
{
    "id": "sa-77777777-7777-7777-7777-777777777777",
    "goal_id": "77777777-7777-7777-7777-777777777777",
    "period_id": "a1b2c3d4-e5f6-7890-1234-56789abcdef0",
    "self_rating": null,  // コアバリューはスコアなし
    "self_comment": "顧客との約束は必ず守ることを心がけ、困難な状況でも正直なコミュニケーションを実践しました。チーム内でも率直な意見交換を促進し、問題が発生した際は隠すことなく速やかに報告・解決に努めました。責任感を持って業務に取り組み、信頼関係の構築に努めています。",
    "status": "draft",
    "submitted_at": null,
    "created_at": "2024-01-15T10:15:00.000Z",
    "updated_at": "2024-01-20T14:55:00.000Z"
}
```



