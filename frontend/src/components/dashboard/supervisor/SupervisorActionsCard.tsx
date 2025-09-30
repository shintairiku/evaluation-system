'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Target, MessageSquare, Users, FileBarChart, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export interface SupervisorActionsCardProps {
  className?: string;
  onActionClick?: (action: SupervisorAction) => void;
}

export interface SupervisorAction {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  variant?: 'default' | 'outline' | 'secondary';
}

/**
 * SupervisorActionsCard component for quick access to supervisor functions
 *
 * Provides quick navigation to:
 * - Goal Review page
 * - Evaluation Feedback page
 * - Subordinates List
 * - Team Reports
 */
export default function SupervisorActionsCard({
  className = '',
  onActionClick
}: SupervisorActionsCardProps) {
  const actions: SupervisorAction[] = [
    {
      id: 'goal-review',
      label: '目標承認',
      description: '部下の目標を確認・承認',
      href: '/(evaluation)/(supervisor)/goal-review',
      icon: <Target className="w-5 h-5" />,
      variant: 'default'
    },
    {
      id: 'evaluation-feedback',
      label: '評価フィードバック',
      description: '部下の評価をレビュー',
      href: '/(evaluation)/(supervisor)/evaluation-feedback',
      icon: <MessageSquare className="w-5 h-5" />,
      variant: 'default'
    },
    {
      id: 'subordinates',
      label: '部下一覧',
      description: 'チームメンバーを管理',
      href: '/user-profiles',
      icon: <Users className="w-5 h-5" />,
      variant: 'outline'
    },
    {
      id: 'team-reports',
      label: 'チームレポート',
      description: 'チームの進捗を確認',
      href: '/(evaluation)/(admin)/report',
      icon: <FileBarChart className="w-5 h-5" />,
      variant: 'outline'
    }
  ];

  const handleActionClick = (action: SupervisorAction) => {
    if (onActionClick) {
      onActionClick(action);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRight className="w-5 h-5 text-primary" />
          クイックアクション
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3">
          {actions.map((action) => (
            <Button
              key={action.id}
              variant={action.variant || 'outline'}
              className="w-full justify-start h-auto py-4 px-4"
              asChild
              onClick={() => handleActionClick(action)}
            >
              <Link href={action.href}>
                <div className="flex items-center gap-3 w-full">
                  <div className="shrink-0">
                    {action.icon}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-sm">{action.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {action.description}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 shrink-0 opacity-50" />
                </div>
              </Link>
            </Button>
          ))}
        </div>

        {/* Additional Info */}
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            上記のアクションから評価プロセスを管理できます
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact version for smaller spaces
 */
export function CompactSupervisorActionsCard({
  className = ''
}: {
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ArrowRight className="w-4 h-4 text-primary" />
          クイックアクション
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          <Button variant="default" size="sm" className="w-full justify-start" asChild>
            <Link href="/(evaluation)/(supervisor)/goal-review">
              <Target className="w-4 h-4 mr-2" />
              目標承認
            </Link>
          </Button>
          <Button variant="default" size="sm" className="w-full justify-start" asChild>
            <Link href="/(evaluation)/(supervisor)/evaluation-feedback">
              <MessageSquare className="w-4 h-4 mr-2" />
              評価フィードバック
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}