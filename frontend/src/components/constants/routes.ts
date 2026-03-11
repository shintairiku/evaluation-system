
export const homeLink = {
  href: '/',
  label: 'ホーム',
  sublabel: 'Dashboard',
  icon: 'home',
  permission: 'authenticated'
};

export const groups = [
  {
    title: 'メンバー',
    links: [
      {
        href: '/goal-input',
        label: '目標入力',
        sublabel: 'Goal Input',
        icon: 'target',
        permission: 'employee'
      },
      {
        href: '/evaluation-input',
        label: '評価入力',
        sublabel: 'Evaluation Input',
        icon: 'clipboard',
        permission: 'employee'
      },
      {
        href: '/goal-list',
        label: '目標一覧',
        sublabel: 'Goal List',
        icon: 'list',
        permission: 'employee'
      },
      {
        href: '/peer-review',
        label: '同僚評価',
        sublabel: 'Peer Review',
        icon: 'users',
        permission: 'employee'
      },
    ],
  },
  {
    title: '上司',
    links: [
      {
        href: '/goal-review',
        label: '目標承認',
        sublabel: 'Goal Review',
        icon: 'check-circle',
        permission: 'supervisor'
      },
      {
        href: '/evaluation-feedback',
        label: '評価フィードバック',
        sublabel: 'Evaluation Feedback',
        icon: 'message-square',
        permission: 'supervisor'
      },
    ],
  },
  {
    title: '設定',
    links: [
      {
        href: '/user-profiles',
        label: 'ユーザー管理',
        sublabel: 'User Profiles',
        icon: 'user-cog',
        permission: 'authenticated'
      },
      {
        href: '/notifications',
        label: '通知センター',
        sublabel: 'Notifications',
        icon: 'bell',
        permission: 'authenticated'
      },
      {
        href: '/settings',
        label: 'システム設定',
        sublabel: 'Settings',
        icon: 'settings',
        permission: 'authenticated'
      },
    ],
  },
  {
    title: '管理者',
    links: [
      {
        href: '/org-management',
        label: '組織管理',
        sublabel: 'Organization Management',
        icon: 'building',
        permission: 'admin'
      },
      {
        href: '/admin-goal-list',
        label: '全目標一覧',
        sublabel: 'All Goals List',
        icon: 'list-checks',
        permission: 'admin'
      },
      {
        href: '/evaluation-period-management',
        label: '評価期間設定',
        sublabel: 'Evaluation Period Management',
        icon: 'calendar',
        permission: 'admin'
      },
      {
        href: '/admin-eval-list',
        label: '総合評価',
        sublabel: 'Comprehensive Evaluation',
        icon: 'clipboard',
        permission: 'admin'
      },
      {
        href: '/stage-management',
        label: 'ステージ管理',
        sublabel: 'Stage Management',
        icon: 'trending-up',
        permission: 'admin'
      },
      {
        href: '/competency-management',
        label: 'コンピテンシー管理',
        sublabel: 'Competency Management',
        icon: 'brain',
        permission: 'admin'
      },
      {
        href: '/peer-review-assignments',
        label: '同僚評価進捗管理',
        sublabel: 'Peer Review Assignments',
        icon: 'users',
        permission: 'admin'
      },
      {
        href: '/admin-settings',
        label: '管理者設定',
        sublabel: 'Admin Settings',
        icon: 'shield',
        permission: 'admin'
      },
    ],
  },
];
