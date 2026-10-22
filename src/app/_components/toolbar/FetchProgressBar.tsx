"use client";

import { useEffect, useState } from "react";

/** Show the bar only after this long, so quick fetches don't flicker. */
const SHOW_DELAY_MS = 150;

/**
 * A 2 px indeterminate bar along the bottom edge of its (relatively
 * positioned) parent, shown while `active` has been true for 150 ms.
 */
export function FetchProgressBar({ active }: { active: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [active]);

  if (!visible) return null;
  return (
    <div
      role="progressbar"
      aria-label="Loading records"
      data-testid="fetch-progress"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden"
    >
      <style>{`@keyframes fetch-progress-slide{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}`}</style>
      <div
        className="h-full w-2/5 bg-blue-600"
        style={{ animation: "fetch-progress-slide 1.1s ease-in-out infinite" }}
      />
    </div>
  );
}
