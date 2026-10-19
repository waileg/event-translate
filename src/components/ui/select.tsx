import * as React from "react";
import { cn } from "@/lib/utils";

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-10 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:text-slate-50 dark:[&>option]:bg-slate-900",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export { Select };
