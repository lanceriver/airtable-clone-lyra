import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

/**
 * Airtable buttons: 13px text, 6px radius, no border, `at-hover` on hover.
 *
 * Variants
 * - `default`/`primary`: filled `at-primary` (Create, Save). Both names are
 *   the same style.
 * - `toolbar`: the 28px toolbar button (Hide fields, Filter, Sort...). Muted
 *   text, `at-hover` on hover; `data-[active=true]` or `aria-pressed` keeps the
 *   hover background, and the tint classes (`bg-at-filter-tint`...) can be
 *   added through `className`.
 * - `ghost`: transparent with `at-hover` on hover, in the text colour.
 * - `outline`: white with an `at-border` ring.
 * - `secondary`: `at-hover` filled.
 * - `destructive`, `link`: as before.
 *
 * Sizes
 * - `toolbar`: 28px tall, 8px horizontal padding (the default for toolbars).
 * - `icon-sm`: 28px square. `icon`: 32px square.
 * - `default` 32px, `sm` 28px, `lg` 40px.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[13px] font-normal transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-at-blue/40 focus-visible:ring-2 aria-invalid:ring-destructive/20 aria-invalid:ring-2",
  {
    variants: {
      variant: {
        default: "bg-at-primary text-white hover:bg-at-primary/90",
        primary: "bg-at-primary text-white hover:bg-at-primary/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline:
          "bg-white text-at-text shadow-[inset_0_0_0_1px_var(--color-at-border)] hover:bg-at-hover",
        secondary: "bg-at-hover text-at-text hover:bg-at-selected",
        ghost:
          "text-at-text hover:bg-at-hover [&_svg:not([class*='text-'])]:text-at-text-muted",
        toolbar:
          "text-at-text-muted hover:bg-at-hover hover:text-at-text aria-pressed:bg-at-hover aria-pressed:text-at-text data-[active=true]:bg-at-hover data-[active=true]:text-at-text",
        link: "text-at-blue underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3 has-[>svg]:px-2.5",
        sm: "h-7 gap-1 px-2 has-[>svg]:px-2",
        lg: "h-10 px-5 has-[>svg]:px-4",
        toolbar: "h-7 gap-1 px-2",
        icon: "size-8",
        "icon-sm": "size-7",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
