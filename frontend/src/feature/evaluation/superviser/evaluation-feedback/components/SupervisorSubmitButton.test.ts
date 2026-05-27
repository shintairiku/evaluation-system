import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";

import { resolveSupervisorSubmitFields } from "./SupervisorSubmitButton";
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
