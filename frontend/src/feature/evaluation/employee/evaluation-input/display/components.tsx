"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Clock, Loader2, MessageSquare } from "lucide-react";
import type { GoalWithAssessment } from "./index";
import type { CoreValueFeedback, CoreValueDefinition } from "@/api/types";
import type { SaveStatus } from "../hooks/useSelfAssessmentAutoSave";

/**
 * Save status indicator component
 * Shows the current save state for auto-save functionality
 *
 * @param theme - 'blue' for employee (default), 'green' for supervisor
 */
export function SaveStatusIndicator({ status, theme = "blue" }: { status: SaveStatus; theme?: "blue" | "green" }) {
  if (status === "idle") return null;

  const savingColor = theme === "green" ? "text-green-500" : "text-blue-500";

  return (
    <>
      {status === "saving" && (
        <span className={`text-xs ${savingColor} flex items-center gap-1 animate-pulse`}>
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
 *
 * 3 visual states (priority order):
 * 1. APPROVED (green) — action === 'APPROVED'
 * 2. RETURNED (red) — action === 'PENDING' && returnComment present
 * 3. PENDING (amber) — action === 'PENDING' && no returnComment
 *
 * When RETURNED (差し戻し), shows the supervisor's suggested rating(s):
 * - Performance goals: single supervisorRatingCode inline badge
 * - Competency goals: per-competency average ratings grid (from ratingData)
 */
export function SupervisorFeedbackAlert({
  goalWithAssessment,
}: {
  goalWithAssessment: GoalWithAssessment;
}) {
  const { goal, supervisorFeedback } = goalWithAssessment;

  if (!supervisorFeedback) {
    return null;
  }

  const isApproved = supervisorFeedback.action === "APPROVED";
  const isReturned = !isApproved && !!supervisorFeedback.returnComment;

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

  // Determine visual state
  let alertClasses: string;
  let Icon: typeof CheckCircle;
  let iconClasses: string;
  let titleClasses: string;
  let statusText: string;
  let dateClasses: string;

  if (isApproved) {
    alertClasses = "border-green-200 bg-green-50";
    Icon = CheckCircle;
    iconClasses = "h-4 w-4 text-green-600";
    titleClasses = "font-semibold text-green-900 flex items-center gap-2";
    statusText = "上司からのフィードバック（承認済み）";
    dateClasses = "text-sm text-green-800";
  } else if (isReturned) {
    alertClasses = "border-red-200 bg-red-50";
    Icon = AlertCircle;
    iconClasses = "h-4 w-4 text-red-600";
    titleClasses = "font-semibold text-red-900 flex items-center gap-2";
    statusText = "上司からのフィードバック（差し戻し）";
    dateClasses = "text-sm text-red-800";
  } else {
    alertClasses = "border-amber-200 bg-amber-50";
    Icon = Clock;
    iconClasses = "h-4 w-4 text-amber-600";
    titleClasses = "font-semibold text-amber-900 flex items-center gap-2";
    statusText = "上司からのフィードバック（確認中）";
    dateClasses = "text-sm text-amber-800";
  }

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
              {feedbackDate && <p className={dateClasses}>{formatDate(feedbackDate)}</p>}
            </div>
          </div>
          {isReturned && (
            <>
              {/* Supervisor suggested rating(s) */}
              {supervisorFeedback.ratingData && Object.keys(supervisorFeedback.ratingData).length > 0 ? (
                /* Competency: per-action ratings grouped by competency */
                (() => {
                  const competencyNames = goal.allStageCompetencyNames || goal.competencyNames || {};
                  const actionTexts = goal.allStageIdealActionTexts || {};
                  const compIds = Object.keys(supervisorFeedback.ratingData!);

                  if (compIds.length === 0) return null;
                  return (
                    <div>
                      <p className="text-sm font-medium text-red-800 mb-1">上司推薦評価：</p>
                      <div className="bg-white p-3 rounded border border-red-200 space-y-2">
                        {compIds.map(compId => {
                          const compName = competencyNames[compId] || compId;
                          const compActionTexts = actionTexts[compId] || {};
                          const actionRatings = supervisorFeedback.ratingData![compId];
                          const actionEntries = Object.entries(actionRatings).filter(([, r]) => r);

                          if (actionEntries.length === 0) return null;
                          return (
                            <div key={compId}>
                              <p className="text-xs font-semibold text-gray-600 mb-0.5">{compName}</p>
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 pl-2">
                                {actionEntries.map(([actionIdx, rating]) => (
                                  <span key={actionIdx} className="text-sm text-gray-800">
                                    <span className="text-gray-500 truncate max-w-[200px] inline-block align-bottom overflow-hidden whitespace-nowrap">
                                      {compActionTexts[actionIdx] || `Action ${actionIdx}`}
                                    </span>
                                    ：<span className="font-bold">{rating}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()
              ) : supervisorFeedback.supervisorRatingCode ? (
                /* Performance: single inline badge */
                <div className="flex items-center gap-2 text-sm text-red-800">
                  <span>上司推薦評価：</span>
                  <span className="font-bold text-base">{supervisorFeedback.supervisorRatingCode}</span>
                </div>
              ) : null}
              {supervisorFeedback.returnComment && (
                <div className="bg-white p-3 rounded border border-red-200">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">
                    {supervisorFeedback.returnComment}
                  </p>
                </div>
              )}
              <p className="text-sm text-red-700 font-medium">
                修正して再度提出してください。
              </p>
            </>
          )}
          {isApproved && (
            <p className="text-sm text-green-700">承認されました。</p>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Core value feedback alert component
 * Displays feedback status from supervisor for core value evaluation
 *
 * 3 visual states (same pattern as SupervisorFeedbackAlert):
 * 1. APPROVED (green) — action === 'APPROVED'
 * 2. RETURNED (red) — action === 'PENDING' && returnComment present
 * 3. PENDING (amber) — action === 'PENDING' && no returnComment
 *
 * When RETURNED, shows per-core-value supervisor ratings grid from feedback.scores.
 */
export function CoreValueFeedbackAlert({
  feedback,
  definitions,
}: {
  feedback: CoreValueFeedback | null;
  definitions?: CoreValueDefinition[];
}) {
  if (!feedback) {
    return null;
  }

  const isApproved = feedback.action === "APPROVED";
  const isReturned = !isApproved && !!feedback.returnComment;

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const feedbackDate =
    feedback.reviewedAt ||
    feedback.submittedAt ||
    feedback.updatedAt;

  // Determine visual state
  let alertClasses: string;
  let Icon: typeof CheckCircle;
  let iconClasses: string;
  let titleClasses: string;
  let statusText: string;
  let dateClasses: string;

  if (isApproved) {
    alertClasses = "border-green-200 bg-green-50";
    Icon = CheckCircle;
    iconClasses = "h-4 w-4 text-green-600";
    titleClasses = "font-semibold text-green-900 flex items-center gap-2";
    statusText = "上司からのフィードバック（承認済み）";
    dateClasses = "text-sm text-green-800";
  } else if (isReturned) {
    alertClasses = "border-red-200 bg-red-50";
    Icon = AlertCircle;
    iconClasses = "h-4 w-4 text-red-600";
    titleClasses = "font-semibold text-red-900 flex items-center gap-2";
    statusText = "上司からのフィードバック（差し戻し）";
    dateClasses = "text-sm text-red-800";
  } else {
    alertClasses = "border-amber-200 bg-amber-50";
    Icon = Clock;
    iconClasses = "h-4 w-4 text-amber-600";
    titleClasses = "font-semibold text-amber-900 flex items-center gap-2";
    statusText = "上司からのフィードバック（確認中）";
    dateClasses = "text-sm text-amber-800";
  }

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
              {feedbackDate && <p className={dateClasses}>{formatDate(feedbackDate)}</p>}
            </div>
          </div>
          {isReturned && (
            <>
              {/* Per-core-value supervisor ratings grid */}
              {feedback.scores && definitions && definitions.length > 0 && (() => {
                const entries = definitions
                  .filter(def => feedback.scores![def.id])
                  .map(def => ({
                    name: def.name,
                    rating: feedback.scores![def.id],
                  }));

                if (entries.length === 0) return null;
                return (
                  <div>
                    <p className="text-sm font-medium text-red-800 mb-1">上司推薦評価：</p>
                    <div className="bg-white p-3 rounded border border-red-200">
                      <div className="flex flex-wrap gap-x-5 gap-y-1">
                        {entries.map(e => (
                          <span key={e.name} className="text-sm text-gray-800">
                            {e.name}：<span className="font-bold">{e.rating}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
              {feedback.returnComment && (
                <div className="bg-white p-3 rounded border border-red-200">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">
                    {feedback.returnComment}
                  </p>
                </div>
              )}
              <p className="text-sm text-red-700 font-medium">
                修正して再度提出してください。
              </p>
            </>
          )}
          {isApproved && (
            <p className="text-sm text-green-700">承認されました。</p>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
