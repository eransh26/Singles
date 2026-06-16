import * as React from "react";
import { cn } from "@/lib/utils";

const fieldClassName =
  "w-full rounded-[0.875rem] border border-[color:var(--lux-border)] bg-[color:var(--lux-card)] px-4 py-3 text-[color:var(--lux-text)] transition duration-200 placeholder:text-[color:var(--lux-text-muted)] focus:border-[rgba(229,181,98,0.36)] focus:shadow-[0_0_0_4px_rgba(198,155,97,0.12)] focus:outline-none";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(fieldClassName, className)} {...props} />,
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(fieldClassName, "min-h-28", className)} {...props} />,
);
Textarea.displayName = "Textarea";
