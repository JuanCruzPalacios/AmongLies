"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/layout/Header";

/** Marco común de las pantallas de cuenta (login, registro, contraseña). */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-dvh">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-bg-surface border border-border rounded-3xl p-6 sm:p-8 space-y-6"
        >
          <div className="text-center">
            <h2 className="font-display text-2xl font-bold">{title}</h2>
            {subtitle && <p className="text-text-secondary text-sm mt-1">{subtitle}</p>}
          </div>
          {children}
        </motion.div>
      </main>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-danger text-sm">{message}</div>
  );
}

export function CheckEmail({ text }: { text: string }) {
  return (
    <div className="text-center space-y-3">
      <div className="text-5xl">📬</div>
      <p className="text-text-secondary text-sm">{text}</p>
    </div>
  );
}
