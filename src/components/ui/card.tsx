import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva("relative text-[color:var(--lux-text-primary)]", {
  variants: {
    variant: {
      solid:
        "rounded-[0.875rem] border border-[color:var(--lux-border)] bg-[color:var(--lux-card)] shadow-[0_14px_34px_rgba(18,12,9,0.16)]",
      soft:
        "rounded-[0.875rem] border border-[color:var(--lux-border)] bg-[linear-gradient(180deg,rgba(50,40,34,0.96),rgba(38,30,26,0.92))]",
      panel: "rounded-[0.875rem] border border-[color:var(--lux-border)] bg-[rgba(255,255,255,0.04)]",
      premium:
        "overflow-hidden rounded-[1.65rem] border border-[color:var(--lux-border-subtle)] bg-[linear-gradient(180deg,rgba(58,47,40,0.9),rgba(42,34,30,0.94))] shadow-[0_14px_30px_rgba(20,14,11,0.11)]",
    },
    padding: {
      none: "",
      sm: "p-4",
      md: "p-5 md:p-6",
    },
  },
  defaultVariants: { variant: "solid", padding: "md" },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ variant, padding }), className)} {...props} />
  ),
);
Card.displayName = "Card";

export { cardVariants };
