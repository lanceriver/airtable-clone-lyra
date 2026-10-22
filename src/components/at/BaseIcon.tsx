import { cn } from "~/lib/utils";
import { getBaseColor } from "~/lib/baseColors";

/** "my base" -> "My", "ab" -> "Ab". The first letter is upper-cased, the second kept. */
export function baseInitials(name: string): string {
  const chars = Array.from(name.trim());
  if (chars.length === 0) return "Ba";
  const [first, second = ""] = chars;
  return first!.toUpperCase() + second;
}

/** 6px radius at 32px, 10px at 56px, linear in between (clamped outside). */
function radiusFor(size: number): number {
  const t = Math.min(1, Math.max(0, (size - 32) / 24));
  return Math.round((6 + 4 * t) * 10) / 10;
}

/**
 * A rounded square in the base colour with the name's first two letters in
 * white. Used in the base header, the home cards and the create-base dialog.
 */
export function BaseIcon({
  name,
  color,
  size = 32,
  className,
}: {
  name: string;
  color?: string | null;
  size?: number;
  className?: string;
}) {
  const { solid } = getBaseColor(color);
  return (
    <span
      aria-hidden
      data-slot="base-icon"
      className={cn(
        "inline-flex shrink-0 items-center justify-center leading-none font-semibold text-white select-none",
        className,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: radiusFor(size),
        backgroundColor: solid,
        fontSize: Math.round(size * 0.44),
      }}
    >
      {baseInitials(name)}
    </span>
  );
}
