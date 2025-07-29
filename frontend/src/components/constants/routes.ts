
export const groups = [
  {
    title: '人事評価システム',
    links: [
      {
        href: '/',
        label: 'ホーム',
        sublabel: 'Dashboard',
        icon: 'home',
        permission: 'authenticated'
      },
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
        href: '/past-goal',
        label: '目標etc一覧',
        sublabel: 'Goal History',
        icon: 'list',
        permission: 'authenticated'
      },
      {
        href: '/user-profiles',
        label: 'ユーザー管理',
        sublabel: 'User Profiles',
        icon: 'users',
        permission: 'authenticated'
      },
    ],
  },
  {
    title: '上司機能',
    links: [
      {
        href: '/goal-approval',
        label: '目標承認',
        sublabel: 'Goal Approval',
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
    title: '管理者機能',
    links: [
      {
        href: '/user-management',
        label: 'ユーザー管理',
        sublabel: 'User Management',
        icon: 'user-cog',
        permission: 'admin'
      },
      {
        href: '/department-management',
        label: '部門管理',
        sublabel: 'Department Management',
        icon: 'building',
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
    ],
  },
  {
    title: '設定・通知',
    links: [
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