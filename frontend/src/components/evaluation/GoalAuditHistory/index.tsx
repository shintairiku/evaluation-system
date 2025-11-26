import React from 'react';
import { Clock, User, Send, CheckCircle, XCircle } from 'lucide-react';
import type { GoalResponse } from '@/api/types';

/**
 * Props for GoalAuditHistory component
 */
interface GoalAuditHistoryProps {
  /** Goal data with audit information */
  goal: GoalResponse;
  /** User name who created/owns the goal */
  userName?: string;
  /** Supervisor name to whom the goal was sent */
  supervisorName?: string;
  /** Approver name (if different from supervisor) */
  approverName?: string;
  /** Optional custom className */
  className?: string;
}

/**
 * Component to display goal audit history in a simple timeline format.
 *
 * Shows:
 * - Creation date and creator
 * - Submission date and recipient (when status is submitted/approved/rejected)
 * - Approval/rejection date and approver
 *
 * @param props - Component props
 * @returns JSX element containing the audit history
 *
 * @example
 * ```tsx
 * <GoalAuditHistory
 *   goal={goal}
 *   userName="田中太郎"
 *   supervisorName="佐藤花子"
 *   approverName="佐藤花子"
 * />
 * ```
 */
export const GoalAuditHistory = React.memo<GoalAuditHistoryProps>(
  function GoalAuditHistory({
    goal,
    userName,
    supervisorName,
    approverName,
    className = '',
  }: GoalAuditHistoryProps) {
    /**
     * Format date to Japanese short format
     */
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleString('ja-JP', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    /**
     * Get status change events based on goal status
     */
    const getHistoryEvents = () => {
      const events = [];

      // 1. Creation event - always present
      events.push({
        icon: <Clock className="h-3 w-3" />,
        text: `作成者: ${userName || '不明'}`,
        date: formatDate(goal.createdAt),
        type: 'created',
      });

      // 2. Submission event - when goal is submitted, approved, or rejected
      if (goal.status !== 'draft') {
        events.push({
          icon: <Send className="h-3 w-3" />,
          text: `送信先: ${supervisorName || '上司'}`,
          date: formatDate(goal.updatedAt), // Using updatedAt as proxy for submission
          type: 'submitted',
        });
      }

      // 3. Approval/Rejection event
      if (goal.status === 'approved' && goal.approvedAt) {
        events.push({
          icon: <CheckCircle className="h-3 w-3 text-green-600" />,
          text: `承認者: ${approverName || supervisorName || '上司'}`,
          date: formatDate(goal.approvedAt),
          type: 'approved',
        });
      } else if (goal.status === 'rejected' && goal.updatedAt) {
        events.push({
          icon: <XCircle className="h-3 w-3 text-amber-600" />,
          text: `差し戻し者: ${approverName || supervisorName || '上司'}`,
          date: formatDate(goal.updatedAt),
          type: 'rejected',
        });
      }

      return events;
    };

    const historyEvents = getHistoryEvents();

    return (
      <div className={`border-t pt-3 mt-3 ${className}`}>
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <User className="h-4 w-4" />
          履歴
        </h4>
        <div className="space-y-1.5">
          {historyEvents.map((event, index) => (
            <div
              key={index}
              className="flex items-start gap-2 text-xs text-muted-foreground"
            >
              <div className="flex items-center gap-1.5 min-w-[120px]">
                {event.icon}
                <span>{event.date}</span>
              </div>
              <span>-</span>
              <span>{event.text}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
);
