"use client";

import * as React from "react";
import { CheckIcon } from "lucide-react";

import { BASE_COLORS, BASE_COLOR_VALUES, getBaseColor } from "~/lib/baseColors";
import type { BaseColor } from "~/lib/baseColors";
import { cn } from "~/lib/utils";

/**
 * A row of the 10 base colours. The current one is ringed and checked.
 * Behaves as a radio group: arrow keys move and select.
 */
export function ColorSwatches({
  value,
  onChange,
  disabled,
  className,
  label = "Base colour",
}: {
  value: string | null | undefined;
  onChange: (color: BaseColor) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
}) {
  const current = getBaseColor(value).name;
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const move = (from: BaseColor, delta: number) => {
    const i = BASE_COLORS.indexOf(from);
    const next =
      BASE_COLORS[(i + delta + BASE_COLORS.length) % BASE_COLORS.length]!;
    onChange(next);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex items-center gap-2", className)}
    >
      {BASE_COLORS.map((name) => {
        const { solid, label: colorLabel } = BASE_COLOR_VALUES[name];
        const selected = name === current;
        return (
          <button
            key={name}
            ref={(el) => {
              refs.current[name] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={colorLabel}
            title={colorLabel}
            disabled={disabled}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(name)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(name, 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(name, -1);
              }
            }}
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full text-white transition-shadow outline-none",
              "focus-visible:ring-at-blue/40 focus-visible:ring-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
            style={{
              backgroundColor: solid,
              boxShadow: selected
                ? `0 0 0 2px #fff, 0 0 0 4px ${solid}`
                : undefined,
            }}
          >
            {selected && <CheckIcon className="size-3.5" strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  );
}
