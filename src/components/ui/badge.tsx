import * as React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        {
          default: "bg-sky-500 text-slate-950",
          secondary: "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
          outline: "border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300",
        }[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
