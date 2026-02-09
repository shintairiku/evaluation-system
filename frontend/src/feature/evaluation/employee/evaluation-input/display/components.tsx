"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, Loader2, MessageSquare } from "lucide-react";
import type { GoalWithAssessment } from "./index";
import type { SaveStatus } from "../hooks/useSelfAssessmentAutoSave";

/**
 * Save status indicator component
 * Shows the current save state for auto-save functionality
 */
export function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;

  return (
    <>
      {status === "saving" && (
        <span className="text-xs text-blue-500 flex items-center gap-1 animate-pulse">
          <Loader2 className="h-3 w-3 animate-spin" />
          保存中...
        </span>
      )}
      {status === "saved" && (
        <span className="text-xs text-green-600 flex items-center gap-1">
          ✓ 一時保存済み
        </span>
      )}
      {status === "error" && (
        <span className="text-xs text-red-500 flex items-center gap-1">
          ⚠ 保存失敗
        </span>
      )}
    </>
  );
}

/**
 * Supervisor feedback alert component
 * Displays feedback from supervisor when available
 * Shows amber/orange for PENDING, green for APPROVED
 */
export function SupervisorFeedbackAlert({
  goalWithAssessment,
}: {
  goalWithAssessment: GoalWithAssessment;
}) {
  const { supervisorFeedback } = goalWithAssessment;

  if (!supervisorFeedback) {
    return null;
  }

  const isApproved = supervisorFeedback.action === "APPROVED";

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const feedbackDate =
    supervisorFeedback.reviewedAt ||
    supervisorFeedback.submittedAt ||
    supervisorFeedback.updatedAt;

  // Dynamic classes based on approval status
  const alertClasses = isApproved
    ? "border-green-200 bg-green-50"
    : "border-amber-200 bg-amber-50";

  const Icon = isApproved ? CheckCircle : Clock;
  const iconClasses = isApproved
    ? "h-4 w-4 text-green-600"
    : "h-4 w-4 text-amber-600";

  const titleClasses = isApproved
    ? "font-semibold text-green-900 flex items-center gap-2"
    : "font-semibold text-amber-900 flex items-center gap-2";

  const statusText = isApproved
    ? "上司からのフィードバック（承認済み）"
    : "上司からのフィードバック（確認中）";

  const badgeClasses = isApproved
    ? "bg-green-600 text-white text-xs"
    : "bg-amber-600 text-white text-xs";

  const dateClasses = isApproved ? "text-sm text-green-800" : "text-sm text-amber-800";

  const commentBorderClasses = isApproved
    ? "bg-white p-3 rounded border border-green-200"
    : "bg-white p-3 rounded border border-amber-200";

  const noCommentClasses = isApproved
    ? "text-sm text-green-700 italic"
    : "text-sm text-amber-700 italic";

  return (
    <Alert variant="default" className={alertClasses}>
      <Icon className={iconClasses} />
      <AlertDescription className="ml-2">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={titleClasses}>
              <MessageSquare className="h-4 w-4" />
              {statusText}
            </p>
            <div className="flex items-center gap-3">
              {supervisorFeedback.supervisorRatingCode && (
                <Badge className={badgeClasses}>
                  評価: {supervisorFeedback.supervisorRatingCode}
                </Badge>
              )}
              {feedbackDate && <p className={dateClasses}>{formatDate(feedbackDate)}</p>}
            </div>
          </div>
          {supervisorFeedback.supervisorComment && (
            <div className={commentBorderClasses}>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">
                {supervisorFeedback.supervisorComment}
              </p>
            </div>
          )}
          {!supervisorFeedback.supervisorComment && (
            <p className={noCommentClasses}>コメントはありません</p>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
