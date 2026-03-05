"use client";

import { Badge } from "@/components/ui/badge";
import type { CoreValueDefinition, CoreValueRatingCode } from "@/api/types";
import { CORE_VALUE_RATING_CODES } from "@/api/types/core-value";

export interface CoreValueCardTheme {
  cardBg: string;
  cardBorder: string;
  titleColor: string;
}

export const CORE_VALUE_THEMES = {
  employee: {
    cardBg: "bg-slate-50",
    cardBorder: "border-slate-200",
    titleColor: "text-purple-800",
  },
  supervisor: {
    cardBg: "bg-green-50",
    cardBorder: "border-green-200",
    titleColor: "text-green-800",
  },
} as const;

interface CoreValueCardProps {
  definition: CoreValueDefinition;
  selectedRating: string | undefined;
  theme: CoreValueCardTheme;
  onRatingChange?: (definitionId: string, rating: CoreValueRatingCode) => void;
  isEditable?: boolean;
  showRequired?: boolean;
  showUnratedBadge?: boolean;
}

/**
 * Shared core value card component.
 * Supports editable (employee/supervisor) and read-only modes.
 */
export function CoreValueCard({
  definition,
  selectedRating,
  theme,
  onRatingChange,
  isEditable = false,
  showRequired = false,
  showUnratedBadge = false,
}: CoreValueCardProps) {
  const isReadOnly = !onRatingChange;

  return (
    <div
      className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl shadow-sm px-6 py-5 space-y-4${!isReadOnly ? " transition hover:shadow-md" : ""}`}
    >
      {/* Definition Header */}
      <div>
        <div className={`text-lg font-bold ${theme.titleColor}`}>
          {definition.name}
        </div>
        {definition.description && (
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            {definition.description}
          </p>
        )}
      </div>

      {/* Rating Section */}
      <div>
        {showRequired && !selectedRating && (
          <span className="text-red-500 text-sm mb-2 block">*</span>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          {CORE_VALUE_RATING_CODES.map((rating) => {
            const isSelected = selectedRating === rating;
            return (
              <div
                key={rating}
                className={`flex items-center gap-2 ${
                  isReadOnly || !isEditable
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer"
                }`}
                onClick={() =>
                  !isReadOnly && isEditable && onRatingChange(definition.id, rating)
                }
              >
                <div className="w-6 h-6 rounded-full border-2 border-gray-400 flex items-center justify-center transition-all">
                  {isSelected && (
                    <div className="w-3 h-3 rounded-full bg-gray-800"></div>
                  )}
                </div>
                <span className="text-sm text-gray-700">{rating}</span>
              </div>
            );
          })}
        </div>

        {showUnratedBadge && !selectedRating && (
          <Badge variant="outline" className="mt-2 text-xs text-gray-400">
            未評価
          </Badge>
        )}
      </div>
    </div>
  );
}
