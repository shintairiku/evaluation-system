'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  Building2,
  Target,
  Layers,
  Settings,
  UserPlus,
  FileText,
  Calendar
} from 'lucide-react';
import Link from 'next/link';

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  disabled?: boolean;
  badge?: string;
}

export interface QuickActionsCardProps {
  className?: string;
  onActionClick?: (action: QuickAction) => void;
}

/**
 * QuickActionsCard component for admin management shortcuts
 *
 * Provides quick access to:
 * - User management
 * - Department management
 * - Stage management
 * - Competency management
 * - System settings
 */
export default function QuickActionsCard({
  className = '',
  onActionClick
}: QuickActionsCardProps) {
  const quickActions: QuickAction[] = [
    {
      id: 'user-management',
      label: 'ユーザー管理',
      description: 'ユーザーの追加・編集・権限設定',
      href: '/admin/users',
      icon: <Users className="w-5 h-5" />,
      variant: 'default'
    },
    {
      id: 'department-management',
      label: '部門管理',
      description: '部門の作成・編集・階層設定',
      href: '/admin/departments',
      icon: <Building2 className="w-5 h-5" />,
      variant: 'secondary'
    },
    {
      id: 'stage-management',
      label: 'ステージ管理',
      description: '評価ステージの設定・管理',
      href: '/admin/stages',
      icon: <Layers className="w-5 h-5" />,
      variant: 'secondary'
    },
    {
      id: 'competency-management',
      label: 'コンピテンシー管理',
      description: 'コンピテンシーの設定・編集',
      href: '/admin/competencies',
      icon: <Target className="w-5 h-5" />,
      variant: 'secondary'
    },
    {
      id: 'evaluation-periods',
      label: '評価期間管理',
      description: '評価期間の作成・設定・管理',
      href: '/admin/evaluation-periods',
      icon: <Calendar className="w-5 h-5" />,
      variant: 'outline'
    },
    {
      id: 'system-settings',
      label: 'システム設定',
      description: 'システム全体の設定・構成',
      href: '/admin/settings',
      icon: <Settings className="w-5 h-5" />,
      variant: 'outline'
    }
  ];

  const handleActionClick = (action: QuickAction) => {
    if (onActionClick) {
      onActionClick(action);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-primary" />
          クイックアクション
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <Button
              key={action.id}
              variant={action.variant || 'outline'}
              className="h-auto p-4 flex flex-col items-start gap-2 text-left relative group"
              disabled={action.disabled}
              asChild
              onClick={() => handleActionClick(action)}
            >
              <Link href={action.href}>
                <div className="flex items-center gap-2 w-full">
                  <div className="text-inherit">
                    {action.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {action.label}
                    </div>
                  </div>
                  {action.badge && (
                    <div className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                      {action.badge}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground text-left w-full group-hover:text-inherit transition-colors">
                  {action.description}
                </p>
              </Link>
            </Button>
          ))}
        </div>

        {/* Additional Administrative Actions */}
        <div className="mt-6 pt-4 border-t">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            レポート・分析
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="justify-start text-xs h-8"
              asChild
            >
              <Link href="/admin/reports/system">
                システム利用状況
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start text-xs h-8"
              asChild
            >
              <Link href="/admin/reports/evaluations">
                評価進捗レポート
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start text-xs h-8"
              asChild
            >
              <Link href="/admin/reports/performance">
                パフォーマンス分析
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start text-xs h-8"
              asChild
            >
              <Link href="/admin/logs">
                システムログ
              </Link>
            </Button>
          </div>
        </div>

        {/* Emergency Actions */}
        <div className="mt-4 pt-4 border-t">
          <h4 className="text-sm font-medium mb-3 text-destructive flex items-center gap-2">
            <Settings className="w-4 h-4" />
            緊急時対応
          </h4>
          <div className="space-y-2">
            <Button
              variant="destructive"
              size="sm"
              className="w-full text-xs h-8"
              asChild
            >
              <Link href="/admin/maintenance">
                メンテナンスモード
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact version for smaller spaces
 */
export function CompactQuickActionsCard({ className = '' }: { className?: string }) {
  const compactActions = [
    {
      label: 'ユーザー',
      href: '/admin/users',
      icon: <Users className="w-4 h-4" />
    },
    {
      label: '部門',
      href: '/admin/departments',
      icon: <Building2 className="w-4 h-4" />
    },
    {
      label: 'ステージ',
      href: '/admin/stages',
      icon: <Layers className="w-4 h-4" />
    },
    {
      label: '設定',
      href: '/admin/settings',
      icon: <Settings className="w-4 h-4" />
    }
  ];

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">管理</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {compactActions.map((action, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              className="h-16 flex flex-col gap-1"
              asChild
            >
              <Link href={action.href}>
                {action.icon}
                <span className="text-xs">{action.label}</span>
              </Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}