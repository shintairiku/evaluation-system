"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Plus,
  Search,
  Settings,
  ShieldX,
  Trash2,
  X,
} from "lucide-react";

import {
  exportComprehensiveEvaluationCsvAction,
  getComprehensiveEvaluationListAction,
  processComprehensiveEvaluationUserAction,
} from "@/api/server-actions/comprehensive-evaluation";
import type {
  ComprehensiveEvaluationExportColumn,
  ComprehensiveEvaluationRowResponse,
  UUID,
} from "@/api/types";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useOptionalCurrentUserContext } from "@/context/CurrentUserContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { mockDefaultComprehensiveEvaluationSettings } from "../mock";
import {
  buildComprehensiveEvaluationCsvFilename,
  COMPREHENSIVE_EVALUATION_EXPORT_COLUMNS,
  DEFAULT_COMPREHENSIVE_EVALUATION_EXPORT_COLUMNS,
  getComprehensiveEvaluationEmploymentTypeLabel,
  getComprehensiveEvaluationFlagLabel,
  getComprehensiveEvaluationProcessingStatusLabel,
} from "../csvExport";
import {
  toApiSettings,
  useComprehensiveEvaluationSettings,
} from "../hooks/useComprehensiveEvaluationSettings";
import {
  EVALUATION_RANKS,
  type ComprehensiveEvaluationSettings,
  type DemotionRuleCondition,
  type PromotionRuleCondition,
} from "../settings";
import {
  buildUniqueTemplateName,
  normalizeTemplateName,
} from "../templateName";
import type {
  EmploymentType,
  EvaluationRank,
  ProcessingStatus,
} from "../types";

function formatNumber(value: number, digits = 2): string {
  return value.toFixed(digits);
}

const INTERMEDIATE_NUMBER_INPUTS = new Set(["", "-", ".", "-."]);
const COMPREHENSIVE_ROWS_PAGE_SIZE = 200;

function parseNumericInput(value: string): number | null {
  const trimmed = value.trim();
  if (INTERMEDIATE_NUMBER_INPUTS.has(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildLevelDeltaInputs(
  settings: ComprehensiveEvaluationSettings,
): Record<EvaluationRank, string> {
  return EVALUATION_RANKS.reduce(
    (acc, rank) => {
      acc[rank] = String(settings.levelDeltaByOverallRank[rank] ?? "");
      return acc;
    },
    {} as Record<EvaluationRank, string>,
  );
}

function buildSearchText(row: ComprehensiveEvaluationRowResponse): string {
  return [
    row.employeeCode,
    row.name,
    row.departmentName ?? "",
    row.currentStage ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function getEmploymentTypeLabel(value: EmploymentType): string {
  return getComprehensiveEvaluationEmploymentTypeLabel(value);
}

function getEmploymentTypeBadgeVariant(value: EmploymentType) {
  return value === "employee" ? "outline" : "secondary";
}

type PromotionConditionTarget = PromotionRuleCondition["field"];
type DemotionConditionTarget = DemotionRuleCondition["field"];

const PROMOTION_CONDITION_TARGETS: Array<{
  value: PromotionConditionTarget;
  label: string;
}> = [
  { value: "overallRank", label: "総合評価が◯以上" },
  { value: "performanceFinalRank", label: "業績目標最終評価が◯以上" },
  { value: "competencyFinalRank", label: "コンピテンシー最終評価が◯以上" },
  { value: "coreValueFinalRank", label: "コアバリュー最終評価が◯以上" },
];

const DEMOTION_CONDITION_TARGETS: Array<{
  value: DemotionConditionTarget;
  label: string;
}> = [
  { value: "overallRank", label: "総合評価が◯以下" },
  { value: "competencyFinalRank", label: "コンピテンシー最終評価が◯以下" },
  { value: "coreValueFinalRank", label: "コアバリュー最終評価が◯以下" },
];

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type SettingsTargetKind = "default" | "department" | "stage";
type SettingsTargetBadgeTone = "base" | "inherit" | "override";

function buildDepartmentSettingsTarget(departmentId: UUID): string {
  return `department:${departmentId}`;
}

function buildStageSettingsTarget(stageId: UUID): string {
  return `stage:${stageId}`;
}

function parseSettingsTarget(target: string): {
  kind: SettingsTargetKind;
  id: UUID | null;
} {
  if (target === "default") {
    return { kind: "default", id: null };
  }

  if (target.startsWith("department:")) {
    return {
      kind: "department",
      id: target.slice("department:".length) as UUID,
    };
  }

  if (target.startsWith("stage:")) {
    return {
      kind: "stage",
      id: target.slice("stage:".length) as UUID,
    };
  }

  return { kind: "default", id: null };
}

function getSettingsErrorSummary(
  error: string | null,
): { title: string; description: string } | null {
  if (!error) return null;

  if (
    error.includes("Ruleset name already exists") ||
    error.includes("同じテンプレート名が既にあります")
  ) {
    return {
      title: "テンプレート名が重複しています",
      description:
        "同じ名前のテンプレートが既にあります。別名に変更するか、既存テンプレートを選んで上書き保存してください。",
    };
  }

  if (
    error.includes(
      "Cannot modify settings for completed or cancelled evaluation periods",
    )
  ) {
    return {
      title: "この期間は編集できません",
      description:
        "入力終了またはキャンセル済みの評価期間では、割当設定は変更できません。テンプレート管理のみ利用できます。",
    };
  }

  if (error.includes("Stage not found")) {
    return {
      title: "対象ステージが見つかりません",
      description:
        "最新のステージ一覧に更新したうえで、もう一度対象を選択してください。",
    };
  }

  if (error.includes("Department not found")) {
    return {
      title: "対象部門が見つかりません",
      description:
        "最新の部門一覧に更新したうえで、もう一度対象を選択してください。",
    };
  }

  return {
    title: "設定の保存に失敗しました",
    description: error,
  };
}

function getSettingsTargetBadgeClasses(tone: SettingsTargetBadgeTone): string {
  switch (tone) {
    case "base":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "inherit":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "override":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
}

function getSettingsTargetBadgeDotClasses(
  tone: SettingsTargetBadgeTone,
): string {
  switch (tone) {
    case "base":
      return "bg-sky-500";
    case "inherit":
      return "bg-amber-500";
    case "override":
      return "bg-emerald-500";
  }
}

function createPromotionCondition(
  target: PromotionConditionTarget,
  fallbackRank: EvaluationRank = "A+",
): PromotionRuleCondition {
  return { type: "rank_at_least", field: target, minimumRank: fallbackRank };
}

function createDemotionCondition(
  target: DemotionConditionTarget,
  fallbackRank: EvaluationRank = "D",
): DemotionRuleCondition {
  return {
    type: "rank_at_or_worse",
    field: target,
    thresholdRank: fallbackRank,
  };
}

export default function ComprehensiveEvaluationPage() {
  const {
    hasRole,
    isLoading: isRoleLoading,
    error: roleError,
    currentUser,
  } = useUserRoles();
  const currentUserContext = useOptionalCurrentUserContext();
  const isEvalAdmin = hasRole("eval_admin");
  const canAccessComprehensiveEvaluation =
    hasRole("admin") || hasRole("eval_admin");
  const canAccessCandidates = isEvalAdmin;
  const canEditThresholds = isEvalAdmin;

  const personalInfoColumns = 5;
  const performanceColumns = 2;
  const competencyColumns = 2;
  const coreValueColumns = 1;
  const overallColumns = 4;
  const totalColumns =
    personalInfoColumns +
    performanceColumns +
    competencyColumns +
    coreValueColumns +
    overallColumns;
  const [evaluationRows, setEvaluationRows] = useState<
    ComprehensiveEvaluationRowResponse[]
  >([]);
  const [isRowsLoading, setIsRowsLoading] = useState<boolean>(false);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const latestRowsRequestId = useRef(0);

  const evaluationPeriods = useMemo(
    () =>
      (currentUserContext?.periods?.all ?? []).map((period) => ({
        id: period.id,
        label: period.name,
        status: period.status,
      })),
    [currentUserContext?.periods?.all],
  );
  const defaultPeriodId =
    currentUserContext?.currentPeriod?.id ?? evaluationPeriods[0]?.id ?? "all";

  const [evaluationPeriodId, setEvaluationPeriodId] =
    useState<string>(defaultPeriodId);
  const {
    workspace,
    departments: settingsDepartments,
    stages: settingsStages,
    updateDefaultAssignment,
    updateDepartmentAssignment,
    updateStageAssignment,
    createRuleset,
    updateRuleset,
    deleteRuleset,
    isLoading: isSettingsLoading,
    isSaving: isSettingsSaving,
    error: settingsError,
  } = useComprehensiveEvaluationSettings(
    evaluationPeriodId !== "all" ? evaluationPeriodId : null,
  );
  const [settingsDialogOpen, setSettingsDialogOpen] = useState<boolean>(false);
  const [draftSettings, setDraftSettings] =
    useState<ComprehensiveEvaluationSettings>(
      mockDefaultComprehensiveEvaluationSettings,
    );
  const [draftSourceRulesetId, setDraftSourceRulesetId] = useState<
    string | null
  >(null);
  const [settingsTarget, setSettingsTarget] = useState<string>("default");
  const [settingsTargetSearch, setSettingsTargetSearch] = useState<string>("");
  const [templateActionMode, setTemplateActionMode] = useState<
    "apply" | "manage"
  >("apply");
  const [templatePickerId, setTemplatePickerId] = useState<string>("");
  const [templateEditorId, setTemplateEditorId] = useState<string>("");
  const [templateNameInput, setTemplateNameInput] = useState<string>("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedEmploymentType, setSelectedEmploymentType] = useState<
    EmploymentType | "all"
  >("all");
  const [selectedProcessingStatus, setSelectedProcessingStatus] = useState<
    ProcessingStatus | "all"
  >("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isExportDialogOpen, setIsExportDialogOpen] = useState<boolean>(false);
  const [isExportingCsv, setIsExportingCsv] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isProcessingUserId, setIsProcessingUserId] =
    useState<string | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);
  const [processSuccess, setProcessSuccess] = useState<string | null>(null);
  const [selectedExportColumns, setSelectedExportColumns] = useState<
    ComprehensiveEvaluationExportColumn[]
  >([...DEFAULT_COMPREHENSIVE_EVALUATION_EXPORT_COLUMNS]);
  const [levelDeltaInputs, setLevelDeltaInputs] = useState<
    Record<EvaluationRank, string>
  >(() => buildLevelDeltaInputs(mockDefaultComprehensiveEvaluationSettings));

  const selectedEvaluationPeriod = useMemo(
    () =>
      evaluationPeriods.find((period) => period.id === evaluationPeriodId) ??
      null,
    [evaluationPeriodId, evaluationPeriods],
  );
  const isSelectedPeriodCompleted =
    selectedEvaluationPeriod?.status === "completed";
  const isSettingsLocked = workspace?.locked ?? false;
  const { kind: settingsTargetKind, id: settingsTargetId } = useMemo(
    () => parseSettingsTarget(settingsTarget),
    [settingsTarget],
  );
  const isSelectedPeriodCancelled = selectedEvaluationPeriod?.status === "cancelled";
  const canProcessSelectedPeriod = Boolean(
    selectedEvaluationPeriod &&
      !isSelectedPeriodCancelled &&
      !isSelectedPeriodCompleted,
  );

  useEffect(() => {
    if (evaluationPeriodId !== "all") return;
    if (!defaultPeriodId || defaultPeriodId === "all") return;
    setEvaluationPeriodId(defaultPeriodId);
  }, [defaultPeriodId, evaluationPeriodId]);

  const loadRows = useCallback(async () => {
    const requestId = latestRowsRequestId.current + 1;
    latestRowsRequestId.current = requestId;

    if (!evaluationPeriodId || evaluationPeriodId === "all") {
      setRowsError(null);
      setIsRowsLoading(false);
      setEvaluationRows([]);
      return;
    }

    setIsRowsLoading(true);
    setRowsError(null);

    const firstPageResult = await getComprehensiveEvaluationListAction({
      periodId: evaluationPeriodId,
      page: 1,
      limit: COMPREHENSIVE_ROWS_PAGE_SIZE,
    });

    if (requestId !== latestRowsRequestId.current) return;

    if (!firstPageResult.success || !firstPageResult.data) {
      setEvaluationRows([]);
      setRowsError(
        firstPageResult.error ?? "総合評価データの取得に失敗しました",
      );
      setIsRowsLoading(false);
      return;
    }

    let mergedRows = [...firstPageResult.data.rows];
    const totalPages = firstPageResult.data.meta.pages;

    if (totalPages > 1) {
      const remainingPageResults = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) =>
          getComprehensiveEvaluationListAction({
            periodId: evaluationPeriodId,
            page: index + 2,
            limit: COMPREHENSIVE_ROWS_PAGE_SIZE,
          }),
        ),
      );

      if (requestId !== latestRowsRequestId.current) return;

      const failedPageResult = remainingPageResults.find(
        (result) => !result.success || !result.data,
      );
      if (failedPageResult) {
        setEvaluationRows([]);
        setRowsError(
          failedPageResult.error ?? "総合評価データの取得に失敗しました",
        );
        setIsRowsLoading(false);
        return;
      }

      mergedRows = [
        ...mergedRows,
        ...remainingPageResults.flatMap((result) => result.data?.rows ?? []),
      ];
    }

    if (requestId !== latestRowsRequestId.current) return;

    setEvaluationRows(mergedRows);
    setIsRowsLoading(false);
  }, [evaluationPeriodId]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const settingsAssignmentsByDepartment = useMemo(
    () =>
      new Map(
        (workspace?.departmentAssignments ?? [])
          .filter((assignment) => assignment.departmentId)
          .map((assignment) => [assignment.departmentId as UUID, assignment]),
      ),
    [workspace?.departmentAssignments],
  );
  const settingsAssignmentsByStage = useMemo(
    () =>
      new Map(
        (workspace?.stageAssignments ?? [])
          .filter((assignment) => assignment.stageId)
          .map((assignment) => [assignment.stageId as UUID, assignment]),
      ),
    [workspace?.stageAssignments],
  );

  const selectedSettingsDepartmentId =
    settingsTargetKind === "department" ? settingsTargetId : null;
  const selectedSettingsStageId =
    settingsTargetKind === "stage" ? settingsTargetId : null;
  const selectedSettingsDepartment = useMemo(
    () =>
      settingsDepartments.find(
        (department) => department.id === selectedSettingsDepartmentId,
      ) ?? null,
    [selectedSettingsDepartmentId, settingsDepartments],
  );
  const selectedSettingsStage = useMemo(
    () =>
      settingsStages.find((stage) => stage.id === selectedSettingsStageId) ??
      null,
    [selectedSettingsStageId, settingsStages],
  );
  const [isScopedOverrideDraftEnabled, setIsScopedOverrideDraftEnabled] =
    useState<boolean>(false);

  const currentSettingsAssignment = useMemo(() => {
    if (!workspace) return null;
    if (settingsTargetKind === "default") {
      return workspace.defaultAssignment;
    }

    if (settingsTargetKind === "department" && settingsTargetId) {
      const override = settingsAssignmentsByDepartment.get(settingsTargetId);
      if (override) return override;

      return {
        ...workspace.defaultAssignment,
        departmentId: settingsTargetId,
        departmentName: selectedSettingsDepartment?.name ?? null,
        stageId: null,
        stageName: null,
        inheritsDefault: true,
      };
    }

    if (settingsTargetKind === "stage" && settingsTargetId) {
      const override = settingsAssignmentsByStage.get(settingsTargetId);
      if (override) return override;

      return {
        ...workspace.defaultAssignment,
        departmentId: null,
        departmentName: null,
        stageId: settingsTargetId,
        stageName: selectedSettingsStage?.name ?? null,
        inheritsDefault: true,
      };
    }

    return workspace.defaultAssignment;
  }, [
    selectedSettingsDepartment?.name,
    selectedSettingsStage?.name,
    settingsAssignmentsByDepartment,
    settingsAssignmentsByStage,
    settingsTargetId,
    settingsTargetKind,
    workspace,
  ]);
  const selectedScopedAssignmentLabel =
    settingsTargetKind === "stage" ? "ステージ" : "部門";
  const selectedScopedAssignmentName =
    settingsTargetKind === "department"
      ? (selectedSettingsDepartment?.name ??
        currentSettingsAssignment?.departmentName ??
        "部門未選択")
      : (selectedSettingsStage?.name ??
        currentSettingsAssignment?.stageName ??
        "ステージ未選択");
  const currentSettingsTargetDisplayName =
    settingsTargetKind === "default"
      ? "この期間のデフォルト"
      : `${selectedScopedAssignmentLabel}: ${selectedScopedAssignmentName}`;

  const selectedTemplate = useMemo(
    () =>
      workspace?.templates.find(
        (template) => template.id === templatePickerId,
      ) ?? null,
    [templatePickerId, workspace?.templates],
  );

  const editableTemplate = useMemo(
    () =>
      workspace?.templates.find(
        (template) => template.id === templateEditorId,
      ) ?? null,
    [templateEditorId, workspace?.templates],
  );
  const settingsErrorSummary = useMemo(
    () => getSettingsErrorSummary(settingsError),
    [settingsError],
  );
  const normalizedTemplateNameInput = templateNameInput.trim();
  const createTemplateConflict = useMemo(
    () =>
      workspace?.templates.find(
        (template) =>
          normalizeTemplateName(template.name) ===
          normalizeTemplateName(normalizedTemplateNameInput),
      ) ?? null,
    [normalizedTemplateNameInput, workspace?.templates],
  );
  const updateTemplateConflict = useMemo(
    () =>
      workspace?.templates.find(
        (template) =>
          template.id !== editableTemplate?.id &&
          normalizeTemplateName(template.name) ===
            normalizeTemplateName(normalizedTemplateNameInput),
      ) ?? null,
    [editableTemplate?.id, normalizedTemplateNameInput, workspace?.templates],
  );
  const suggestedTemplateName = useMemo(
    () =>
      buildUniqueTemplateName(
        normalizedTemplateNameInput ||
          editableTemplate?.name ||
          "新しいテンプレート",
        workspace?.templates.map((template) => template.name) ?? [],
      ),
    [editableTemplate?.name, normalizedTemplateNameInput, workspace?.templates],
  );
  const canCreateTemplate =
    normalizedTemplateNameInput.length > 0 && createTemplateConflict === null;
  const canUpdateTemplate =
    Boolean(editableTemplate) &&
    normalizedTemplateNameInput.length > 0 &&
    updateTemplateConflict === null;
  const templateUsageSummary = useMemo(() => {
    const assignmentCounts = {
      default: workspace?.defaultAssignment.sourceRulesetId ? 1 : 0,
      department:
        workspace?.departmentAssignments.filter(
          (assignment) => assignment.sourceRulesetId,
        ).length ?? 0,
      stage:
        workspace?.stageAssignments.filter(
          (assignment) => assignment.sourceRulesetId,
        ).length ?? 0,
    };
    return assignmentCounts;
  }, [workspace]);
  const settingsTargetSections = useMemo(() => {
    if (!workspace) return [];

    return [
      {
        title: "期間デフォルト",
        items: [
          {
            value: "default",
            label: "この期間のデフォルト",
            badge: "基準",
            badgeTone: "base" as const,
            description:
              workspace.defaultAssignment.sourceRulesetNameSnapshot ??
              "テンプレート未指定のカスタム設定",
            isCustom: true,
          },
        ],
      },
      {
        title: "部門別",
        items: settingsDepartments.map((department) => {
          const assignment = settingsAssignmentsByDepartment.get(department.id);
          return {
            value: buildDepartmentSettingsTarget(department.id),
            label: department.name,
            badge: assignment ? "上書き" : "継承",
            badgeTone: assignment
              ? ("override" as const)
              : ("inherit" as const),
            description:
              assignment?.sourceRulesetNameSnapshot ??
              (assignment ? "カスタム設定" : "期間デフォルトを継承"),
            isCustom: Boolean(assignment),
          };
        }),
      },
      {
        title: "ステージ別",
        items: settingsStages.map((stage) => {
          const assignment = settingsAssignmentsByStage.get(stage.id);
          return {
            value: buildStageSettingsTarget(stage.id),
            label: stage.name,
            badge: assignment ? "上書き" : "継承",
            badgeTone: assignment
              ? ("override" as const)
              : ("inherit" as const),
            description:
              assignment?.sourceRulesetNameSnapshot ??
              (assignment ? "カスタム設定" : "期間デフォルトを継承"),
            isCustom: Boolean(assignment),
          };
        }),
      },
    ];
  }, [
    settingsAssignmentsByDepartment,
    settingsAssignmentsByStage,
    settingsDepartments,
    settingsStages,
    workspace,
  ]);
  const filteredSettingsTargetSections = useMemo(() => {
    const normalizedSearch = settingsTargetSearch.trim().toLocaleLowerCase();
    if (!normalizedSearch) return settingsTargetSections;

    return settingsTargetSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (item.value === settingsTarget) return true;
          const haystack =
            `${item.label} ${item.description} ${item.badge}`.toLocaleLowerCase();
          return haystack.includes(normalizedSearch);
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [settingsTarget, settingsTargetSearch, settingsTargetSections]);

  const isSettingsEditorDisabled =
    isSettingsLocked ||
    (settingsTargetKind !== "default" && !isScopedOverrideDraftEnabled);

  useEffect(() => {
    if (!settingsDialogOpen || !currentSettingsAssignment) return;
    setDraftSettings(currentSettingsAssignment.settings);
    setDraftSourceRulesetId(currentSettingsAssignment.sourceRulesetId ?? null);
    setLevelDeltaInputs(
      buildLevelDeltaInputs(currentSettingsAssignment.settings),
    );
    setIsScopedOverrideDraftEnabled(!currentSettingsAssignment.inheritsDefault);
    const fallbackTemplateId =
      currentSettingsAssignment.sourceRulesetId ??
      workspace?.templates.find((template) => template.isDefaultTemplate)?.id ??
      workspace?.templates[0]?.id ??
      "";
    setTemplatePickerId(fallbackTemplateId);
    setTemplateEditorId((prev) => {
      if (
        prev &&
        workspace?.templates.some((template) => template.id === prev)
      ) {
        return prev;
      }
      return fallbackTemplateId;
    });
  }, [currentSettingsAssignment, settingsDialogOpen, workspace]);

  useEffect(() => {
    if (!settingsDialogOpen) return;
    const template =
      workspace?.templates.find((item) => item.id === templateEditorId) ??
      workspace?.templates.find((item) => item.id === draftSourceRulesetId) ??
      workspace?.templates[0] ??
      null;
    setTemplateNameInput(template?.name ?? "");
  }, [draftSourceRulesetId, settingsDialogOpen, templateEditorId, workspace]);

  const handleSettingsDialogOpenChange = (nextOpen: boolean) => {
    setSettingsDialogOpen(nextOpen);
    if (!nextOpen) return;
    setSettingsTarget("default");
    setTemplateActionMode("apply");
  };

  const resetDraftSettingsToDefault = () => {
    setDraftSettings(mockDefaultComprehensiveEvaluationSettings);
    setDraftSourceRulesetId(null);
    setLevelDeltaInputs(
      buildLevelDeltaInputs(mockDefaultComprehensiveEvaluationSettings),
    );
  };

  const filterDepartments = useMemo(() => {
    const unique = new Set<string>();
    evaluationRows.forEach((row) => {
      if (row.departmentName) unique.add(row.departmentName);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "ja"));
  }, [evaluationRows]);

  const stages = useMemo(() => {
    const unique = new Set<string>();
    evaluationRows.forEach((row) => {
      if (row.currentStage) unique.add(row.currentStage);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "ja"));
  }, [evaluationRows]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return evaluationRows.filter((row) => {
      if (
        evaluationPeriodId !== "all" &&
        row.evaluationPeriodId !== evaluationPeriodId
      )
        return false;
      if (
        selectedDepartment !== "all" &&
        row.departmentName !== selectedDepartment
      )
        return false;
      if (selectedStage !== "all" && row.currentStage !== selectedStage)
        return false;
      if (
        selectedEmploymentType !== "all" &&
        row.employmentType !== selectedEmploymentType
      )
        return false;
      if (
        selectedProcessingStatus !== "all" &&
        row.processingStatus !== selectedProcessingStatus
      )
        return false;

      if (!normalizedQuery) return true;
      return buildSearchText(row).includes(normalizedQuery);
    });
  }, [
    evaluationRows,
    evaluationPeriodId,
    searchQuery,
    selectedDepartment,
    selectedStage,
    selectedEmploymentType,
    selectedProcessingStatus,
  ]);

  const exportFilterSummaries = useMemo(() => {
    const summaries = [
      `対象期間: ${selectedEvaluationPeriod?.label ?? "-"}`,
      `出力件数: ${filteredRows.length}件`,
    ];

    if (selectedDepartment !== "all") {
      summaries.push(`部署: ${selectedDepartment}`);
    }
    if (selectedStage !== "all") {
      summaries.push(`ステージ: ${selectedStage}`);
    }
    if (selectedEmploymentType !== "all") {
      summaries.push(
        `雇用形態: ${getEmploymentTypeLabel(selectedEmploymentType)}`,
      );
    }
    if (selectedProcessingStatus !== "all") {
      summaries.push(
        `処理状態: ${getComprehensiveEvaluationProcessingStatusLabel(
          selectedProcessingStatus,
        )}`,
      );
    }
    if (searchQuery.trim()) {
      summaries.push(`検索: ${searchQuery.trim()}`);
    }

    return summaries;
  }, [
    filteredRows.length,
    searchQuery,
    selectedDepartment,
    selectedEmploymentType,
    selectedEvaluationPeriod?.label,
    selectedProcessingStatus,
    selectedStage,
  ]);

  const canDownloadCsv = Boolean(
    selectedEvaluationPeriod &&
      filteredRows.length > 0 &&
      selectedExportColumns.length > 0 &&
      !isExportingCsv,
  );

  const handleClearFilters = () => {
    setEvaluationPeriodId(defaultPeriodId);
    setSelectedDepartment("all");
    setSelectedStage("all");
    setSelectedEmploymentType("all");
    setSelectedProcessingStatus("all");
    setSearchQuery("");
  };

  const handleExportDialogOpenChange = (nextOpen: boolean) => {
    setIsExportDialogOpen(nextOpen);
    if (nextOpen) {
      setExportError(null);
      return;
    }
    setExportError(null);
    setSelectedExportColumns([...DEFAULT_COMPREHENSIVE_EVALUATION_EXPORT_COLUMNS]);
  };

  const handleToggleExportColumn = (
    column: ComprehensiveEvaluationExportColumn,
    checked: boolean,
  ) => {
    setSelectedExportColumns((prev) => {
      if (checked) {
        const next = new Set(prev);
        next.add(column);
        return COMPREHENSIVE_EVALUATION_EXPORT_COLUMNS
          .map((option) => option.key)
          .filter((key) => next.has(key));
      }

      return prev.filter((key) => key !== column);
    });
  };

  const handleDownloadCsv = async () => {
    if (!selectedEvaluationPeriod || !canDownloadCsv) return;

    setExportError(null);
    setIsExportingCsv(true);

    const result = await exportComprehensiveEvaluationCsvAction({
      periodId: selectedEvaluationPeriod.id,
      departmentName:
        selectedDepartment !== "all" ? selectedDepartment : undefined,
      stageName: selectedStage !== "all" ? selectedStage : undefined,
      employmentType:
        selectedEmploymentType !== "all" ? selectedEmploymentType : undefined,
      processingStatus:
        selectedProcessingStatus !== "all"
          ? selectedProcessingStatus
          : undefined,
      search: searchQuery.trim() || undefined,
      columns: selectedExportColumns,
    });

    setIsExportingCsv(false);

    if (!result.success || !result.data) {
      setExportError(result.error ?? "CSVの出力に失敗しました");
      return;
    }

    const filename = buildComprehensiveEvaluationCsvFilename(
      selectedEvaluationPeriod.label,
    );
    const blob = new Blob([result.data], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);

    handleExportDialogOpenChange(false);
  };

  const handleProcessUser = async (row: ComprehensiveEvaluationRowResponse) => {
    if (!isEvalAdmin || !canProcessSelectedPeriod) return;

    setProcessError(null);
    setProcessSuccess(null);
    setIsProcessingUserId(row.userId);
    const result = await processComprehensiveEvaluationUserAction(row.evaluationPeriodId, row.userId);

    setIsProcessingUserId(null);

    if (!result.success || !result.data) {
      setProcessError(result.error ?? "ユーザー評価の処理に失敗しました");
      return;
    }

    setProcessSuccess(`${row.name}（${row.employeeCode}）の評価を処理しました。`);
    await loadRows();
  };

  const handleSaveSettings = async () => {
    const normalizedInputs: Record<EvaluationRank, string> = {
      ...levelDeltaInputs,
    };
    const normalizedLevelDeltaByOverallRank = {
      ...draftSettings.levelDeltaByOverallRank,
    };

    EVALUATION_RANKS.forEach((rank) => {
      const parsed = parseNumericInput(levelDeltaInputs[rank]);
      if (parsed === null) {
        normalizedInputs[rank] = String(
          draftSettings.levelDeltaByOverallRank[rank] ?? "",
        );
        return;
      }
      normalizedInputs[rank] = String(parsed);
      normalizedLevelDeltaByOverallRank[rank] = parsed;
    });

    const settingsToSave: ComprehensiveEvaluationSettings = {
      ...draftSettings,
      levelDeltaByOverallRank: normalizedLevelDeltaByOverallRank,
    };

    setLevelDeltaInputs(normalizedInputs);
    setDraftSettings(settingsToSave);
    let result: { success: boolean };
    if (settingsTargetKind === "default") {
      result = await updateDefaultAssignment(
        settingsToSave,
        draftSourceRulesetId,
      );
    } else if (settingsTargetKind === "department" && settingsTargetId) {
      result = await updateDepartmentAssignment(settingsTargetId, {
        inheritDefault: false,
        settings: settingsToSave,
        sourceRulesetId: draftSourceRulesetId,
      });
    } else if (settingsTargetKind === "stage" && settingsTargetId) {
      result = await updateStageAssignment(settingsTargetId, {
        inheritDefault: false,
        settings: settingsToSave,
        sourceRulesetId: draftSourceRulesetId,
      });
    } else {
      return;
    }
    if (!result.success) return;
    await loadRows();
  };

  const addPromotionGroup = () => {
    setDraftSettings((prev) => ({
      ...prev,
      promotion: {
        ...prev.promotion,
        ruleGroups: [
          ...prev.promotion.ruleGroups,
          {
            id: createId("promotion-group"),
            conditions: [createPromotionCondition("overallRank")],
          },
        ],
      },
    }));
  };

  const removePromotionGroup = (groupId: string) => {
    setDraftSettings((prev) => ({
      ...prev,
      promotion: {
        ...prev.promotion,
        ruleGroups: prev.promotion.ruleGroups.filter(
          (group) => group.id !== groupId,
        ),
      },
    }));
  };

  const addPromotionCondition = (groupId: string) => {
    setDraftSettings((prev) => ({
      ...prev,
      promotion: {
        ...prev.promotion,
        ruleGroups: prev.promotion.ruleGroups.map((group) => {
          if (group.id !== groupId) return group;
          return {
            ...group,
            conditions: [
              ...group.conditions,
              createPromotionCondition("overallRank"),
            ],
          };
        }),
      },
    }));
  };

  const removePromotionCondition = (groupId: string, index: number) => {
    setDraftSettings((prev) => ({
      ...prev,
      promotion: {
        ...prev.promotion,
        ruleGroups: prev.promotion.ruleGroups.map((group) => {
          if (group.id !== groupId) return group;
          return {
            ...group,
            conditions: group.conditions.filter((_, i) => i !== index),
          };
        }),
      },
    }));
  };

  const updatePromotionConditionTarget = (
    groupId: string,
    index: number,
    target: PromotionConditionTarget,
  ) => {
    setDraftSettings((prev) => ({
      ...prev,
      promotion: {
        ...prev.promotion,
        ruleGroups: prev.promotion.ruleGroups.map((group) => {
          if (group.id !== groupId) return group;
          const existing = group.conditions[index];
          const fallbackRank =
            existing?.type === "rank_at_least" ? existing.minimumRank : "A+";

          return {
            ...group,
            conditions: group.conditions.map((condition, i) => {
              if (i !== index) return condition;
              return createPromotionCondition(target, fallbackRank);
            }),
          };
        }),
      },
    }));
  };

  const updatePromotionConditionMinimumRank = (
    groupId: string,
    index: number,
    minimumRank: EvaluationRank,
  ) => {
    setDraftSettings((prev) => ({
      ...prev,
      promotion: {
        ...prev.promotion,
        ruleGroups: prev.promotion.ruleGroups.map((group) => {
          if (group.id !== groupId) return group;
          return {
            ...group,
            conditions: group.conditions.map((condition, i) => {
              if (i !== index) return condition;
              if (condition.type !== "rank_at_least") return condition;
              return { ...condition, minimumRank };
            }),
          };
        }),
      },
    }));
  };

  const addDemotionGroup = () => {
    setDraftSettings((prev) => ({
      ...prev,
      demotion: {
        ...prev.demotion,
        ruleGroups: [
          ...prev.demotion.ruleGroups,
          {
            id: createId("demotion-group"),
            conditions: [createDemotionCondition("overallRank")],
          },
        ],
      },
    }));
  };

  const removeDemotionGroup = (groupId: string) => {
    setDraftSettings((prev) => ({
      ...prev,
      demotion: {
        ...prev.demotion,
        ruleGroups: prev.demotion.ruleGroups.filter(
          (group) => group.id !== groupId,
        ),
      },
    }));
  };

  const addDemotionCondition = (groupId: string) => {
    setDraftSettings((prev) => ({
      ...prev,
      demotion: {
        ...prev.demotion,
        ruleGroups: prev.demotion.ruleGroups.map((group) => {
          if (group.id !== groupId) return group;
          return {
            ...group,
            conditions: [
              ...group.conditions,
              createDemotionCondition("overallRank"),
            ],
          };
        }),
      },
    }));
  };

  const removeDemotionCondition = (groupId: string, index: number) => {
    setDraftSettings((prev) => ({
      ...prev,
      demotion: {
        ...prev.demotion,
        ruleGroups: prev.demotion.ruleGroups.map((group) => {
          if (group.id !== groupId) return group;
          return {
            ...group,
            conditions: group.conditions.filter((_, i) => i !== index),
          };
        }),
      },
    }));
  };

  const updateDemotionConditionTarget = (
    groupId: string,
    index: number,
    target: DemotionConditionTarget,
  ) => {
    setDraftSettings((prev) => ({
      ...prev,
      demotion: {
        ...prev.demotion,
        ruleGroups: prev.demotion.ruleGroups.map((group) => {
          if (group.id !== groupId) return group;
          const existing = group.conditions[index];
          const fallbackRank =
            existing?.type === "rank_at_or_worse"
              ? existing.thresholdRank
              : "D";

          return {
            ...group,
            conditions: group.conditions.map((condition, i) => {
              if (i !== index) return condition;
              return createDemotionCondition(target, fallbackRank);
            }),
          };
        }),
      },
    }));
  };

  const updateDemotionConditionThresholdRank = (
    groupId: string,
    index: number,
    thresholdRank: EvaluationRank,
  ) => {
    setDraftSettings((prev) => ({
      ...prev,
      demotion: {
        ...prev.demotion,
        ruleGroups: prev.demotion.ruleGroups.map((group) => {
          if (group.id !== groupId) return group;
          return {
            ...group,
            conditions: group.conditions.map((condition, i) => {
              if (i !== index) return condition;
              if (condition.type !== "rank_at_or_worse") return condition;
              return { ...condition, thresholdRank };
            }),
          };
        }),
      },
    }));
  };

  const commitNumericInput = (
    rawValue: string,
    fallback: number,
    setInput: (value: string) => void,
    onCommit: (value: number) => void,
  ) => {
    const parsed = parseNumericInput(rawValue);
    if (parsed === null) {
      setInput(String(fallback));
      return;
    }
    setInput(String(parsed));
    if (parsed === fallback) return;
    onCommit(parsed);
  };

  const loadTemplateIntoRuleEditor = useCallback(
    (templateId: string) => {
      const template = workspace?.templates.find((item) => item.id === templateId);
      if (!template) return;

      setDraftSettings(template.settings);
      setDraftSourceRulesetId(template.id);
      setLevelDeltaInputs(buildLevelDeltaInputs(template.settings));

      if (settingsTargetKind !== "default") {
        setIsScopedOverrideDraftEnabled(true);
      }
    },
    [settingsTargetKind, workspace?.templates],
  );

  const handleSelectTemplateInLibrary = (templateId: string) => {
    setTemplatePickerId(templateId);
    setTemplateEditorId(templateId);
    loadTemplateIntoRuleEditor(templateId);
  };

  const handleEnterTemplateManageMode = () => {
    setTemplateActionMode("manage");

    const nextTemplateId =
      templateEditorId ||
      draftSourceRulesetId ||
      workspace?.templates[0]?.id ||
      "";

    if (!nextTemplateId) return;

    setTemplateEditorId(nextTemplateId);
    loadTemplateIntoRuleEditor(nextTemplateId);
  };

  const handleApplyTemplateToDraft = () => {
    if (!selectedTemplate) return;
    setDraftSettings(selectedTemplate.settings);
    setDraftSourceRulesetId(selectedTemplate.id);
    setLevelDeltaInputs(buildLevelDeltaInputs(selectedTemplate.settings));
    if (settingsTargetKind !== "default") {
      setIsScopedOverrideDraftEnabled(true);
    }
  };

  const handleCreateTemplateFromDraft = async () => {
    if (!canCreateTemplate) return;
    const result = await createRuleset(
      normalizedTemplateNameInput,
      draftSettings,
      false,
    );
    if (!result.success || !result.data) return;
    setTemplateEditorId(result.data);
    setTemplatePickerId(result.data);
    setTemplateActionMode("apply");
  };

  const handleUpdateTemplateFromDraft = async () => {
    if (!editableTemplate || !canUpdateTemplate) return;
    const result = await updateRuleset(
      editableTemplate.id,
      normalizedTemplateNameInput,
      draftSettings,
      editableTemplate.isDefaultTemplate,
    );
    if (!result.success) return;
  };

  const handleDuplicateTemplateFromDraft = async () => {
    const baseName =
      normalizedTemplateNameInput ||
      editableTemplate?.name ||
      "新しいテンプレート";
    const result = await createRuleset(
      buildUniqueTemplateName(
        `${baseName} Copy`,
        workspace?.templates.map((template) => template.name) ?? [],
      ),
      draftSettings,
      false,
    );
    if (!result.success || !result.data) return;
    setTemplateEditorId(result.data);
    setTemplatePickerId(result.data);
    setTemplateActionMode("apply");
  };

  const handleDeleteTemplate = async () => {
    if (!editableTemplate) return;
    const result = await deleteRuleset(editableTemplate.id);
    if (!result.success) return;
    setTemplateEditorId("");
    setTemplatePickerId("");
    if (draftSourceRulesetId === editableTemplate.id) {
      setDraftSourceRulesetId(null);
    }
  };

  const handleSetTemplateAsDefault = async () => {
    if (!editableTemplate || !canUpdateTemplate) return;
    await updateRuleset(
      editableTemplate.id,
      normalizedTemplateNameInput,
      draftSettings,
      true,
    );
  };

  const handleEnableScopedOverride = () => {
    setIsScopedOverrideDraftEnabled(true);
    setDraftSourceRulesetId(currentSettingsAssignment?.sourceRulesetId ?? null);
  };

  const handleResetScopedInheritance = async () => {
    if (settingsTargetKind === "default") return;

    if (currentSettingsAssignment?.inheritsDefault) {
      setIsScopedOverrideDraftEnabled(false);
      setDraftSettings(
        workspace?.defaultAssignment.settings ??
          mockDefaultComprehensiveEvaluationSettings,
      );
      setDraftSourceRulesetId(
        workspace?.defaultAssignment.sourceRulesetId ?? null,
      );
      setLevelDeltaInputs(
        buildLevelDeltaInputs(
          workspace?.defaultAssignment.settings ??
            mockDefaultComprehensiveEvaluationSettings,
        ),
      );
      return;
    }

    let result: { success: boolean };
    if (settingsTargetKind === "department" && settingsTargetId) {
      result = await updateDepartmentAssignment(settingsTargetId, {
        inheritDefault: true,
      });
    } else if (settingsTargetKind === "stage" && settingsTargetId) {
      result = await updateStageAssignment(settingsTargetId, {
        inheritDefault: true,
      });
    } else {
      return;
    }
    if (!result.success) return;
    await loadRows();
    setIsScopedOverrideDraftEnabled(false);
  };

  const currentSettingsSnapshot = useMemo(
    () =>
      JSON.stringify(
        toApiSettings(
          currentSettingsAssignment?.settings ??
            mockDefaultComprehensiveEvaluationSettings,
        ),
      ),
    [currentSettingsAssignment],
  );
  const draftSettingsSnapshot = useMemo(
    () => JSON.stringify(toApiSettings(draftSettings)),
    [draftSettings],
  );

  const hasUnsavedSettingsChanges =
    draftSettingsSnapshot !== currentSettingsSnapshot ||
    draftSourceRulesetId !==
      (currentSettingsAssignment?.sourceRulesetId ?? null) ||
    (settingsTargetKind !== "default" &&
      currentSettingsAssignment?.inheritsDefault === true &&
      isScopedOverrideDraftEnabled) ||
    EVALUATION_RANKS.some(
      (rank) =>
        levelDeltaInputs[rank] !==
        String(draftSettings.levelDeltaByOverallRank[rank] ?? ""),
    );

  if (isRoleLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
        <span className="ml-2 text-sm text-muted-foreground">
          権限確認中...
        </span>
      </div>
    );
  }

  if (roleError || !currentUser) {
    return (
      <Alert variant="destructive">
        <ShieldX className="h-4 w-4" />
        <AlertDescription>
          {roleError || "ユーザー情報の取得に失敗しました"}
        </AlertDescription>
      </Alert>
    );
  }

  if (!canAccessComprehensiveEvaluation) {
    return (
      <Alert variant="destructive">
        <ShieldX className="h-4 w-4" />
        <AlertDescription>
          このページはadmin / eval_adminのみ閲覧できます
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">総合評価</h1>
          <p className="text-sm text-muted-foreground">
            総合評価テーブルをAPIデータで表示します。昇格フラグは「正社員かつ昇格判別ルールを満たす」場合に点灯します（ステージは自動更新しません）。昇格フラグ点灯行は、昇格フラグ対応ページでステージ変更と反映後レベルを個別に判断してください。
          </p>
          <p className="text-sm text-muted-foreground">
            評価期間のステータス変更は、評価期間管理画面から行ってください。入力終了後は、この画面での処理とスコア変更はできません。
          </p>
          {isSelectedPeriodCompleted && (
            <p className="text-sm text-muted-foreground">
              この評価期間は入力終了済みのため、未処理ユーザーの「処理する」は実行できません。必要な個別判断は、既に処理済みのユーザーのみ別画面で継続してください。
            </p>
          )}
          {isSelectedPeriodCancelled && (
            <p className="text-sm text-destructive">
              評価期間がキャンセル済みのため、ユーザー処理はできません。
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isEvalAdmin && (
            <Dialog
              open={isExportDialogOpen}
              onOpenChange={handleExportDialogOpenChange}
            >
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="flex items-center gap-2"
                  disabled={!selectedEvaluationPeriod}
                >
                  <Download className="h-4 w-4" />
                  CSV出力
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>CSV出力</DialogTitle>
                  <DialogDescription>
                    出力対象の列を選択して、現在の絞り込み結果をCSVでダウンロードします。
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">現在の出力条件</div>
                    <div className="flex flex-wrap gap-2">
                      {exportFilterSummaries.map((summary) => (
                        <Badge key={summary} variant="outline">
                          {summary}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {exportError && (
                    <Alert variant="destructive">
                      <AlertDescription>{exportError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">CSVに含める列</div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setSelectedExportColumns([
                              ...DEFAULT_COMPREHENSIVE_EVALUATION_EXPORT_COLUMNS,
                            ])
                          }
                        >
                          すべて選択
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedExportColumns([])}
                        >
                          すべて解除
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {COMPREHENSIVE_EVALUATION_EXPORT_COLUMNS.map((column) => {
                        const checked = selectedExportColumns.includes(
                          column.key,
                        );
                        const inputId = `export-column-${column.key}`;

                        return (
                          <label
                            key={column.key}
                            htmlFor={inputId}
                            className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
                          >
                            <Checkbox
                              id={inputId}
                              checked={checked}
                              onCheckedChange={(value) =>
                                handleToggleExportColumn(
                                  column.key,
                                  value === true,
                                )
                              }
                            />
                            <span>{column.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleExportDialogOpenChange(false)}
                    disabled={isExportingCsv}
                  >
                    キャンセル
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleDownloadCsv()}
                    disabled={!canDownloadCsv}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    {isExportingCsv ? "ダウンロード中..." : "ダウンロード"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {isEvalAdmin && (
            <Button asChild variant="outline">
              <Link href="/evaluation-period-management">
                評価期間管理へ
              </Link>
            </Button>
          )}
          {canAccessCandidates && (
            <Button asChild variant="outline">
              <Link href="/admin-eval-list/candidates">
                昇格/降格フラグ対応
              </Link>
            </Button>
          )}
          {canEditThresholds && (
            <Dialog
              open={settingsDialogOpen}
              onOpenChange={handleSettingsDialogOpenChange}
            >
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="flex items-center gap-2"
                  disabled={!selectedEvaluationPeriod}
                >
                  <Settings className="h-4 w-4" />
                  判定ルール設定
                </Button>
              </DialogTrigger>
              <DialogContent className="grid max-h-[92vh] w-[min(1320px,calc(100vw-2rem))] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0 sm:max-w-none">
                <DialogHeader className="border-b border-slate-200 px-6 py-5 pr-14 sm:px-8 sm:py-6">
                  <DialogTitle>判定ルール設定</DialogTitle>
                  <DialogDescription>
                    選択中の評価期間に対するデフォルト設定と、部門別・ステージ別の上書き設定を管理します。
                  </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 overflow-y-auto px-6 py-5 sm:px-8 sm:py-6">
                  {isSettingsLoading ||
                  !workspace ||
                  !currentSettingsAssignment ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      設定を読み込み中...
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {settingsErrorSummary && (
                        <Alert variant="destructive">
                          <AlertTitle>{settingsErrorSummary.title}</AlertTitle>
                          <AlertDescription>
                            {settingsErrorSummary.description}
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-slate-700">
                                対象期間
                              </span>
                              <Badge
                                variant={
                                  isSettingsLocked ? "secondary" : "outline"
                                }
                              >
                                {selectedEvaluationPeriod?.label ?? "-"}
                              </Badge>
                              {isSettingsLocked && (
                                <Badge variant="secondary">ロック中</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              左で対象を選び、右側でテンプレート適用とルール編集を進めます。スクロールはこの中央領域だけです。
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <Badge variant="outline">
                              テンプレート {workspace.templates.length}
                            </Badge>
                            <Badge variant="outline">
                              部門上書き{" "}
                              {workspace.departmentAssignments.length}
                            </Badge>
                            <Badge variant="outline">
                              ステージ上書き {workspace.stageAssignments.length}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                        <div className="space-y-4 lg:sticky lg:top-0 lg:self-start">
                          <Card className="gap-0 border border-slate-200 bg-slate-50/60 shadow-none">
                            <CardHeader className="border-b border-slate-100 pb-4">
                              <CardTitle className="text-base">
                                適用対象ナビゲーション
                              </CardTitle>
                              <CardDescription>
                                デフォルト、部門、ステージのどこを編集するかを一覧から選択します。
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-6">
                              <div className="space-y-2">
                                <Label htmlFor="settings-target-search">
                                  対象を検索
                                </Label>
                                <div className="relative">
                                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                  <Input
                                    id="settings-target-search"
                                    value={settingsTargetSearch}
                                    onChange={(event) =>
                                      setSettingsTargetSearch(
                                        event.target.value,
                                      )
                                    }
                                    placeholder="部門名・ステージ名で検索"
                                    className="pl-9"
                                  />
                                </div>
                              </div>

                              <div className="space-y-5">
                                {filteredSettingsTargetSections.length === 0 ? (
                                  <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-muted-foreground">
                                    条件に一致する適用対象がありません。
                                  </div>
                                ) : (
                                  filteredSettingsTargetSections.map(
                                    (section) => (
                                      <div
                                        key={section.title}
                                        className="space-y-2"
                                      >
                                        <div className="flex items-center justify-between">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                            {section.title}
                                          </p>
                                          {section.items.length > 1 && (
                                            <span className="text-xs text-muted-foreground">
                                              {
                                                section.items.filter(
                                                  (item) => item.isCustom,
                                                ).length
                                              }
                                              /{section.items.length}
                                            </span>
                                          )}
                                        </div>
                                        <div className="space-y-2">
                                          {section.items.map((item) => (
                                            <button
                                              key={item.value}
                                              type="button"
                                              onClick={() =>
                                                setSettingsTarget(item.value)
                                              }
                                              className={cn(
                                                "w-full rounded-xl border px-3 py-3 text-left transition",
                                                settingsTarget === item.value
                                                  ? "border-sky-500 bg-sky-50 shadow-sm"
                                                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                                              )}
                                            >
                                              <div className="flex items-center justify-between gap-2">
                                                <span className="truncate text-sm font-medium">
                                                  {item.label}
                                                </span>
                                                <Badge
                                                  variant="outline"
                                                  className={cn(
                                                    "shrink-0 gap-1.5 border font-semibold",
                                                    getSettingsTargetBadgeClasses(
                                                      item.badgeTone,
                                                    ),
                                                  )}
                                                >
                                                  <span
                                                    className={cn(
                                                      "h-1.5 w-1.5 rounded-full",
                                                      getSettingsTargetBadgeDotClasses(
                                                        item.badgeTone,
                                                      ),
                                                    )}
                                                  />
                                                  {item.badge}
                                                </Badge>
                                              </div>
                                              <p className="mt-1 text-xs text-muted-foreground">
                                                {item.description}
                                              </p>
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    ),
                                  )
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        <div className="space-y-4">
                          <Card className="gap-0 border border-slate-200 bg-white shadow-none">
                            <CardHeader className="border-b border-slate-100 pb-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <CardTitle className="text-base">
                                    テンプレート操作
                                  </CardTitle>
                                  <CardDescription>
                                    「テンプレートを作る」と「対象へ適用する」を分けて操作できます。下の手順に沿えば迷わず進められます。
                                  </CardDescription>
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs">
                                  <Badge variant="outline">
                                    総数 {workspace.templates.length}
                                  </Badge>
                                  <Badge variant="outline">
                                    割当中{" "}
                                    {templateUsageSummary.department +
                                      templateUsageSummary.stage +
                                      templateUsageSummary.default}
                                  </Badge>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-5 pt-6">
                              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="space-y-1">
                                    <p className="text-sm font-semibold text-slate-900">
                                      今回変更する対象
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      左で選んだ
                                      <span className="mx-1 font-semibold text-slate-900">
                                        {currentSettingsTargetDisplayName}
                                      </span>
                                      に対して、この下の操作を行います。
                                    </p>
                                  </div>
                                  <Badge variant="outline">
                                    最後に画面下の「保存」で反映
                                  </Badge>
                                </div>
                              </div>

                              <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                                <button
                                  type="button"
                                  onClick={() => setTemplateActionMode("apply")}
                                  className={cn(
                                    "rounded-xl px-4 py-2 text-sm font-medium transition",
                                    templateActionMode === "apply"
                                      ? "bg-white text-slate-900 shadow-sm"
                                      : "text-muted-foreground hover:text-slate-900",
                                  )}
                                >
                                  既存テンプレートを適用
                                </button>
                                <button
                                  type="button"
                                  onClick={handleEnterTemplateManageMode}
                                  className={cn(
                                    "rounded-xl px-4 py-2 text-sm font-medium transition",
                                    templateActionMode === "manage"
                                      ? "bg-white text-slate-900 shadow-sm"
                                      : "text-muted-foreground hover:text-slate-900",
                                  )}
                                >
                                  テンプレートを作成・管理
                                </button>
                              </div>

                              {templateActionMode === "apply" ? (
                                <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
                                  <div className="space-y-1">
                                    <p className="text-sm font-semibold text-emerald-900">
                                      1. 適用したいテンプレートを選ぶ
                                    </p>
                                    <p className="text-xs text-emerald-800">
                                      ここには既定テンプレートと、あとから自分で作成したテンプレートの両方が表示されます。
                                    </p>
                                  </div>

                                  <Select
                                    value={templatePickerId}
                                    onValueChange={setTemplatePickerId}
                                  >
                                    <SelectTrigger id="template-picker">
                                      <SelectValue placeholder="テンプレートを選択" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {workspace.templates.map((template) => (
                                        <SelectItem
                                          key={template.id}
                                          value={template.id}
                                        >
                                          {template.name}
                                          {template.isDefaultTemplate
                                            ? "（既定）"
                                            : ""}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>

                                  {selectedTemplate && (
                                    <div className="rounded-xl border border-emerald-200 bg-white px-4 py-4 text-sm">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-medium text-slate-900">
                                          {selectedTemplate.name}
                                        </span>
                                        {selectedTemplate.isDefaultTemplate && (
                                          <Badge variant="outline">既定</Badge>
                                        )}
                                        {selectedTemplate.id ===
                                          draftSourceRulesetId && (
                                          <Badge variant="secondary">
                                            現在の読込元
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="mt-2 text-xs text-muted-foreground">
                                        {selectedTemplate.updatedAt
                                          ? `更新日: ${new Date(selectedTemplate.updatedAt).toLocaleDateString("ja-JP")}`
                                          : "テンプレート"}
                                      </p>
                                    </div>
                                  )}

                                  <div className="rounded-xl border border-dashed border-emerald-200 bg-white px-4 py-4 text-xs text-emerald-900">
                                    2.
                                    「選択したテンプレートを現在の対象へ適用」を押す
                                    <br />
                                    3.
                                    この画面の一番下にある「保存」を押して反映する
                                  </div>

                                  <Button
                                    type="button"
                                    onClick={() =>
                                      void handleApplyTemplateToDraft()
                                    }
                                    disabled={
                                      !selectedTemplate ||
                                      isSettingsEditorDisabled
                                    }
                                    className="w-full sm:w-auto"
                                  >
                                    選択したテンプレートを現在の対象へ適用
                                  </Button>
                                </div>
                              ) : (
                                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                  <div className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50/50 p-5">
                                    <div className="space-y-1">
                                      <p className="text-sm font-semibold text-sky-900">
                                        新しいテンプレートを作る
                                      </p>
                                      <p className="text-xs text-sky-800">
                                        右下のルールエディタで今の内容を整えたあと、名前を付けて保存します。
                                      </p>
                                      <p className="text-xs text-sky-800">
                                        テンプレートを保存しただけでは、この対象にはまだ適用されません。
                                      </p>
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="template-name">
                                        新しいテンプレート名
                                      </Label>
                                      <Input
                                        id="template-name"
                                        value={templateNameInput}
                                        onChange={(e) =>
                                          setTemplateNameInput(e.target.value)
                                        }
                                        placeholder="例: 営業部向け 2026上期"
                                      />
                                    </div>

                                    {createTemplateConflict && (
                                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                        同名テンプレートがあります。別名案:
                                        <button
                                          type="button"
                                          className="ml-1 font-semibold underline"
                                          onClick={() =>
                                            setTemplateNameInput(
                                              suggestedTemplateName,
                                            )
                                          }
                                        >
                                          {suggestedTemplateName}
                                        </button>
                                      </div>
                                    )}

                                    <Button
                                      type="button"
                                      onClick={() =>
                                        void handleCreateTemplateFromDraft()
                                      }
                                      disabled={
                                        !canCreateTemplate || isSettingsSaving
                                      }
                                      className="w-full"
                                    >
                                      現在の設定を新しいテンプレートとして保存
                                    </Button>

                                    <p className="text-xs text-sky-900">
                                      保存後は自動で「既存テンプレートを適用」に切り替わるので、そのまま適用できます。
                                    </p>
                                  </div>

                                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
                                    <div className="space-y-1">
                                      <p className="text-sm font-semibold text-slate-900">
                                        既存テンプレートを編集する
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        既にあるテンプレートを更新、複製、既定化、削除します。
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        ここでテンプレートを更新しても、この対象には自動適用されません。適用したい場合は「既存テンプレートを適用」側で明示的に読み込んでください。
                                      </p>
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="template-editor">
                                        編集するテンプレート
                                      </Label>
                                      <Select
                                        value={templateEditorId}
                                        onValueChange={
                                          handleSelectTemplateInLibrary
                                        }
                                      >
                                        <SelectTrigger id="template-editor">
                                          <SelectValue placeholder="テンプレートを選択" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {workspace.templates.map(
                                            (template) => (
                                              <SelectItem
                                                key={template.id}
                                                value={template.id}
                                              >
                                                {template.name}
                                                {template.isDefaultTemplate
                                                  ? "（既定）"
                                                  : ""}
                                              </SelectItem>
                                            ),
                                          )}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="template-manage-name">
                                        テンプレート名
                                      </Label>
                                      <Input
                                        id="template-manage-name"
                                        value={templateNameInput}
                                        onChange={(e) =>
                                          setTemplateNameInput(e.target.value)
                                        }
                                        placeholder="テンプレート名"
                                      />
                                      <p className="text-xs text-muted-foreground">
                                        名前を変えてから「複製」すると別テンプレートとして保存できます。
                                      </p>
                                    </div>

                                    {updateTemplateConflict && (
                                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                        同名テンプレートがあります。別名案:
                                        <button
                                          type="button"
                                          className="ml-1 font-semibold underline"
                                          onClick={() =>
                                            setTemplateNameInput(
                                              suggestedTemplateName,
                                            )
                                          }
                                        >
                                          {suggestedTemplateName}
                                        </button>
                                      </div>
                                    )}

                                    <div className="grid gap-2 sm:grid-cols-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                          void handleUpdateTemplateFromDraft()
                                        }
                                        disabled={
                                          !canUpdateTemplate || isSettingsSaving
                                        }
                                      >
                                        現在の設定で更新
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                          void handleDuplicateTemplateFromDraft()
                                        }
                                        disabled={isSettingsSaving}
                                      >
                                        複製して新規作成
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                          void handleSetTemplateAsDefault()
                                        }
                                        disabled={
                                          !editableTemplate ||
                                          editableTemplate.isDefaultTemplate ||
                                          isSettingsSaving
                                        }
                                      >
                                        既定テンプレートにする
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                          void handleDeleteTemplate()
                                        }
                                        disabled={
                                          !editableTemplate ||
                                          editableTemplate.isDefaultTemplate ||
                                          isSettingsSaving
                                        }
                                      >
                                        削除
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>

                          <Card className="gap-0 border border-slate-200 bg-white shadow-none">
                            <CardHeader className="border-b border-slate-100 pb-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <CardTitle className="text-base">
                                    判定ルールエディタ
                                  </CardTitle>
                                  <CardDescription>
                                    {settingsTargetKind === "default"
                                      ? "この期間全体の基準設定です。未上書きの部門・ステージはこの設定を使います。"
                                      : currentSettingsAssignment.inheritsDefault
                                        ? `現在は${selectedScopedAssignmentLabel}が期間デフォルトを継承しています。必要な場合だけ上書きを開始します。`
                                        : `${selectedScopedAssignmentLabel}固有の上書き設定を編集中です。`}
                                  </CardDescription>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Badge variant="outline">
                                    {settingsTargetKind === "default"
                                      ? "デフォルト"
                                      : selectedScopedAssignmentLabel}
                                  </Badge>
                                  <Badge
                                    variant={
                                      currentSettingsAssignment.inheritsDefault
                                        ? "secondary"
                                        : "outline"
                                    }
                                  >
                                    {currentSettingsAssignment.inheritsDefault
                                      ? "継承中"
                                      : "カスタム上書き"}
                                  </Badge>
                                  {currentSettingsAssignment.sourceRulesetNameSnapshot && (
                                    <Badge variant="outline">
                                      読込元:{" "}
                                      {
                                        currentSettingsAssignment.sourceRulesetNameSnapshot
                                      }
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {settingsTargetKind !== "default" && (
                                <div className="flex flex-wrap gap-2 pt-4">
                                  {currentSettingsAssignment.inheritsDefault &&
                                  !isScopedOverrideDraftEnabled ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={handleEnableScopedOverride}
                                      disabled={isSettingsLocked}
                                    >
                                      この{selectedScopedAssignmentLabel}
                                      だけ上書きを開始
                                    </Button>
                                  ) : (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() =>
                                        void handleResetScopedInheritance()
                                      }
                                      disabled={
                                        isSettingsLocked || isSettingsSaving
                                      }
                                    >
                                      期間デフォルト継承に戻す
                                    </Button>
                                  )}
                                </div>
                              )}
                            </CardHeader>
                            <CardContent className="space-y-4 pt-6">
                              {settingsTargetKind !== "default" &&
                                !isSettingsLocked &&
                                isSettingsEditorDisabled && (
                                  <Alert>
                                    <AlertTitle>
                                      現在は継承モードです
                                    </AlertTitle>
                                    <AlertDescription>
                                      この{selectedScopedAssignmentLabel}
                                      にだけ別設定を持たせるときは、上書きを開始してから編集します。
                                    </AlertDescription>
                                  </Alert>
                                )}

                              {isSettingsLocked && (
                                <Alert>
                                  <AlertTitle>
                                    この期間はロックされています
                                  </AlertTitle>
                                  <AlertDescription>
                                    期間デフォルトと部門・ステージ別の割当設定は変更できません。テンプレート管理だけ継続できます。
                                  </AlertDescription>
                                </Alert>
                              )}

                              <div
                                className={cn(
                                  "space-y-8 px-6 pb-6",
                                  isSettingsEditorDisabled &&
                                    "pointer-events-none opacity-60",
                                )}
                              >
                                <section className="space-y-4">
                                  <h3 className="text-sm font-semibold">
                                    昇格フラグ（AND/OR対応）
                                  </h3>
                                  <p className="text-sm text-muted-foreground">
                                    ORグループのいずれかを満たせば「昇格フラグ」として扱います（グループ内はAND）。
                                  </p>

                                  <div className="space-y-4">
                                    {draftSettings.promotion.ruleGroups.map(
                                      (group, groupIndex) => (
                                        <div
                                          key={group.id}
                                          className="rounded-lg border p-4"
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <div className="text-sm font-medium">
                                              ORグループ {groupIndex + 1}
                                            </div>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              className="flex items-center gap-2"
                                              onClick={() =>
                                                removePromotionGroup(group.id)
                                              }
                                              disabled={
                                                draftSettings.promotion
                                                  .ruleGroups.length <= 1
                                              }
                                            >
                                              <Trash2 className="h-4 w-4" />
                                              削除
                                            </Button>
                                          </div>

                                          <div className="mt-4 space-y-3">
                                            {group.conditions.map(
                                              (condition, index) => {
                                                const selectedTarget =
                                                  condition.field;

                                                return (
                                                  <div
                                                    key={`${group.id}-${index}`}
                                                    className="grid gap-2 md:grid-cols-12"
                                                  >
                                                    <div className="md:col-span-7">
                                                      <Label className="sr-only">
                                                        条件
                                                      </Label>
                                                      <Select
                                                        value={selectedTarget}
                                                        onValueChange={(
                                                          value,
                                                        ) =>
                                                          updatePromotionConditionTarget(
                                                            group.id,
                                                            index,
                                                            value as PromotionConditionTarget,
                                                          )
                                                        }
                                                      >
                                                        <SelectTrigger>
                                                          <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                          {PROMOTION_CONDITION_TARGETS.map(
                                                            (item) => (
                                                              <SelectItem
                                                                key={item.value}
                                                                value={
                                                                  item.value
                                                                }
                                                              >
                                                                {item.label}
                                                              </SelectItem>
                                                            ),
                                                          )}
                                                        </SelectContent>
                                                      </Select>
                                                    </div>

                                                    <div className="md:col-span-3">
                                                      <Label className="sr-only">
                                                        最低ランク
                                                      </Label>
                                                      <Select
                                                        value={
                                                          condition.minimumRank
                                                        }
                                                        onValueChange={(
                                                          value,
                                                        ) =>
                                                          updatePromotionConditionMinimumRank(
                                                            group.id,
                                                            index,
                                                            value as EvaluationRank,
                                                          )
                                                        }
                                                      >
                                                        <SelectTrigger>
                                                          <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                          {EVALUATION_RANKS.map(
                                                            (rank) => (
                                                              <SelectItem
                                                                key={rank}
                                                                value={rank}
                                                              >
                                                                {rank}以上
                                                              </SelectItem>
                                                            ),
                                                          )}
                                                        </SelectContent>
                                                      </Select>
                                                    </div>

                                                    <div className="flex items-end md:col-span-2">
                                                      <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full"
                                                        onClick={() =>
                                                          removePromotionCondition(
                                                            group.id,
                                                            index,
                                                          )
                                                        }
                                                        disabled={
                                                          group.conditions
                                                            .length <= 1
                                                        }
                                                      >
                                                        削除
                                                      </Button>
                                                    </div>
                                                  </div>
                                                );
                                              },
                                            )}
                                          </div>

                                          <div className="mt-4 flex items-center gap-2">
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              className="flex items-center gap-2"
                                              onClick={() =>
                                                addPromotionCondition(group.id)
                                              }
                                            >
                                              <Plus className="h-4 w-4" />
                                              条件を追加（AND）
                                            </Button>
                                          </div>
                                        </div>
                                      ),
                                    )}

                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="flex items-center gap-2"
                                      onClick={addPromotionGroup}
                                    >
                                      <Plus className="h-4 w-4" />
                                      ORグループを追加
                                    </Button>
                                  </div>
                                </section>

                                <section className="space-y-4">
                                  <h3 className="text-sm font-semibold">
                                    降格フラグ（AND/OR対応）
                                  </h3>
                                  <p className="text-sm text-muted-foreground">
                                    ORグループのいずれかを満たせば「降格フラグ」として扱います（グループ内はAND）。
                                  </p>

                                  <div className="space-y-4">
                                    {draftSettings.demotion.ruleGroups.map(
                                      (group, groupIndex) => (
                                        <div
                                          key={group.id}
                                          className="rounded-lg border p-4"
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <div className="text-sm font-medium">
                                              ORグループ {groupIndex + 1}
                                            </div>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              className="flex items-center gap-2"
                                              onClick={() =>
                                                removeDemotionGroup(group.id)
                                              }
                                              disabled={
                                                draftSettings.demotion
                                                  .ruleGroups.length <= 1
                                              }
                                            >
                                              <Trash2 className="h-4 w-4" />
                                              削除
                                            </Button>
                                          </div>

                                          <div className="mt-4 space-y-3">
                                            {group.conditions.map(
                                              (condition, index) => {
                                                const selectedTarget =
                                                  condition.field;

                                                return (
                                                  <div
                                                    key={`${group.id}-${index}`}
                                                    className="grid gap-2 md:grid-cols-12"
                                                  >
                                                    <div className="md:col-span-7">
                                                      <Label className="sr-only">
                                                        条件
                                                      </Label>
                                                      <Select
                                                        value={selectedTarget}
                                                        onValueChange={(
                                                          value,
                                                        ) =>
                                                          updateDemotionConditionTarget(
                                                            group.id,
                                                            index,
                                                            value as DemotionConditionTarget,
                                                          )
                                                        }
                                                      >
                                                        <SelectTrigger>
                                                          <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                          {DEMOTION_CONDITION_TARGETS.map(
                                                            (item) => (
                                                              <SelectItem
                                                                key={item.value}
                                                                value={
                                                                  item.value
                                                                }
                                                              >
                                                                {item.label}
                                                              </SelectItem>
                                                            ),
                                                          )}
                                                        </SelectContent>
                                                      </Select>
                                                    </div>

                                                    <div className="md:col-span-3">
                                                      <Label className="sr-only">
                                                        しきい値ランク
                                                      </Label>
                                                      <Select
                                                        value={
                                                          condition.thresholdRank
                                                        }
                                                        onValueChange={(
                                                          value,
                                                        ) =>
                                                          updateDemotionConditionThresholdRank(
                                                            group.id,
                                                            index,
                                                            value as EvaluationRank,
                                                          )
                                                        }
                                                      >
                                                        <SelectTrigger>
                                                          <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                          {EVALUATION_RANKS.map(
                                                            (rank) => (
                                                              <SelectItem
                                                                key={rank}
                                                                value={rank}
                                                              >
                                                                {rank}以下
                                                              </SelectItem>
                                                            ),
                                                          )}
                                                        </SelectContent>
                                                      </Select>
                                                    </div>

                                                    <div className="flex items-end md:col-span-2">
                                                      <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full"
                                                        onClick={() =>
                                                          removeDemotionCondition(
                                                            group.id,
                                                            index,
                                                          )
                                                        }
                                                        disabled={
                                                          group.conditions
                                                            .length <= 1
                                                        }
                                                      >
                                                        削除
                                                      </Button>
                                                    </div>
                                                  </div>
                                                );
                                              },
                                            )}
                                          </div>

                                          <div className="mt-4 flex items-center gap-2">
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              className="flex items-center gap-2"
                                              onClick={() =>
                                                addDemotionCondition(group.id)
                                              }
                                            >
                                              <Plus className="h-4 w-4" />
                                              条件を追加（AND）
                                            </Button>
                                          </div>
                                        </div>
                                      ),
                                    )}

                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="flex items-center gap-2"
                                      onClick={addDemotionGroup}
                                    >
                                      <Plus className="h-4 w-4" />
                                      ORグループを追加
                                    </Button>
                                  </div>
                                </section>

                                <section className="space-y-4">
                                  <h3 className="text-sm font-semibold">
                                    レベル増減（総合評価別）
                                  </h3>
                                  <p className="text-sm text-muted-foreground">
                                    総合評価（SS〜D）に応じてレベル増減を適用します。
                                  </p>

                                  <div className="grid gap-4 md:grid-cols-4">
                                    {EVALUATION_RANKS.map((rank) => (
                                      <div key={rank} className="space-y-2">
                                        <Label>{rank}</Label>
                                        <Input
                                          type="number"
                                          value={levelDeltaInputs[rank]}
                                          onChange={(e) =>
                                            setLevelDeltaInputs((prev) => ({
                                              ...prev,
                                              [rank]: e.target.value,
                                            }))
                                          }
                                          onBlur={() =>
                                            commitNumericInput(
                                              levelDeltaInputs[rank],
                                              draftSettings
                                                .levelDeltaByOverallRank[rank],
                                              (value) =>
                                                setLevelDeltaInputs((prev) => ({
                                                  ...prev,
                                                  [rank]: value,
                                                })),
                                              (next) =>
                                                setDraftSettings((prev) => ({
                                                  ...prev,
                                                  levelDeltaByOverallRank: {
                                                    ...prev.levelDeltaByOverallRank,
                                                    [rank]: next,
                                                  },
                                                })),
                                            )
                                          }
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </section>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                  <div className="space-y-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetDraftSettingsToDefault}
                      disabled={isSettingsEditorDisabled}
                    >
                      現在の編集内容を初期値に戻す
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      {isSettingsLocked
                        ? "この期間はロック中です。テンプレート管理のみ利用できます。"
                        : hasUnsavedSettingsChanges
                          ? "未保存の変更があります。内容を確認して保存してください。"
                          : "現在の変更は保存済みです。"}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSettingsDialogOpen(false)}
                    >
                      キャンセル
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleSaveSettings()}
                      disabled={
                        !hasUnsavedSettingsChanges ||
                        isSettingsLoading ||
                        isSettingsSaving ||
                        isSettingsEditorDisabled
                      }
                    >
                      保存
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4">
        <Select
          value={evaluationPeriodId}
          onValueChange={setEvaluationPeriodId}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="評価期間" />
          </SelectTrigger>
          <SelectContent>
            {evaluationPeriods.map((period) => (
              <SelectItem key={period.id} value={period.id}>
                {period.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedEvaluationPeriod && (
          <Badge variant={isSelectedPeriodCompleted ? "secondary" : "outline"}>
            {isSelectedPeriodCompleted ? "入力終了" : "入力受付中"}
          </Badge>
        )}

        <Select
          value={selectedDepartment}
          onValueChange={setSelectedDepartment}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="部署" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべての部署</SelectItem>
            {filterDepartments.map((department) => (
              <SelectItem key={department} value={department}>
                {department}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedStage} onValueChange={setSelectedStage}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="ステージ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべてのステージ</SelectItem>
            {stages.map((stage) => (
              <SelectItem key={stage} value={stage}>
                {stage}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedEmploymentType}
          onValueChange={(value) =>
            setSelectedEmploymentType(value as EmploymentType | "all")
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="雇用形態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべての雇用形態</SelectItem>
            <SelectItem value="employee">正社員</SelectItem>
            <SelectItem value="parttime">パート</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={selectedProcessingStatus}
          onValueChange={(value) =>
            setSelectedProcessingStatus(value as ProcessingStatus | "all")
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="処理状態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="unprocessed">未処理</SelectItem>
            <SelectItem value="processed">処理済</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            placeholder="社員番号・氏名・部署・ステージで検索..."
            className="pl-10 pr-10"
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchQuery("")}
              aria-label="検索クリア"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
          onClick={handleClearFilters}
          disabled={
            evaluationPeriodId === defaultPeriodId &&
            selectedDepartment === "all" &&
            selectedStage === "all" &&
            selectedEmploymentType === "all" &&
            selectedProcessingStatus === "all" &&
            !searchQuery
          }
        >
          <X className="h-4 w-4" />
          クリア
        </Button>
      </div>

      {processSuccess && (
        <Alert>
          <AlertDescription>{processSuccess}</AlertDescription>
        </Alert>
      )}

      {processError && (
        <Alert variant="destructive">
          <AlertDescription>{processError}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border">
        <div className="relative overflow-x-auto">
          <Table className="min-w-[1400px]">
            <TableHeader>
              <TableRow className="bg-muted/40 [&>th]:text-center">
                <TableHead
                  colSpan={personalInfoColumns}
                  className="font-semibold border-r"
                >
                  個人基本情報
                </TableHead>
                <TableHead
                  colSpan={performanceColumns}
                  className="font-semibold border-r"
                >
                  目標達成（定量+定性）
                </TableHead>
                <TableHead
                  colSpan={competencyColumns}
                  className="font-semibold border-r"
                >
                  コンピテンシー
                </TableHead>
                <TableHead
                  colSpan={coreValueColumns}
                  className="font-semibold border-r"
                >
                  コアバリュー
                </TableHead>
                <TableHead colSpan={overallColumns} className="font-semibold">
                  総合結果
                </TableHead>
              </TableRow>
              <TableRow className="bg-muted/40">
                <TableHead className="whitespace-nowrap">社員番号</TableHead>
                <TableHead className="whitespace-nowrap">氏名</TableHead>
                <TableHead className="whitespace-nowrap">部署</TableHead>
                <TableHead className="whitespace-nowrap">雇用形態</TableHead>
                <TableHead className="whitespace-nowrap border-r">
                  現在ステージ
                </TableHead>

                <TableHead className="whitespace-nowrap">最終評価</TableHead>
                <TableHead className="whitespace-nowrap border-r">
                  ウェイト（%）
                </TableHead>

                <TableHead className="whitespace-nowrap">最終評価</TableHead>
                <TableHead className="whitespace-nowrap border-r">
                  ウェイト（%）
                </TableHead>

                <TableHead className="whitespace-nowrap border-r">
                  最終評価
                </TableHead>

                <TableHead className="whitespace-nowrap">合計（点）</TableHead>
                <TableHead className="whitespace-nowrap">総合評価</TableHead>
                <TableHead className="whitespace-nowrap">
                  昇格/降格フラグ
                </TableHead>
                <TableHead className="whitespace-nowrap">処理状態</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isRowsLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={totalColumns}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    読み込み中...
                  </TableCell>
                </TableRow>
              ) : rowsError ? (
                <TableRow>
                  <TableCell
                    colSpan={totalColumns}
                    className="h-24 text-center text-sm text-destructive"
                  >
                    {rowsError}
                  </TableCell>
                </TableRow>
              ) : filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={totalColumns}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    表示できるデータがありません
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row) => {
                  const computed = row.applied;
                  const manualDecision = row.manualDecision;

                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.employeeCode}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.departmentName ?? "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge
                          variant={getEmploymentTypeBadgeVariant(
                            row.employmentType,
                          )}
                        >
                          {getEmploymentTypeLabel(row.employmentType)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center border-r">
                        {row.currentStage ?? "-"}
                      </TableCell>

                      <TableCell className="text-center">
                        {row.performanceFinalRank ?? "-"}
                      </TableCell>
                      <TableCell className="text-center border-r">
                        {row.performanceWeightPercent ?? "-"}
                      </TableCell>

                      <TableCell className="text-center">
                        {row.competencyFinalRank ?? "-"}
                      </TableCell>
                      <TableCell className="text-center border-r">
                        {row.competencyWeightPercent ?? "-"}
                      </TableCell>

                      <TableCell className="text-center border-r">
                        {row.coreValueFinalRank ?? "-"}
                      </TableCell>

                      <TableCell className="text-right">
                        {computed.totalScore !== null
                          ? formatNumber(computed.totalScore)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {computed.overallRank ?? "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span>{getComprehensiveEvaluationFlagLabel(row)}</span>
                          {manualDecision && (
                            <Badge variant="secondary">手動</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Badge
                            variant={
                              row.processingStatus === "processed"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {getComprehensiveEvaluationProcessingStatusLabel(
                              row.processingStatus,
                            )}
                          </Badge>
                          {isEvalAdmin && canProcessSelectedPeriod && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void handleProcessUser(row)}
                              disabled={
                                row.processingStatus === "processed" ||
                                isProcessingUserId === row.userId
                              }
                            >
                              {isProcessingUserId === row.userId
                                ? "処理中..."
                                : "処理する"}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
