"use client";

import { CORE_VALUE_RATING_DESCRIPTIONS } from "./constants";

/**
 * Sticky rating criteria legend for core value evaluation.
 * Renders the 7-level (SS through C) rating descriptions.
 */
export function CoreValueRatingLegend() {
  return (
    <div className="sticky top-4 z-10 bg-white pb-4 pt-10 -mt-8 border-b border-gray-200 mb-2">
      <div className="text-xs text-gray-500 space-y-0.5">
        {CORE_VALUE_RATING_DESCRIPTIONS.map(({ code, description }) => (
          <div key={code} className="py-1 px-2">
            <span className="font-semibold">{code}</span>
            <span className="mx-1">：</span>
            <span>{description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
