"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";

/** Escucha la sesión de Supabase una sola vez para toda la app. */
export function AuthInit() {
  const init = useAuthStore((s) => s.init);
  useEffect(() => init(), [init]);
  return null;
}
