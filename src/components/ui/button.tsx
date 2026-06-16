import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(212,176,123,0.3)] disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        primary:
          "border border-transparent bg-[linear-gradient(180deg,#f0d59c_0%,#d6b06a_100%)] text-[color:var(--lux-cta-text)] hover:-translate-y-px",
        secondary:
          "border border-[color:var(--lux-border)] bg-[color:var(--lux-card)] text-[color:var(--lux-text)] hover:border-[color:var(--lux-border-strong)]",
        subtle:
          "border border-transparent bg-[rgba(255,255,255,0.04)] text-[color:var(--lux-text-secondary)] hover:text-[color:var(--lux-text)]",
        danger:
          "border border-[rgba(138,89,100,0.22)] bg-[color:var(--lux-danger-bg)] text-[color:var(--lux-danger)]",
        ghost:
          "border border-transparent bg-transparent text-[color:var(--lux-text-secondary)] hover:text-[color:var(--lux-text)]",
      },
      size: {
        sm: "px-3 py-1.5 text-xs",
        md: "px-4 py-2.5 text-sm",
        lg: "px-5 py-3 text-sm",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type, ...props }, ref) => (
    <button ref={ref} type={type ?? "button"} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
