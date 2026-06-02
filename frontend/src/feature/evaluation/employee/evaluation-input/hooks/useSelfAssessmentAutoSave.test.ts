import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

import { updateSelfAssessmentAction } from "@/api/server-actions/self-assessments";
import { SelfAssessmentStatus } from "@/api/types";
import { useSelfAssessmentAutoSave } from "./useSelfAssessmentAutoSave";

vi.mock("@/api/server-actions/self-assessments", () => ({
  updateSelfAssessmentAction: vi.fn(),
}));

const mockUpdate = updateSelfAssessmentAction as unknown as ReturnType<typeof vi.fn>;

/**
 * These tests document the race-condition fix in save():
 * before the fix, the early-return after `await inFlightSaveRef.current`
 * could drop a save when called inside the tiny window between the running
 * loop's last while-check (returning null) and the loop's actual exit.
 * The fix replaces the early-return with a fall-through that re-starts the
 * loop if pendingSaveRef still has data.
 */
describe("useSelfAssessmentAutoSave — save() race condition", () => {
  beforeEach(() => {
    mockUpdate.mockReset();
  });

  it("processes a second save called while the first is in-flight", async () => {
    // Hold the first save's API call so we can interleave a second call.
    let resolveFirst!: () => void;
    const firstPromise = new Promise<{ success: true }>((resolve) => {
      resolveFirst = () => resolve({ success: true });
    });

    mockUpdate
      .mockImplementationOnce(() => firstPromise)
      .mockImplementationOnce(() => Promise.resolve({ success: true }));

    const { result } = renderHook(() =>
      useSelfAssessmentAutoSave({
        assessmentId: "test-assessment",
        initialStatus: SelfAssessmentStatus.DRAFT,
        isPeriodEditable: true,
      }),
    );

    // First save — starts the loop, in-flight on firstPromise
    let save1Promise: Promise<void>;
    act(() => {
      save1Promise = result.current.save({ selfRatingCode: "A", selfComment: "" });
    });

    // Wait for the loop to have actually started its API call
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));

    // Second save while the first is still in-flight — repro of the race scenario
    let save2Promise: Promise<void>;
    act(() => {
      save2Promise = result.current.save({ selfRatingCode: "S", selfComment: "" });
    });

    // Now resolve the first call so the loop can iterate
    await act(async () => {
      resolveFirst();
      await save1Promise;
      await save2Promise;
    });

    // Both data1 and data2 must have been sent to the backend.
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenNthCalledWith(
      1,
      "test-assessment",
      expect.objectContaining({ selfRatingCode: "A" }),
    );
    expect(mockUpdate).toHaveBeenNthCalledWith(
      2,
      "test-assessment",
      expect.objectContaining({ selfRatingCode: "S" }),
    );
  });

  it("processes three rapid saves in order — LWW semantics, no drops", async () => {
    let resolveFirst!: () => void;
    const firstPromise = new Promise<{ success: true }>((resolve) => {
      resolveFirst = () => resolve({ success: true });
    });

    mockUpdate
      .mockImplementationOnce(() => firstPromise)
      .mockImplementation(() => Promise.resolve({ success: true }));

    const { result } = renderHook(() =>
      useSelfAssessmentAutoSave({
        assessmentId: "test-assessment",
        initialStatus: SelfAssessmentStatus.DRAFT,
        isPeriodEditable: true,
      }),
    );

    let p1!: Promise<void>;
    let p2!: Promise<void>;
    let p3!: Promise<void>;
    act(() => {
      p1 = result.current.save({ selfRatingCode: "A", selfComment: "first" });
    });
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    act(() => {
      p2 = result.current.save({ selfRatingCode: "S", selfComment: "second" });
      p3 = result.current.save({ selfRatingCode: "SS", selfComment: "third" });
    });

    await act(async () => {
      resolveFirst();
      await Promise.all([p1, p2, p3]);
    });

    // The first call sent data1; the loop then sees pendingSaveRef = data3
    // (data2 was overwritten by data3 before the loop iterated). LWW.
    // We expect at minimum: first call ran with "A", and a later call ran
    // with the final value "SS".
    const calls = mockUpdate.mock.calls;
    expect(calls[0][1]).toMatchObject({ selfRatingCode: "A" });
    const lastCall = calls[calls.length - 1];
    expect(lastCall[1]).toMatchObject({ selfRatingCode: "SS" });
  });

  it("happy path — single save fires exactly one API call", async () => {
    mockUpdate.mockResolvedValue({ success: true });

    const { result } = renderHook(() =>
      useSelfAssessmentAutoSave({
        assessmentId: "test-assessment",
        initialStatus: SelfAssessmentStatus.DRAFT,
        isPeriodEditable: true,
      }),
    );

    await act(async () => {
      await result.current.save({ selfRatingCode: "A", selfComment: "hello" });
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      "test-assessment",
      expect.objectContaining({ selfRatingCode: "A", selfComment: "hello" }),
    );
  });

  it("no-op when assessmentId missing", async () => {
    mockUpdate.mockResolvedValue({ success: true });

    const { result } = renderHook(() =>
      useSelfAssessmentAutoSave({
        assessmentId: undefined,
        initialStatus: SelfAssessmentStatus.DRAFT,
        isPeriodEditable: true,
      }),
    );

    await act(async () => {
      await result.current.save({ selfRatingCode: "A", selfComment: "" });
    });

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("no-op when not editable (status != draft)", async () => {
    mockUpdate.mockResolvedValue({ success: true });

    const { result } = renderHook(() =>
      useSelfAssessmentAutoSave({
        assessmentId: "test-assessment",
        initialStatus: SelfAssessmentStatus.SUBMITTED,
        isPeriodEditable: true,
      }),
    );

    await act(async () => {
      await result.current.save({ selfRatingCode: "A", selfComment: "" });
    });

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
