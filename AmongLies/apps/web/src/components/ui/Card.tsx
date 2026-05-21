"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function Card({ children, className = "", hover = false, onClick }: CardProps) {
  return (
    <motion.div
      whileHover={hover ? { scale: 1.02, y: -2 } : undefined}
      className={`
        bg-bg-surface border border-border rounded-2xl p-6
        ${hover ? "cursor-pointer transition-shadow hover:shadow-[0_0_30px_var(--color-primary-glow)]" : ""}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}
