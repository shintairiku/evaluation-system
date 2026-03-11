import type {
  ComprehensiveEvaluationExportColumn,
  ComprehensiveEvaluationRowResponse,
  ComprehensiveEmploymentType,
  ComprehensiveProcessingStatus,
} from "@/api/types";

export const COMPREHENSIVE_EVALUATION_EXPORT_COLUMNS: ReadonlyArray<{
  key: ComprehensiveEvaluationExportColumn;
  label: string;
}> = [
  { key: "employeeCode", label: "社員番号" },
  { key: "name", label: "氏名" },
  { key: "departmentName", label: "部署" },
  { key: "employmentType", label: "雇用形態" },
  { key: "currentStage", label: "現在ステージ" },
  { key: "currentLevel", label: "現在レベル" },
  { key: "performanceFinalRank", label: "目標達成 最終評価" },
  { key: "performanceWeightPercent", label: "目標達成 ウェイト（%）" },
  { key: "competencyFinalRank", label: "コンピテンシー 最終評価" },
  { key: "competencyWeightPercent", label: "コンピテンシー ウェイト（%）" },
  { key: "coreValueFinalRank", label: "コアバリュー 最終評価" },
  { key: "totalScore", label: "合計（点）" },
  { key: "overallRank", label: "総合評価" },
  { key: "newLevel", label: "反映後レベル" },
  { key: "promotionDemotionFlag", label: "昇格/降格フラグ" },
  { key: "processingStatus", label: "処理状態" },
] as const;

export const DEFAULT_COMPREHENSIVE_EVALUATION_EXPORT_COLUMNS =
  COMPREHENSIVE_EVALUATION_EXPORT_COLUMNS.map((column) => column.key);

export function getComprehensiveEvaluationEmploymentTypeLabel(
  value: ComprehensiveEmploymentType,
): string {
  return value === "employee" ? "正社員" : "パート";
}

export function getComprehensiveEvaluationProcessingStatusLabel(
  value: ComprehensiveProcessingStatus,
): string {
  return value === "processed" ? "処理済" : "未処理";
}

export function getComprehensiveEvaluationFlagLabel(
  row: Pick<ComprehensiveEvaluationRowResponse, "applied" | "manualDecision">,
): string {
  let label = "-";

  if (row.applied.promotionFlag && row.applied.demotionFlag) {
    label = "昇格/降格";
  } else if (row.applied.promotionFlag) {
    label = "昇格";
  } else if (row.applied.demotionFlag) {
    label = "降格";
  }

  if (row.manualDecision) {
    return `${label}（手動）`;
  }

  return label;
}

export function buildComprehensiveEvaluationCsvFilename(
  periodLabel: string,
  now: Date = new Date(),
): string {
  const safeLabel = sanitizePeriodLabel(periodLabel);
  const timestamp = [
    String(now.getFullYear()).padStart(4, "0"),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("") + "-" + [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
  ].join("");

  return `comprehensive-evaluation_${safeLabel}_${timestamp}.csv`;
}

function sanitizePeriodLabel(periodLabel: string): string {
  const trimmed = periodLabel.trim();
  if (!trimmed) return "period";

  const normalized = trimmed
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "period";
}
