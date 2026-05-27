import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

import { useCoreValueAutoSave, createAutoSaveFlusherSet } from "./useCoreValueAutoSave";

/**
 * These tests cover the race-condition fix in save() for the shared
 * useCoreValueAutoSave hook. Same class of bug as useSelfAssessmentAutoSave:
 * a save() call landing inside the tiny window between the running loop's
 * last while-check (null) and its actual exit used to be dropped by the
 * early-return in the in-flight branch. The fix turns the early-return into
 * a fall-through that re-checks pendingSaveRef and starts a fresh loop if
 * needed.
 *
 * This hook is used by useCoreValueEvaluationAutoSave (employee evaluation-input
 * core-value axis), useCoreValueFeedbackAutoSave (supervisor), and
 * usePeerReviewAutoSave — so this fix protects all of them.
 */
describe("useCoreValueAutoSave — save() race condition", () => {
  function buildOptions(saveAction: ReturnType<typeof vi.fn>) {
    return {
      entityId: "test-entity",
      initialStatus: "draft",
      saveAction,
      isEditableCheck: (status: string | undefined) => status === "draft",
      flusherSet: createAutoSaveFlusherSet().flushers,
    };
  }

  beforeEach(() => {
    // no shared state to reset
  });

  it("processes a second save called while the first is in-flight", async () => {
    let resolveFirst!: () => void;
    const firstPromise = new Promise<{ success: true }>((resolve) => {
      resolveFirst = () => resolve({ success: true });
    });

    const saveAction = vi
      .fn()
      .mockImplementationOnce(() => firstPromise)
      .mockImplementationOnce(() => Promise.resolve({ success: true }));

    const { result } = renderHook(() => useCoreValueAutoSave(buildOptions(saveAction)));

    let save1Promise!: Promise<void>;
    act(() => {
      save1Promise = result.current.save({ scores: { a: "A" }, comment: "first" });
    });

    await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1));

    let save2Promise!: Promise<void>;
    act(() => {
      save2Promise = result.current.save({ scores: { a: "S" }, comment: "second" });
    });

    await act(async () => {
      resolveFirst();
      await save1Promise;
      await save2Promise;
    });

    expect(saveAction).toHaveBeenCalledTimes(2);
    expect(saveAction).toHaveBeenNthCalledWith(
      1,
      "test-entity",
      expect.objectContaining({ scores: { a: "A" }, comment: "first" }),
    );
    expect(saveAction).toHaveBeenNthCalledWith(
      2,
      "test-entity",
      expect.objectContaining({ scores: { a: "S" }, comment: "second" }),
    );
  });

  it("processes rapid sequential saves — LWW semantics preserved", async () => {
    let resolveFirst!: () => void;
    const firstPromise = new Promise<{ success: true }>((resolve) => {
      resolveFirst = () => resolve({ success: true });
    });

    const saveAction = vi
      .fn()
      .mockImplementationOnce(() => firstPromise)
      .mockImplementation(() => Promise.resolve({ success: true }));

    const { result } = renderHook(() => useCoreValueAutoSave(buildOptions(saveAction)));

    let p1!: Promise<void>;
    let p2!: Promise<void>;
    let p3!: Promise<void>;
    act(() => {
      p1 = result.current.save({ scores: { a: "A" }, comment: "v1" });
    });
    await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1));
    act(() => {
      p2 = result.current.save({ scores: { a: "B" }, comment: "v2" });
      p3 = result.current.save({ scores: { a: "C" }, comment: "v3" });
    });

    await act(async () => {
      resolveFirst();
      await Promise.all([p1, p2, p3]);
    });

    const calls = saveAction.mock.calls;
    expect(calls[0][1]).toMatchObject({ scores: { a: "A" } });
    expect(calls[calls.length - 1][1]).toMatchObject({ scores: { a: "C" } });
  });

  it("happy path — single save fires exactly one API call", async () => {
    const saveAction = vi.fn().mockResolvedValue({ success: true });

    const { result } = renderHook(() => useCoreValueAutoSave(buildOptions(saveAction)));

    await act(async () => {
      await result.current.save({ scores: { a: "A" }, comment: "hello" });
    });

    expect(saveAction).toHaveBeenCalledTimes(1);
    expect(saveAction).toHaveBeenCalledWith(
      "test-entity",
      expect.objectContaining({ scores: { a: "A" }, comment: "hello" }),
    );
  });

  it("no-op when entityId missing", async () => {
    const saveAction = vi.fn().mockResolvedValue({ success: true });

    const { result } = renderHook(() =>
      useCoreValueAutoSave({ ...buildOptions(saveAction), entityId: undefined }),
    );

    await act(async () => {
      await result.current.save({ scores: { a: "A" }, comment: "" });
    });

    expect(saveAction).not.toHaveBeenCalled();
  });

  it("no-op when not editable (status != draft)", async () => {
    const saveAction = vi.fn().mockResolvedValue({ success: true });

    const { result } = renderHook(() =>
      useCoreValueAutoSave({ ...buildOptions(saveAction), initialStatus: "submitted" }),
    );

    await act(async () => {
      await result.current.save({ scores: { a: "A" }, comment: "" });
    });

    expect(saveAction).not.toHaveBeenCalled();
  });
});
