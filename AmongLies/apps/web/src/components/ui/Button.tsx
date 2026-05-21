"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-light shadow-[0_0_20px_var(--color-primary-glow)]",
  secondary:
    "bg-bg-surface-light text-text-primary border border-border hover:bg-bg-surface-hover",
  ghost: "text-text-secondary hover:text-text-primary hover:bg-bg-surface-light",
  danger: "bg-danger text-white hover:bg-red-500",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-5 py-2.5 text-base rounded-xl",
  lg: "px-8 py-3.5 text-lg rounded-2xl",
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading,
  className = "",
  children,
  disabled,
  onClick,
  type = "button",
}: ButtonProps) {
  return (
    <motion.button
      type={type}
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className={`
        font-display font-semibold transition-colors duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        cursor-pointer inline-flex items-center justify-center gap-2
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      disabled={disabled || isLoading}
      onClick={onClick}
    >
      {isLoading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </motion.button>
  );
}
