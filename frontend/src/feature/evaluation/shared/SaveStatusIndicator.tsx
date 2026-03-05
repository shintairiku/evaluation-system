"use client";

import { Loader2 } from "lucide-react";
import type { SaveStatus } from "./types";

/**
 * Save status indicator component.
 * Shows the current save state for auto-save functionality.
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
