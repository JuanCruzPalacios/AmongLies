"use client";

import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-text-secondary">{label}</label>
        )}
        <input
          ref={ref}
          className={`
            bg-bg-surface-light border border-border rounded-xl px-4 py-3
            text-text-primary placeholder:text-text-muted
            focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary
            transition-colors duration-200
            ${error ? "border-danger" : ""}
            ${className}
          `}
          {...props}
        />
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    );
  }
);

Input.displayName = "Input";
