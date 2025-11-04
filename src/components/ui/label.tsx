import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A lightweight accessible Label component.
 * 
 * Usage:
 * <Label htmlFor="amount">Amount (HBAR)</Label>
 */
export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        "text-sm font-medium text-gray-700 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    />
  );
}
