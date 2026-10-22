/** The ten base colours (see docs/plans/phase-3-polish.md, "Base colours"). */
export const BASE_COLORS = [
  "blue",
  "cyan",
  "teal",
  "green",
  "yellow",
  "orange",
  "red",
  "pink",
  "purple",
  "gray",
] as const;

export type BaseColor = (typeof BASE_COLORS)[number];

export const DEFAULT_BASE_COLOR: BaseColor = "blue";

/** `solid`: icon and Share button. `tint`: the table tabs bar background. */
export const BASE_COLOR_VALUES: Record<
  BaseColor,
  { label: string; solid: string; tint: string }
> = {
  blue: { label: "Blue", solid: "#166ee1", tint: "#e9f1fd" },
  cyan: { label: "Cyan", solid: "#0d7f9e", tint: "#e3f4f9" },
  teal: { label: "Teal", solid: "#0b8a7a", tint: "#e1f4f1" },
  green: { label: "Green", solid: "#048a0e", tint: "#e6f5e7" },
  yellow: { label: "Yellow", solid: "#b87503", tint: "#fdf3dc" },
  orange: { label: "Orange", solid: "#d54402", tint: "#fdeee6" },
  red: { label: "Red", solid: "#dc043b", tint: "#fde8ed" },
  pink: { label: "Pink", solid: "#b2158b", tint: "#f9e7f4" },
  purple: { label: "Purple", solid: "#6b1cb0", tint: "#f1e8fa" },
  gray: { label: "Gray", solid: "#616670", tint: "#eff0f2" },
};

export function isBaseColor(value: unknown): value is BaseColor {
  return (
    typeof value === "string" &&
    (BASE_COLORS as readonly string[]).includes(value)
  );
}

export function randomBaseColor(): BaseColor {
  return BASE_COLORS[Math.floor(Math.random() * BASE_COLORS.length)]!;
}

/** Looks a colour up by name; unknown strings (or null) fall back to blue. */
export function getBaseColor(name: string | null | undefined): {
  name: BaseColor;
  label: string;
  solid: string;
  tint: string;
} {
  const key = isBaseColor(name) ? name : DEFAULT_BASE_COLOR;
  return { name: key, ...BASE_COLOR_VALUES[key] };
}
