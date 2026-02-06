"use client";

import { useEffect, useState } from "react";

import type { ComprehensiveEvaluationUserFlags } from "../settings";

const STORAGE_KEY = "comprehensive-evaluation:user-flags:v1";

type StoredFlags = Record<string, ComprehensiveEvaluationUserFlags | undefined>;

function parseStoredFlags(value: string | null): StoredFlags {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as StoredFlags;
  } catch {
    return {};
  }
}

function getInitialFlags(): StoredFlags {
  if (typeof window === "undefined") return {};
  return parseStoredFlags(window.localStorage.getItem(STORAGE_KEY));
}

export function useComprehensiveEvaluationUserFlags() {
  const [flagsByUserId, setFlagsByUserId] = useState<StoredFlags>(() => getInitialFlags());

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(flagsByUserId));
  }, [flagsByUserId]);

  const updateUserFlags = (userId: string, partial: ComprehensiveEvaluationUserFlags) => {
    setFlagsByUserId((prev) => {
      const current = prev[userId] ?? {};
      return { ...prev, [userId]: { ...current, ...partial } };
    });
  };

  return { flagsByUserId, updateUserFlags };
}
