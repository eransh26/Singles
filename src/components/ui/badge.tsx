import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em]",
  {
    variants: {
      variant: {
        neutral:
          "border-[color:var(--lux-border)] bg-[rgba(255,255,255,0.04)] text-[color:var(--lux-text-secondary)]",
        accent:
          "border-[rgba(229,181,98,0.22)] bg-[rgba(229,181,98,0.12)] text-[color:var(--lux-accent-deep)]",
        success:
          "border-[rgba(109,125,97,0.28)] bg-[color:var(--lux-success-bg)] text-[color:var(--lux-success)]",
        danger:
          "border-[rgba(158,106,118,0.22)] bg-[color:var(--lux-danger-bg)] text-[color:var(--lux-danger)]",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
