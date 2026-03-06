import { describe, expect, it } from "vitest";
import type { CoreValueRatingCode } from "@/api/types/core-value";
import { calculateCoreValueRatingAverage } from "./rating";

describe("calculateCoreValueRatingAverage", () => {
  it("should return null for empty array", () => {
    const result = calculateCoreValueRatingAverage([]);
    expect(result).toBeNull();
  });

  it("should return exact value for single rating", () => {
    const result = calculateCoreValueRatingAverage(["A" as CoreValueRatingCode]);
    expect(result).toBe(4.0);
  });

  it("should calculate average for multiple ratings", () => {
    const ratings: CoreValueRatingCode[] = ["SS", "C"] as CoreValueRatingCode[];
    const result = calculateCoreValueRatingAverage(ratings);
    // SS=7.0, C=1.0 → (7+1)/2 = 4.0
    expect(result).toBe(4.0);
  });

  it("should handle all rating codes correctly", () => {
    const allRatings: CoreValueRatingCode[] = ["SS", "S", "A+", "A", "A-", "B", "C"] as CoreValueRatingCode[];
    const result = calculateCoreValueRatingAverage(allRatings);
    // (7+6+5+4+3+2+1)/7 = 28/7 = 4.0
    expect(result).toBe(4.0);
  });

  it("should skip invalid rating codes", () => {
    const ratings = ["A", "INVALID" as CoreValueRatingCode] as CoreValueRatingCode[];
    const result = calculateCoreValueRatingAverage(ratings);
    // Only "A"=4.0 is valid → 4.0/1 = 4.0
    expect(result).toBe(4.0);
  });

  it("should return null if all ratings are invalid", () => {
    const ratings = ["X", "Y"] as unknown as CoreValueRatingCode[];
    const result = calculateCoreValueRatingAverage(ratings);
    expect(result).toBeNull();
  });
});
