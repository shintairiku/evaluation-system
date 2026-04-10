"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SaveStatusIndicator } from "../SaveStatusIndicator";
import type { SaveStatus } from "../types";

interface CoreValueCommentSectionProps {
  comment: string;
  onCommentChange: (value: string) => void;
  onCommentBlur: () => void;
  isEditable: boolean;
  saveStatus: SaveStatus;
  label: string;
  placeholder: string;
  hintText: string;
  saveStatusTheme?: "blue" | "green";
  focusRingColor?: string;
  maxLength?: number;
  showRequired?: boolean;
}

/**
 * Shared comment section for core value evaluation and feedback.
 */
export function CoreValueCommentSection({
  comment,
  onCommentChange,
  onCommentBlur,
  isEditable,
  saveStatus,
  label,
  placeholder,
  hintText,
  saveStatusTheme = "blue",
  focusRingColor = "focus:ring-purple-200",
  maxLength = 5000,
  showRequired = false,
}: CoreValueCommentSectionProps) {
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-2">
        <Label className="text-sm font-semibold text-gray-700">
          {label}
          {showRequired && !comment.trim() && <span className="text-red-500"> *</span>}
        </Label>
        <SaveStatusIndicator status={saveStatus} theme={saveStatusTheme} />
      </div>
      <Textarea
        value={comment}
        onChange={(e) => onCommentChange(e.target.value)}
        onBlur={onCommentBlur}
        placeholder={placeholder}
        className={`mt-1 text-sm rounded-md border-gray-300 focus:ring-2 ${focusRingColor} h-[200px]`}
        maxLength={maxLength}
        disabled={!isEditable}
      />
      <div className="flex justify-between items-center mt-1">
        <p className="text-xs text-gray-400">{hintText}</p>
        <p className="text-xs text-gray-400">
          {comment.length} / {maxLength}
        </p>
      </div>
    </div>
  );
}
