

export const groups = [
  {
    title: 'Home',
    links: [
      {
        href: '/goal-input',
        label: '評価',
        sublabel: 'Evaluation',
        subLinks: [
          {
            title: 'Admin',
            links: [
              { href: '/user-management', label: 'メンバー管理'},
              { href: '/report', label: 'レポート'},
            ],
          },
          {
            title: 'Supervisor',
            links: [
              { href: '/goal-approval', label: '目標承認'},
              { href: '/evaluation-feedback', label: '評価FB'},
            ],
          },
          {
            title: 'Employee',
            links: [
              { href: '/goal-input', label: '目標入力'},
              { href: '/evaluation-input', label: '評価入力'},
            ],
          },
        ],
      },
    ],
  },
];