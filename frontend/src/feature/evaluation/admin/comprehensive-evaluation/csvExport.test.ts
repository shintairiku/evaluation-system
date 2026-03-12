import { describe, expect, it } from "vitest";

import {
  buildComprehensiveEvaluationCsvFilename,
  COMPREHENSIVE_EVALUATION_EXPORT_COLUMNS,
  DEFAULT_COMPREHENSIVE_EVALUATION_EXPORT_COLUMNS,
  getComprehensiveEvaluationFlagLabel,
} from "./csvExport";

describe("comprehensive evaluation csv export", () => {
  it("keeps the configured export columns in table order", () => {
    expect(DEFAULT_COMPREHENSIVE_EVALUATION_EXPORT_COLUMNS).toEqual(
      COMPREHENSIVE_EVALUATION_EXPORT_COLUMNS.map((column) => column.key),
    );
    expect(COMPREHENSIVE_EVALUATION_EXPORT_COLUMNS).toHaveLength(16);
    expect(COMPREHENSIVE_EVALUATION_EXPORT_COLUMNS[0]?.label).toBe("社員番号");
    expect(COMPREHENSIVE_EVALUATION_EXPORT_COLUMNS[15]?.label).toBe("処理状態");
  });

  it("appends the manual suffix to the flag label", () => {
    expect(
      getComprehensiveEvaluationFlagLabel({
        applied: {
          promotionFlag: true,
          demotionFlag: false,
        },
        manualDecision: {
          periodId: "period-1",
          decision: "昇格",
          stageAfter: "STAGE5",
          levelAfter: 30,
          reason: "manual",
          doubleCheckedBy: null,
          appliedByUserId: "user-1",
          appliedAt: "2026-03-11T10:00:00Z",
        },
      } as never),
    ).toBe("昇格（手動）");
  });

  it("builds a sanitized csv filename", () => {
    expect(
      buildComprehensiveEvaluationCsvFilename(
        " 2026 / H1 Review ",
        new Date(2026, 2, 11, 9, 7),
      ),
    ).toBe("comprehensive-evaluation_2026-H1-Review_20260311-0907.csv");
  });
});
