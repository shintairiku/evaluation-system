import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";

import { resolveSupervisorSubmitFields, isCoreValueFeedbackComplete } from "./SupervisorSubmitButton";
import {
  useSupervisorFeedbackAutoSave,
  getSupervisorFeedbackSnapshot,
} from "../hooks/useSupervisorFeedbackAutoSave";

/**
 * These tests lock in the WYSIWYS fix for the supervisor-submit-stale-rating bug:
 * the submit must send EXACTLY what the user currently sees (live snapshot),
 * not the server-derived prop that can be stale while the 2s debounced
 * auto-save is still pending.
 */
describe("resolveSupervisorSubmitFields (performance goal)", () => {
  it("uses the live snapshot when present, ignoring the stale prop (THE BUG)", () => {
    // Repro: prop still 'A' (server not yet updated), user just selected 'S'
    const result = resolveSupervisorSubmitFields(
      { supervisorRatingCode: "S", supervisorComment: "ok" },
      { supervisorRatingCode: "A", supervisorComment: "old" },
      false,
    );
    expect(result.supervisorRatingCode).toBe("S");
    expect(result.supervisorComment).toBe("ok");
    expect(result.ratingData).toBeUndefined();
  });

  it("maps an intentional deselect (snapshot null) to undefined, NOT the prop", () => {
    const result = resolveSupervisorSubmitFields(
      { supervisorRatingCode: null, supervisorComment: "" },
      { supervisorRatingCode: "A", supervisorComment: "old" },
      false,
    );
    // null -> undefined (submit API has no explicit clear); must NOT fall back to 'A'
    expect(result.supervisorRatingCode).toBeUndefined();
  });

  it("falls back to the prop when no card/snapshot is mounted", () => {
    const result = resolveSupervisorSubmitFields(
      undefined,
      { supervisorRatingCode: "A", supervisorComment: "from server" },
      false,
    );
    expect(result.supervisorRatingCode).toBe("A");
    expect(result.supervisorComment).toBe("from server");
  });

  it("normalizes undefined snapshot rating to undefined", () => {
    const result = resolveSupervisorSubmitFields(
      { supervisorRatingCode: undefined, supervisorComment: "c" },
      { supervisorRatingCode: "A", supervisorComment: "old" },
      false,
    );
    expect(result.supervisorRatingCode).toBeUndefined();
    expect(result.supervisorComment).toBe("c");
  });
});

describe("resolveSupervisorSubmitFields (competency)", () => {
  it("uses snapshot ratingData + comment, never a single rating code", () => {
    const ratingData = { "comp-1": { "0": "S" as const } };
    const result = resolveSupervisorSubmitFields(
      { supervisorComment: "great", ratingData },
      { supervisorComment: "old" },
      true,
    );
    expect(result.supervisorRatingCode).toBeUndefined();
    expect(result.supervisorComment).toBe("great");
    expect(result.ratingData).toEqual(ratingData);
  });

  it("falls back to prop comment and undefined ratingData when no snapshot", () => {
    const result = resolveSupervisorSubmitFields(
      undefined,
      { supervisorComment: "server comment" },
      true,
    );
    expect(result.supervisorRatingCode).toBeUndefined();
    expect(result.supervisorComment).toBe("server comment");
    expect(result.ratingData).toBeUndefined();
  });
});

/**
 * Core value completeness gate. The bug: a fully-filled core value evaluation was
 * falsely reported as 未入力 at submit because the gate read the parent's stale
 * server-derived prop instead of the live on-screen values. The submit now feeds this
 * helper the WYSIWYS snapshot (falling back to the prop only when no card is mounted).
 */
describe("isCoreValueFeedbackComplete (core value gate)", () => {
  const scores = (n: number): Record<string, string> =>
    Object.fromEntries(Array.from({ length: n }, (_, i) => [`d${i}`, "A"]));

  it("true when every definition is scored AND a comment is present", () => {
    expect(isCoreValueFeedbackComplete(scores(9), "ok", 9)).toBe(true);
  });

  it("false when a score is missing", () => {
    expect(isCoreValueFeedbackComplete(scores(8), "ok", 9)).toBe(false);
  });

  it("false when comment is empty / whitespace / null", () => {
    expect(isCoreValueFeedbackComplete(scores(9), "", 9)).toBe(false);
    expect(isCoreValueFeedbackComplete(scores(9), "   ", 9)).toBe(false);
    expect(isCoreValueFeedbackComplete(scores(9), null, 9)).toBe(false);
  });

  it("true when there are no definitions to fill", () => {
    expect(isCoreValueFeedbackComplete({}, "", 0)).toBe(true);
  });

  it("THE BUG: live snapshot is complete while the stale prop is empty", () => {
    // What the user sees (live snapshot) — all filled
    expect(isCoreValueFeedbackComplete(scores(9), "あ", 9)).toBe(true);
    // The stale server-derived prop from initial load — would falsely block the submit
    expect(isCoreValueFeedbackComplete({}, "", 9)).toBe(false);
  });
});

describe("supervisor feedback snapshot registry", () => {
  it("registers a stable getter and reads the CURRENT ref value", () => {
    const live = { supervisorRatingCode: "A" as const, supervisorComment: "" };
    const getSnapshot = () => live;

    renderHook(() =>
      useSupervisorFeedbackAutoSave({
        feedbackId: "fb-1",
        initialRatingCode: "A",
        initialStatus: "draft",
        getSnapshot,
      }),
    );

    expect(getSupervisorFeedbackSnapshot("fb-1")).toEqual({
      supervisorRatingCode: "A",
      supervisorComment: "",
    });

    // Mutating the ref-backed source is reflected immediately (no re-render needed)
    live.supervisorRatingCode = "S";
    expect(getSupervisorFeedbackSnapshot("fb-1")?.supervisorRatingCode).toBe("S");
  });

  it("cleans up the getter on unmount (falls back to prop afterwards)", () => {
    const getSnapshot = () => ({
      supervisorRatingCode: "S" as const,
      supervisorComment: "",
    });

    const { unmount } = renderHook(() =>
      useSupervisorFeedbackAutoSave({
        feedbackId: "fb-2",
        initialRatingCode: "A",
        initialStatus: "draft",
        getSnapshot,
      }),
    );

    expect(getSupervisorFeedbackSnapshot("fb-2")).toBeDefined();
    unmount();
    expect(getSupervisorFeedbackSnapshot("fb-2")).toBeUndefined();
  });
});
